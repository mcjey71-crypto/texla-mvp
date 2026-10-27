export const MAX_STATE_BYTES = 1024 * 1024;
export const MAX_MESSAGE_BYTES = 1500000;
export const PROTOCOL_VERSION = 1;

export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array {
  if (typeof text !== 'string' || text.length > MAX_MESSAGE_BYTES) throw new Error('Documento demasiado grande.');
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

export function serverUrl(value: string): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Usa la dirección HTTPS del servidor, sin rutas ni parámetros.');
  return url.origin;
}

export type SharedAccess = { server: string; room: string; token: string; ownerToken?: string };
export function validAccess(value: unknown): value is SharedAccess {
  const v = value as SharedAccess;
  try { return !!v && serverUrl(v.server) === v.server && /^[a-f0-9]{32}$/.test(v.room) && /^[a-f0-9]{64}$/.test(v.token); } catch { return false; }
}
export const sharedId = (access: SharedAccess) => `shared:${access.server}:${access.room}`;
export function shareLink(access: SharedAccess, base: string): string {
  const url = new URL(base); url.hash = ''; url.search = '';
  // Only the editing capability travels in the fragment; the owner capability stays on this device.
  url.hash = `share=${encodeURIComponent(JSON.stringify({ server: access.server, room: access.room, token: access.token }))}`;
  return url.href;
}
export function readShareLink(hash: string): SharedAccess | null {
  if (!hash.startsWith('#share=')) return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice(7)));
    if (validAccess(value)) return { server: value.server, room: value.room, token: value.token };
  } catch { /* Show a readable error in the UI. */ }
  throw new Error('El enlace para compartir no es válido. Solicita un enlace nuevo.');
}
