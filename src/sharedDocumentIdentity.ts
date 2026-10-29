import { sharedId, validAccess, type SharedAccess } from '../shared/collaboration';
import type { SavedDocument } from './backup';
export function sameSharedDocument(a: SharedAccess | undefined, b: SharedAccess | undefined): boolean {
  return !!a && !!b && sharedId(a) === sharedId(b) && a.token === b.token;
}
// Preserve the document's identity when sharing; a link identifies the same document.
export function applySharedDocument(documents: SavedDocument[], shared: SavedDocument): SavedDocument[] {
  return documents.filter(doc => doc.id === shared.id || !sameSharedDocument(doc.shared, shared.shared)).map(doc => doc.id === shared.id ? shared : doc);
}
export function joinSharedDocument(documents: SavedDocument[], access: SharedAccess): {documents:SavedDocument[]; document:SavedDocument} {
  const existing = documents.find(doc => sameSharedDocument(doc.shared,access)) || documents.find(doc => doc.id === sharedId(access));
  const document:SavedDocument = existing ? {...existing, shared:{...access,...(sameSharedDocument(existing.shared,access) && existing.shared?.ownerToken ? {ownerToken:existing.shared.ownerToken} : {})}} : {id:sharedId(access),title:'Documento compartido',content:{type:'doc',content:[{type:'paragraph'}]},shared:access,updated:Date.now()};
  return {documents: existing ? applySharedDocument(documents,document) : [...documents,document],document};
}
export function readAccountCollaboration(value:unknown): SharedAccess | undefined {
  if (value === undefined) return undefined;
  if (!validAccess(value)) throw new Error('El acceso compartido guardado no es válido. Conserva el borrador y solicita un enlace nuevo.');
  const ownerToken = value.ownerToken;
  if (ownerToken !== undefined && !/^[a-f0-9]{64}$/.test(ownerToken)) throw new Error('El permiso del propietario no es válido.');
  return {server:value.server,room:value.room,token:value.token,...(ownerToken ? {ownerToken} : {})};
}
