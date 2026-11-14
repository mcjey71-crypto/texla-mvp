import {useEffect, useState} from 'react';
import {accountClient, accountConfigurationError, accountError, accountRedirectUrl, signInOptions} from './supabase';

export default function LoginForm() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [reload, setReload] = useState(0);
  const [providers, setProviders] = useState<{google:boolean; email:boolean} | null>(null);
  useEffect(() => {
    if (!accountClient) return;
    const controller = new AbortController(); let active = true; setError('');
    void signInOptions(controller.signal).then(options => {if (active) setProviders(options);}).catch(() => {if (active) setError('No se pudo consultar el acceso. Revisa tu conexión y pulsa Actualizar.');});
    return () => {active = false; controller.abort();};
  }, [reload]);
  async function emailLogin(event: React.FormEvent) {
    event.preventDefault(); if (!accountClient || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const {error} = await accountClient.auth.signInWithOtp({email:email.trim(), options:{emailRedirectTo:accountRedirectUrl(), shouldCreateUser:true}});
      if (error) throw error;
      setNotice('Revisa tu correo y abre el enlace en este navegador. Si es tu primera vez, tu cuenta se creará al confirmar el correo.');
    } catch (error) {setError(accountError(error));} finally {setBusy(false);}
  }
  return <>
    <h2 id="modal-title">Inicia sesión o crea tu cuenta.</h2>
    <p>Confirma tu correo para empezar a escribir. Tu cuenta es gratuita y tus borradores anteriores se conservan en este navegador.</p>
    {!accountClient ? <p role="alert" className="setup-note">{accountConfigurationError || 'El acceso a cuentas no está disponible. El administrador debe completar la configuración para abrir el editor.'}</p> : <>
      {providers?.google && <button className="primary-button account-google" disabled={busy} onClick={async () => {
        if (!accountClient) return;
        setBusy(true); setError('');
        try {
          const {data, error} = await accountClient.auth.signInWithOAuth({provider:'google', options:{redirectTo:accountRedirectUrl(), skipBrowserRedirect:true}});
          if (error || !data.url) throw error; window.location.assign(data.url);
        } catch (error) {setError(accountError(error)); setBusy(false);}
      }}>Continuar con Google</button>}
      {providers?.email && <form onSubmit={event => void emailLogin(event)}>
        <label className="field-label">Tu correo electrónico<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@correo.com"/></label>
        <button className="primary-button" disabled={busy || !email.trim()} type="submit">{busy ? 'Preparando acceso…' : 'Enviarme enlace para entrar'}</button>
      </form>}
      {providers && !providers.google && !providers.email && <p role="status">El administrador todavía debe habilitar un método de acceso.</p>}
      {!providers && !error && <p>Cargando opciones de acceso…</p>}
      <button className="text-button" disabled={busy} onClick={() => setReload(value => value + 1)}>Actualizar</button>
    </>}
    {notice && <p role="status" className="setup-note">{notice}</p>}
    {error && <p role="alert" className="import-error">{error}</p>}
  </>;
}
