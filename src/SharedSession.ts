import * as Y from 'yjs';
import { SharedCache } from './SharedCache';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { fromBase64, toBase64, sharedId, type SharedAccess } from '../shared/collaboration';
import { resolveFormat } from './formalDocument';
import { resolveStyle } from './citationStyles';
import { validReference, type Reference } from './references';

export type ConnectionState = 'connecting' | 'synced' | 'saving' | 'offline' | 'blocked';
export class SharedSession {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly metadata = this.doc.getMap('metadata');
  readonly references = this.doc.getMap<Reference>('references');
  state: ConnectionState = 'connecting';
  ready = false;
  error = '';
  cacheError = false;
  private listeners = new Set<() => void>();
  private persistence?: SharedCache;
  private socket?: WebSocket;
  private stopped = false;
  private authenticated = false;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastPong = 0;
  private sequence = 0;
  private pending = new Set<number>();
  private queued: Uint8Array[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private handshake?: ReturnType<typeof setTimeout>;

  constructor(readonly access: SharedAccess) { this.setName('Invitado'); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit = () => { for (const listener of this.listeners) listener(); };
  get people() { return [...this.awareness.getStates().values()].filter(s => typeof s.user?.name === 'string').map(s => s.user as {name:string; color:string}); }
  snapshot() {
    const format = Object.fromEntries(['pageSize', 'fontSize', 'lineSpacing', 'margin', 'numberedSections'].map(k => [k, this.metadata.get(`format.${k}`)]));
    return { title: String(this.metadata.get('title') || 'Documento compartido').slice(0, 500), citationStyle: resolveStyle(this.metadata.get('citationStyle')), format: resolveFormat(format), references: [...this.references.values()].filter(validReference) };
  }
  async start() {
    this.doc.on('update', this.onUpdate);
    this.awareness.on('update', this.onAwareness);
    this.awareness.on('change', this.emit);
    try {
      this.persistence = new SharedCache(`texla-collaboration-v1:${sharedId(this.access)}`, this.doc, () => { this.cacheError = true; this.emit(); });
      // IDB may be disabled by browser settings. Do not hold the network connection indefinitely.
      await Promise.race([this.persistence.whenSynced, new Promise(resolve => setTimeout(resolve, 1200))]);
      this.persistence.whenSynced.then(() => { if (!this.stopped && this.metadata.has('title')) { this.ready = true; this.emit(); } }).catch(() => { this.cacheError = true; this.emit(); });
    } catch { this.cacheError = true; }
    if (this.stopped) return;
    this.ready = this.metadata.has('title'); this.emit();
    this.connect(); window.addEventListener('online', this.reconnect); window.addEventListener('offline', this.disconnect);
  }
  private disconnect = () => { this.socket?.close(); };
  private reconnect = () => { if (!this.stopped && this.state !== 'blocked' && this.socket?.readyState !== WebSocket.OPEN) { clearTimeout(this.retry); this.connect(); } };
  private connect() {
    if (this.stopped) return;
    this.authenticated = false; this.pending.clear(); this.queued = []; clearTimeout(this.flushTimer); this.flushTimer = undefined;
    this.state = this.ready ? 'offline' : 'connecting'; this.emit();
    const socket = new WebSocket(`${this.access.server.replace(/^http/, 'ws')}/rooms/${this.access.room}/socket`); this.socket = socket;
    this.handshake = setTimeout(() => socket.close(), 15000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token: this.access.token, clientId: this.doc.clientID }));
    socket.onmessage = event => {
      if (this.stopped || socket !== this.socket) return;
      if (event.data === 'pong') { this.lastPong = Date.now(); return; }
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'sync') {
          clearTimeout(this.handshake); this.authenticated = true; this.attempts = 0;
          Y.applyUpdate(this.doc, fromBase64(message.state), this);
          this.ready = true; this.state = 'saving';
          this.sendUpdate(Y.encodeStateAsUpdate(this.doc, fromBase64(message.vector)));
          this.sendAwareness(); this.emit();
          this.lastPong = Date.now(); clearInterval(this.heartbeat);
          this.heartbeat = setInterval(() => { if (Date.now() - this.lastPong > 45000) socket.close(); else if (socket.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000);
        } else if (message.type === 'update') Y.applyUpdate(this.doc, fromBase64(message.data), this);
        else if (message.type === 'ack') { this.pending.delete(message.id); if (!this.pending.size && !this.queued.length) this.state = 'synced'; this.emit(); }
        else if (message.type === 'awareness') applyAwarenessUpdate(this.awareness, fromBase64(message.data), this);
        else if (message.type === 'leave') removeAwarenessStates(this.awareness, [message.clientId], this);
        else if (message.type === 'error') { this.error = message.message; this.state = 'blocked'; this.emit(); }
      } catch { this.error = 'No se pudo leer la sincronización. Descarga una copia editable.'; this.state = 'blocked'; socket.close(); this.emit(); }
    };
    socket.onclose = event => {
      if (this.stopped || socket !== this.socket) return;
      clearTimeout(this.handshake); clearInterval(this.heartbeat); this.authenticated = false;
      removeAwarenessStates(this.awareness, [...this.awareness.getStates().keys()].filter(id => id !== this.doc.clientID), this);
      if ([4002, 4003, 4009].includes(event.code) || this.state === 'blocked') { this.state = 'blocked'; this.error ||= event.reason || 'El enlace ya no está disponible. Conserva tu copia local.'; }
      else { this.state = 'offline'; this.retry = setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.attempts++) + Math.random() * 500); }
      this.emit();
    };
    socket.onerror = () => { /* The close event handles reconnection without discarding local changes. */ };
  }
  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this && this.authenticated && this.state !== 'blocked') {
      this.queued.push(update); this.state = 'saving';
      if (!this.flushTimer) this.flushTimer = setTimeout(() => { this.flushTimer = undefined; if (this.queued.length) { this.sendUpdate(Y.mergeUpdates(this.queued)); this.queued = []; } }, 60);
    }
    this.emit();
  };
  private sendUpdate(update: Uint8Array) {
    if (this.socket?.readyState !== WebSocket.OPEN || !this.authenticated) return;
    const id = ++this.sequence; this.pending.add(id); this.socket.send(JSON.stringify({ type: 'update', data: toBase64(update), id }));
  }
  private sendAwareness() {
    if (this.socket?.readyState === WebSocket.OPEN && this.authenticated) this.socket.send(JSON.stringify({ type: 'awareness', data: toBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) }));
  }
  private onAwareness = (_: unknown, origin: unknown) => { if (origin !== this) this.sendAwareness(); };
  setName(name: string) { this.awareness.setLocalState({ ...this.awareness.getLocalState(), user: { name: name.trim().slice(0, 60) || 'Invitado', color: ['#376e53', '#80599c', '#ae6440', '#356e9b'][this.doc.clientID % 4] } }); }
  destroy() {
    this.stopped = true; clearTimeout(this.retry); clearTimeout(this.flushTimer); clearTimeout(this.handshake); clearInterval(this.heartbeat);
    window.removeEventListener('online', this.reconnect); window.removeEventListener('offline', this.disconnect); this.awareness.setLocalState(null); this.socket?.close();
    this.doc.off('update', this.onUpdate); this.awareness.off('update', this.onAwareness); this.awareness.off('change', this.emit); this.listeners.clear();
    this.awareness.destroy(); void this.persistence?.destroy(); this.doc.destroy();
  }
}
