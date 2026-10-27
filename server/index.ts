import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import { fromBase64, toBase64, MAX_STATE_BYTES, MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '../shared/collaboration';

interface Env { ROOMS: DurableObjectNamespace<DocumentRoom>; ALLOWED_ORIGINS: string; CREATION_LIMIT: RateLimit }
type Attachment = { authenticated: boolean; created: number; clientId?: number; awareness?: string; window?: number; messages?: number };
type Row = { state: ArrayBuffer; edit_hash: string; owner_hash: string; revoked: number };
const json = (data: unknown, status = 200) => Response.json(data, { status });
const randomHex = (size: number) => Array.from(crypto.getRandomValues(new Uint8Array(size)), b => b.toString(16).padStart(2, '0')).join('');
async function hash(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join(''); }
async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_MESSAGE_BYTES) throw new Error('Documento demasiado grande.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Falta el documento.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_MESSAGE_BYTES) { await reader.cancel(); throw new Error('Documento demasiado grande.'); } chunks.push(part.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);
    if (!allowed) return json({ error: 'Origen no permitido.' }, 403);
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let response: Response;
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') response = json({ service: 'texla-collaboration', version: PROTOCOL_VERSION });
      else if (url.pathname === '/rooms' && request.method === 'POST') {
        const limit = await env.CREATION_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
        if (!limit.success) response = json({ error: 'Demasiados documentos nuevos. Inténtalo en un minuto.' }, 429);
        else {
          const data = await body(request);
          const state = fromBase64(data.state); if (state.byteLength > MAX_STATE_BYTES) throw new Error('El documento supera el límite compartido de 1 MB.');
          const validation = new Y.Doc(); try { Y.applyUpdate(validation, state); if (!validation.getMap('metadata').get('title')) throw new Error('Falta el título.'); } finally { validation.destroy(); }
          const quota = await env.ROOMS.get(env.ROOMS.idFromName('creation-quota-v1')).fetch('https://internal/allocate', { method: 'POST' });
          if (!quota.ok) response = quota;
          else {
            const room = randomHex(16); const token = randomHex(32); const ownerToken = randomHex(32);
            const initialized = await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch('https://internal/initialize', { method: 'POST', body: JSON.stringify({ state: data.state, editHash: await hash(token), ownerHash: await hash(ownerToken) }) });
            response = initialized.ok ? json({ room, token, ownerToken }, 201) : initialized;
          }
        }
      } else {
        const match = url.pathname.match(/^\/rooms\/([a-f0-9]{32})(\/socket)?$/);
        if (match && ((request.method === 'DELETE' && !match[2]) || (request.method === 'GET' && match[2] && request.headers.get('Upgrade')?.toLowerCase() === 'websocket'))) response = await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
        else response = json({ error: 'Ruta no disponible.' }, 404);
      }
    } catch { response = json({ error: 'No se pudo procesar el documento. Revisa su tamaño y vuelve a intentarlo.' }, 400); }
    if (response.status === 101) return response;
    const result = new Response(response.body, response); for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    return result;
  }
} satisfies ExportedHandler<Env>;

