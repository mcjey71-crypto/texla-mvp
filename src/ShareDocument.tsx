import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import { MAX_STATE_BYTES, PROTOCOL_VERSION, serverUrl, shareLink, sharedId, toBase64, type SharedAccess } from '../shared/collaboration';
import type { SavedDocument } from './backup';
import { resolveFormat } from './formalDocument';
import { resolveStyle } from './citationStyles';
import type { SharedSession } from './SharedSession';

const SERVER_KEY = 'texla-collaboration-server';
export function configuredServer() { try { return localStorage.getItem(SERVER_KEY) || (import.meta.env.VITE_COLLABORATION_URL as string | undefined) || ''; } catch { return ''; } }
export function participantName() { try { return localStorage.getItem('texla-participant-name') || 'Invitado'; } catch { return 'Invitado'; } }
async function request(server: string, path: string, init?: RequestInit) {
  const response = await fetch(`${server}${path}`, { ...init, signal: AbortSignal.timeout(20000), credentials: 'omit', referrerPolicy: 'no-referrer' });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo conectar con el servidor.'); return data;
}

export default function ShareDocument({ document, editor, session, onCreated, onStopped }: { document: SavedDocument; editor: Editor; session: SharedSession | null; onCreated: (doc: SavedDocument) => void; onStopped: () => void }) {
  const [server, setServer] = useState(configuredServer);
  const [name, setName] = useState(participantName);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false); const [confirmStop, setConfirmStop] = useState(false);
  const [createdAccess, setCreatedAccess] = useState<SharedAccess | null>(null);
  const access = document.shared || createdAccess;
  const link = access ? shareLink(access, window.location.href) : '';
  function changeName(value: string) { setName(value); session?.setName(value); try { localStorage.setItem('texla-participant-name', value.slice(0, 60)); } catch { /* Name is optional. */ } }
  async function create() {
    setBusy(true); setError('');
    try {
      const endpoint = serverUrl(server.trim());
      const health = await request(endpoint, '/health'); if (health.service !== 'texla-collaboration' || health.version !== PROTOCOL_VERSION) throw new Error('Esta dirección no corresponde a un servidor compatible de Texla.');
      // One initial CRDT is uploaded once. Joiners never seed it with a separate copy.
      const ydoc = prosemirrorJSONToYDoc(editor.schema, editor.getJSON(), 'default');
      let state: Uint8Array;
      try {
        const metadata = ydoc.getMap('metadata'); metadata.set('title', document.title || 'Documento sin título'); metadata.set('citationStyle', resolveStyle(document.citationStyle));
        for (const [key, value] of Object.entries(resolveFormat(document.format))) metadata.set(`format.${key}`, value);
        for (const reference of document.references || []) ydoc.getMap('references').set(reference.id, reference);
        state = Y.encodeStateAsUpdate(ydoc);
      } finally { ydoc.destroy(); }
      if (state.byteLength > MAX_STATE_BYTES) throw new Error('El documento supera el límite compartido de 1 MB. Divídelo en capítulos antes de compartirlo.');
      // Check that the browser can remember the owner capability before creating a room.
      localStorage.setItem(SERVER_KEY, endpoint);
      const result = await request(endpoint, '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: toBase64(state) }) });
      const shared: SharedAccess = { server: endpoint, room: result.room, token: result.token, ownerToken: result.ownerToken }; setCreatedAccess(shared);
      onCreated({ ...document, content: editor.getJSON(), id: sharedId(shared), shared, updated: Date.now() });
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo compartir. Tu documento local sigue disponible.'); } finally { setBusy(false); }
  }
  async function stop() {
    if (!access?.ownerToken) return; setBusy(true); setError('');
    try { await request(access.server, `/rooms/${access.room}`, { method: 'DELETE', headers: { Authorization: `Bearer ${access.ownerToken}` } }); onStopped(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo desactivar el enlace.'); } finally { setBusy(false); }
  }
  return <>
    <h2 id="modal-title">Escriban en el mismo documento.</h2>
    <p>Texto, tablas, ecuaciones y bibliografía se actualizan entre los participantes.</p>
    <label className="field-label">Tu nombre para colaborar<input maxLength={60} value={name} onChange={e => changeName(e.target.value)} placeholder="Tu nombre"/></label>
    {access ? <>
      <div className="share-permission"><strong>Cualquier persona con el enlace puede editar.</strong><p>Compártelo únicamente con tu equipo. El enlace funciona como una llave de acceso.</p></div>
      <label className="field-label">Enlace de edición<input readOnly value={link} onFocus={e => e.target.select()}/></label>
      <button className="primary-button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Selecciona y copia el enlace del campo de arriba.'); } }}>{copied ? 'Enlace copiado' : 'Copiar enlace de edición'}</button>
      {session && <p className="privacy-note">{session.people.length || 1} participante(s) en esta sesión. Hasta 12 conexiones simultáneas por documento.</p>}
      {access.ownerToken && <div className="stop-sharing">{confirmStop ? <><p>Se desactivará el enlace y se eliminará la copia del servidor. Los participantes conservarán las copias que ya tengan. Tu documento seguirá disponible aquí.</p><button disabled={busy} onClick={() => void stop()}>Confirmar: dejar de compartir</button><button disabled={busy} onClick={() => setConfirmStop(false)}>Cancelar</button></> : <button disabled={busy} onClick={() => setConfirmStop(true)}>Dejar de compartir</button>}<p className="privacy-note">Este navegador conserva el permiso para desactivar el enlace. Las copias descargadas no incluyen permisos de acceso.</p></div>}
    </> : <>
      <div className="share-permission"><strong>Se creará una versión compartida.</strong><p>Tu documento local original se conservará. Los cambios posteriores se harán en la versión compartida.</p></div>
      <label className="field-label">Servidor de colaboración<input type="url" value={server} onChange={e => setServer(e.target.value)} placeholder="https://texla-collaboration.tu-cuenta.workers.dev"/></label>
      {!server && <p className="setup-note">La colaboración necesita activar el servidor gratuito de Texla en Cloudflare. El administrador configura esta dirección una sola vez; quienes reciban un enlace no necesitan hacerlo. <a href="https://github.com/mcjey71-crypto/texla-mvp/blob/main/docs/collaboration.md" target="_blank" rel="noreferrer">Guía de activación</a>.</p>}
      <p className="privacy-note">Al crear el enlace, se enviará este documento y su bibliografía al servidor indicado.</p>
      <button className="primary-button" disabled={busy || !server.trim()} onClick={() => void create()}>{busy ? 'Preparando documento…' : 'Crear enlace de edición'}</button>
    </>}
    {error && <p role="alert" className="import-error">{error}</p>}
  </>;
}
