import type { Session } from '@supabase/supabase-js';
import {publishDocumentImages} from './imageAssets';
import { databaseFor } from './supabase';
import { readAccountCollaboration, sameSharedDocument } from './sharedDocumentIdentity';
import { makeBackup, readBackup, type SavedDocument } from './backup';

export type CloudEntry = { id: string; title: string; version: number; updated_at: string; size_bytes: number };
export const MAX_CLOUD_BYTES = 1024 * 1024;
export function cloudPayload(document: SavedDocument) {
  const backup = makeBackup(document);
  if (new TextEncoder().encode(backup).length > MAX_CLOUD_BYTES) throw { code: 'P0001', message: 'TEXLA_QUOTA_SIZE' };
  return JSON.parse(backup);
}
// Only the owner's RLS-protected account record stores the access needed to reopen
// this same shared document. Downloadable backups remain capability-free.
export function cloudRecordPayload(document: SavedDocument) {
  const payload = cloudPayload(document);
  if (document.shared) payload.collaboration = readAccountCollaboration(document.shared);
  if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_CLOUD_BYTES) throw {code:'P0001',message:'TEXLA_QUOTA_SIZE'};
  return payload;
}
export const cloudFingerprint = (document: SavedDocument) => JSON.stringify({...JSON.parse(makeBackup(document)), ...(document.shared ? {collaboration:document.shared} : {})});
export async function listCloudDocuments(session: Session, signal?: AbortSignal): Promise<CloudEntry[]> {
  let query = databaseFor(session).from('texla_documents').select('id,title,version,updated_at,size_bytes').eq('owner_id', session.user.id).order('updated_at', { ascending: false });
  query = query.abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000));
  const { data, error } = await query; if (error) throw error; return data || [];
}
export async function loadCloudDocument(session: Session, id: string): Promise<SavedDocument> {
  const { data, error } = await databaseFor(session).from('texla_documents').select('id,version,payload,updated_at').eq('owner_id', session.user.id).eq('id', id).abortSignal(AbortSignal.timeout(20000)).single();
  if (error) throw error;
  const restored = readBackup(JSON.stringify(data.payload));
  return { ...restored, shared: readAccountCollaboration(data.payload.collaboration), id: data.id, updated: Date.parse(data.updated_at), cloud: { ownerId: session.user.id, revision: data.version, dirty: false } };
}
export async function saveCloudDocument(session: Session, document: SavedDocument, signal: AbortSignal): Promise<{ version: number }> {
  if (document.cloud?.ownerId !== session.user.id) throw new Error('El documento no pertenece a esta biblioteca.');
  document=await publishDocumentImages(document,session);
  signal.throwIfAborted();
  const { data, error } = await databaseFor(session).rpc('save_texla_document', { p_id: document.id, p_payload: cloudRecordPayload(document), p_expected_version: document.cloud!.revision }).abortSignal(signal);
  if (error?.code === '40001' && (document.shared || document.cloud?.stoppedSharing)) {
    // Two owner devices may mirror the same CRDT in the same account row. The
    // collaboration server remains authoritative; never restore a revoked/replaced link.
    const current = await loadCloudDocument(session,document.id);
    if (!sameSharedDocument(current.shared,document.shared || document.cloud?.stoppedSharing)) throw error;
    const retry = await databaseFor(session).rpc('save_texla_document',{p_id:document.id,p_payload:cloudRecordPayload(document),p_expected_version:current.cloud!.revision}).abortSignal(signal);
    if(retry.error) throw retry.error; return retry.data;
  }
  if (error) throw error; return data;
}
export async function removeCloudDocument(session: Session, entry: CloudEntry) {
  const { data, error } = await databaseFor(session).from('texla_documents').delete().eq('owner_id', session.user.id).eq('id', entry.id).eq('version', entry.version).select('id').abortSignal(AbortSignal.timeout(20000));
  if (error) throw error; if (!data?.length) throw { code: '40001' };
}