export class DocumentRoom extends DurableObject<Env> {
  private doc = new Y.Doc();
  private row?: Row;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS document (id INTEGER PRIMARY KEY, state BLOB NOT NULL, edit_hash TEXT NOT NULL, owner_hash TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)');
    this.row = ctx.storage.sql.exec<Row>('SELECT state, edit_hash, owner_hash, revoked FROM document WHERE id = 1').toArray()[0];
    if (this.row && !this.row.revoked) Y.applyUpdate(this.doc, new Uint8Array(this.row.state));
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/allocate') {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS quota (id INTEGER PRIMARY KEY, day TEXT, daily INTEGER, total INTEGER)');
      const day = new Date().toISOString().slice(0, 10);
      const quota = this.ctx.storage.sql.exec<{day:string; daily:number; total:number}>('SELECT day, daily, total FROM quota WHERE id = 1').toArray()[0];
      if ((quota?.total || 0) >= 500 || (quota?.day === day && quota.daily >= 50)) return json({ error: 'Se alcanzó el límite de nuevos documentos del servidor. Conserva una copia local y avisa al administrador.' }, 429);
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO quota VALUES (1, ?, ?, ?)', day, quota?.day === day ? quota.daily + 1 : 1, (quota?.total || 0) + 1);
      return json({ ok: true });
    }
    if (path === '/initialize' && !this.row) {
      const data = await request.json() as {state:string; editHash:string; ownerHash:string};
      const state = fromBase64(data.state);
      this.ctx.storage.sql.exec('INSERT INTO document VALUES (1, ?, ?, ?, 0)', state, data.editHash, data.ownerHash);
      this.row = { state: state.buffer as ArrayBuffer, edit_hash: data.editHash, owner_hash: data.ownerHash, revoked: 0 }; Y.applyUpdate(this.doc, state);
      return json({ ok: true });
    }
    if (!this.row || this.row.revoked) {
      if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        const [client, server] = Object.values(new WebSocketPair()); server.accept(); server.close(4003, 'El enlace no existe o ya fue desactivado.');
        return new Response(null, { status: 101, webSocket: client });
      }
      return json({ error: 'Este documento ya no está compartido.' }, 404);
    }
    if (request.method === 'DELETE') {
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
      if (!/^[a-f0-9]{64}$/.test(token) || await hash(token) !== this.row.owner_hash) return json({ error: 'Solo quien creó el enlace puede desactivarlo desde su navegador original.' }, 403);
      this.ctx.storage.sql.exec('UPDATE document SET state = ?, revoked = 1 WHERE id = 1', new Uint8Array()); this.row.revoked = 1;
      for (const ws of this.ctx.getWebSockets()) ws.close(4003, 'El propietario dejó de compartir este documento.');
      this.doc.destroy(); this.doc = new Y.Doc(); return json({ ok: true });
    }
    if (this.ctx.getWebSockets().length >= 12) return json({ error: 'Este documento admite hasta 12 conexiones simultáneas.' }, 429);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server); server.serializeAttachment({ authenticated: false, created: Date.now() } satisfies Attachment);
    const alarm = await this.ctx.storage.getAlarm(); if (!alarm) await this.ctx.storage.setAlarm(Date.now() + 15000);
    return new Response(null, { status: 101, webSocket: client });
  }
  private broadcast(message: unknown, except?: WebSocket) {
    const text = JSON.stringify(message);
    for (const client of this.ctx.getWebSockets()) if (client !== except && client.deserializeAttachment()?.authenticated) { try { client.send(text); } catch { /* Closed connection. */ } }
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES || !this.row || this.row.revoked) throw new Error('Mensaje no permitido.');
      const message = JSON.parse(raw); const attachment = ws.deserializeAttachment() as Attachment;
      const window = Math.floor(Date.now() / 1000); attachment.messages = attachment.window === window ? (attachment.messages || 0) + 1 : 1; attachment.window = window;
      if (attachment.messages > 60) { ws.close(4008, 'Demasiados cambios por segundo.'); return; }
      ws.serializeAttachment(attachment);
      if (!attachment.authenticated) {
        if (message.type !== 'auth' || !/^[a-f0-9]{64}$/.test(message.token) || await hash(message.token) !== this.row.edit_hash || !Number.isSafeInteger(message.clientId)) { ws.close(4003, 'El enlace no es válido o fue desactivado.'); return; }
        // Another request may revoke the document while hashing the capability.
        if (this.row.revoked) { ws.close(4003, 'El documento ya no está compartido.'); return; }
        attachment.authenticated = true; attachment.clientId = message.clientId; ws.serializeAttachment(attachment);
        ws.send(JSON.stringify({ type: 'sync', state: toBase64(Y.encodeStateAsUpdate(this.doc)), vector: toBase64(Y.encodeStateVector(this.doc)) }));
        for (const peer of this.ctx.getWebSockets()) { const a = peer.deserializeAttachment() as Attachment; if (peer !== ws && a.authenticated && a.awareness) ws.send(JSON.stringify({ type: 'awareness', data: a.awareness })); }
        return;
      }
      if (message.type === 'update') {
        if (!Number.isSafeInteger(message.id)) throw new Error('Actualización sin identificador.');
        const update = fromBase64(message.data);
        // Validate in a separate document before replacing persisted or live state.
        const candidate = new Y.Doc(); let state: Uint8Array;
        try { Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.doc)); Y.applyUpdate(candidate, update); state = Y.encodeStateAsUpdate(candidate); } finally { candidate.destroy(); }
        if (state.byteLength > MAX_STATE_BYTES) { ws.send(JSON.stringify({ type: 'error', message: 'El documento llegó al límite compartido de 1 MB. Descarga una copia editable y divide el trabajo en documentos.' })); ws.close(4009, 'Límite de tamaño.'); return; }
        this.ctx.storage.sql.exec('UPDATE document SET state = ? WHERE id = 1', state);
        Y.applyUpdate(this.doc, update); // SQL output gates prevent sending an acknowledgement before storage commits.
        this.broadcast({ type: 'update', data: message.data }, ws); ws.send(JSON.stringify({ type: 'ack', id: message.id }));
      } else if (message.type === 'awareness') {
        if (typeof message.data !== 'string' || message.data.length > 3000) throw new Error('Presencia demasiado grande.');
        const decoder = decoding.createDecoder(fromBase64(message.data));
        if (decoding.readVarUint(decoder) !== 1 || decoding.readVarUint(decoder) !== attachment.clientId) throw new Error('Presencia no válida.');
        decoding.readVarUint(decoder); const state = JSON.parse(decoding.readVarString(decoder));
        if (state !== null && (typeof state.user?.name !== 'string' || state.user.name.length > 60 || !/^#[a-f0-9]{6}$/i.test(state.user?.color))) throw new Error('Participante no válido.');
        attachment.awareness = message.data; ws.serializeAttachment(attachment); this.broadcast({ type: 'awareness', data: message.data }, ws);
      } else throw new Error('Protocolo no compatible.');
    } catch { ws.close(4002, 'No se pudo procesar el cambio. Conserva una copia local.'); }
  }
  webSocketClose(ws: WebSocket) { const a = ws.deserializeAttachment() as Attachment; if (a.authenticated) this.broadcast({ type: 'leave', clientId: a.clientId }, ws); ws.close(); }
  webSocketError(ws: WebSocket) { this.webSocketClose(ws); }
  async alarm() {
    let pending = false;
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment() as Attachment; if (!a.authenticated) { if (Date.now() - a.created >= 14000) ws.close(4003, 'Conexión sin autenticar.'); else pending = true; } }
    if (pending) await this.ctx.storage.setAlarm(Date.now() + 15000);
  }
}
