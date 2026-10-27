import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { accountClient, accountConfigurationError, accountError } from './supabase';

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!accountClient);
  const [error, setError] = useState(accountConfigurationError);
  useEffect(() => {
    if (!accountClient) return;
    let active = true; let observed = false; let settled = false;
    const { data } = accountClient.auth.onAuthStateChange((_event, next) => {
      observed = true; settled = true;
      if (active) { setSession(next); setLoading(false); }
    });
    void accountClient.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      settled = true;
      if (error) setError(accountError(error));
      if (!observed) setSession(data.session);
      setLoading(false);
    }).catch(error => { settled = true; if (active) { setError(accountError(error)); setLoading(false); } });
    const timer = setTimeout(() => { if (active && !settled) { setLoading(false); setError('La sesión está tardando en responder. Puedes seguir usando los documentos de este navegador.'); } }, 15000);
    return () => { active = false; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, []);
  return { session, loading, error };
}
