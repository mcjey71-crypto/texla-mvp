import type { Session } from '@supabase/supabase-js';
import { databaseFor } from './supabase';
import { makeBackup, readBackup, type SavedDocument } from './backup';

export type CloudEntry = { id: string; title: string; version: number; updated_at: string; size_bytes: number };
export const MAX_CLOUD_BYTES = 1024 * 1024;
export function cloudPayload(document: SavedDocument) {
  const backup = makeBackup(document);
  if (new TextEncoder().encode(backup).length > MAX_CLOUD_BYTES) throw { code: 'P0001', message: 'TEXLA_QUOTA_SIZE' };
  return JSON.parse(backup);
}
export async function listCloudDocuments(session: Session, signal?: AbortSignal): Promise<CloudEntry[]> {
  let query = databaseFor(session).from('texla_documents').select('id,title,version,updated_at,size_bytes').eq('owner_id', session.user.id).order('updated_at', { ascending: false });
  query = query.abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000));
  const { data, error } = await query; if (error) throw error; return data || [];
}
export async function loadCloudDocument(session: Session, id: string): Promise<SavedDocument> {
  const { data, error } = await databaseFor(session).from('texla_documents').select('id,version,payload,updated_at').eq('owner_id', session.user.id).eq('id', id).abortSignal(AbortSignal.timeout(20000)).single();
  if (error) throw error;
  const restored = readBackup(JSON.stringify(data.payload));
  return { ...restored, id: data.id, updated: Date.parse(data.updated_at), cloud: { ownerId: session.user.id, revision: data.version, dirty: false } };
}
export async function saveCloudDocument(session: Session, document: SavedDocument, signal: AbortSignal): Promise<{ version: number }> {
  if (document.cloud?.ownerId !== session.user.id || document.shared) throw new Error('El documento no pertenece a esta biblioteca.');
  const { data, error } = await databaseFor(session).rpc('save_texla_document', { p_id: document.id, p_payload: cloudPayload(document), p_expected_version: document.cloud.revision }).abortSignal(signal);
  if (error) throw error; return data;
}
export async function removeCloudDocument(session: Session, entry: CloudEntry) {
  const { data, error } = await databaseFor(session).from('texla_documents').delete().eq('owner_id', session.user.id).eq('id', entry.id).eq('version', entry.version).select('id').abortSignal(AbortSignal.timeout(20000));
  if (error) throw error; if (!data?.length) throw { code: '40001' };
}
