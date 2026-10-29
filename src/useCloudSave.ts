import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SavedDocument } from './backup';
import { saveCloudDocument, cloudFingerprint } from './cloudDocuments';
import { accountError } from './supabase';

export function useCloudSave(session: Session | null, docs: SavedDocument[], setDocs: Dispatch<SetStateAction<SavedDocument[]>>) {
  const latest = useRef({ session, docs }); latest.current = { session, docs };
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, { message: string; conflict: boolean }>>({});
  const [retry, setRetry] = useState(0);
  const blocked = useRef(new Set<string>()); const running = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); let stopped = false; let timer: ReturnType<typeof setTimeout>;
    function schedule() { clearTimeout(timer); timer = setTimeout(() => void flush(), 900); }
    async function flush() {
      if (stopped || running.current || !navigator.onLine) return;
      const { session, docs } = latest.current;
      const candidate = session && docs.find(d => d.cloud?.ownerId === session.user.id && d.cloud.dirty && !blocked.current.has(d.id));
      if (!session || !candidate) return;
      running.current = true; setSaving(candidate.id);
      const snapshot = cloudFingerprint(candidate);
      try {
        const result = await saveCloudDocument(session, candidate, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
        if (!stopped) {
          setDocs(prev => prev.map(d => d.id === candidate.id && d.cloud?.ownerId === session.user.id ? { ...d, cloud: { ...d.cloud, revision: result.version, dirty: cloudFingerprint(d) !== snapshot, stoppedSharing: cloudFingerprint(d) === snapshot ? undefined : d.cloud.stoppedSharing } } : d));
          setErrors(prev => { const next = { ...prev }; delete next[candidate.id]; return next; });
        }
      } catch (error) {
        if (!stopped) {
          blocked.current.add(candidate.id);
          setErrors(prev => ({ ...prev, [candidate.id]: { message: accountError(error), conflict: ['40001', 'P0002'].includes((error as {code?:string})?.code || '') } }));
        }
      } finally { running.current = false; if (!stopped) { setSaving(null); schedule(); } }
    }
    schedule();
    const online = () => { blocked.current.clear(); schedule(); };
    window.addEventListener('online', online);
    // A polling tick also picks up changes while an earlier request was in flight.
    const interval = setInterval(schedule, 2000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(interval); window.removeEventListener('online', online); controller.abort(); };
  }, [session?.user.id, retry, setDocs]);
  return { saving, errors, retry: () => { blocked.current.clear(); setErrors({}); setRetry(n => n + 1); } };
}
