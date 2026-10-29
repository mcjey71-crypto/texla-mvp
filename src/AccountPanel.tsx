import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { accountClient, accountConfigurationError, accountError, accountRedirectUrl, signInOptions } from './supabase';
import { listCloudDocuments, loadCloudDocument, type CloudEntry } from './cloudDocuments';
import type { SavedDocument } from './backup';

type Props = { session: Session | null; current: SavedDocument; refreshKey: string; onOpen: (doc: SavedDocument) => void; onCopy: (doc: SavedDocument) => void; onRemove: (entry: CloudEntry) => Promise<void>; hasDocument: boolean; onSignOut: () => Promise<void>; deviceDocuments: () => SavedDocument[] };
export default function AccountPanel({ session, current, refreshKey, onOpen, onCopy, onRemove, hasDocument, onSignOut, deviceDocuments }: Props) {
  const [entries, setEntries] = useState<CloudEntry[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [email, setEmail] = useState(''); const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [providers, setProviders] = useState<{google:boolean; email:boolean} | null>(null); const [reload, setReload] = useState(0);
  const [showDevice, setShowDevice] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(!!session);
  useEffect(() => {
    const controller = new AbortController(); let active = true; setError('');
    if (session) {
      setLoadingLibrary(true);
      void listCloudDocuments(session, controller.signal).then(rows => { if (active) setEntries(rows); }).catch(e => { if (active) setError(accountError(e)); }).finally(() => { if (active) setLoadingLibrary(false); });
    } else if (accountClient) {
      void signInOptions(controller.signal).then(data => { if (active) setProviders(data); }).catch(() => { if (active) setError('No se pudo consultar el acceso. Revisa tu conexión y pulsa Actualizar.'); });
    }
    return () => { active = false; controller.abort(); };
  }, [session?.user.id, refreshKey, reload]);
  async function emailLogin(event: React.FormEvent) {
    event.preventDefault(); if (!accountClient) return; setBusy(true); setError(''); setNotice('');
    try {
      const { error } = await accountClient.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: accountRedirectUrl() } });
      if (error) throw error; setNotice('Revisa tu correo y abre el enlace desde este mismo navegador. No necesitas una contraseña.');
    } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
  }
  async function open(entry: CloudEntry) {
    if (!session) return; setBusy(true); setError('');
    try { onOpen(await loadCloudDocument(session, entry.id)); } catch (e) { setError(e instanceof Error ? e.message : accountError(e)); } finally { setBusy(false); }
  }
  async function remove(entry: CloudEntry) {
    if (!session) return; setBusy(true); setError('');
    try { await onRemove(entry); setConfirmDelete(null); setReload(n => n + 1); }
    catch (e) { setError(accountError(e)); } finally { setBusy(false); }
  }
  const used = entries.reduce((sum, entry) => sum + entry.size_bytes, 0);
  return <>
    <h2 id="modal-title">{session ? 'Tu biblioteca, contigo.' : 'Un espacio para tus documentos.'}</h2>
    {session ? <>
      <p className="account-email">{session.user.email || 'Sesión iniciada'}</p>
      <p>Tu biblioteca es privada. Los documentos que compartas también pueden ser editados por quienes tengan su enlace. Puedes abrirlos desde otro dispositivo al iniciar sesión.</p>
      <div className="account-usage"><strong>{entries.length} / 50 documentos</strong><span>{(used / 1024 / 1024).toFixed(2)} / 10 MiB</span><progress aria-label="Almacenamiento de mi cuenta" value={used} max={10 * 1024 * 1024}/><small>Hasta 1 MiB por documento. Sujeto al espacio disponible del servicio.</small></div>
      {hasDocument && !current.cloud && <button className="primary-button" disabled={busy} onClick={() => onCopy(current)}>{current.shared ? 'Guardar una copia privada' : 'Copiar este documento a mi cuenta'}</button>}
      {current.shared && !current.cloud && <p className="privacy-note">La copia será independiente del documento compartido y no incluirá su enlace de acceso.</p>}
      <div className="account-library" aria-label="Documentos de mi cuenta">{entries.map(entry => <div className="account-entry" key={entry.id}>
        <button disabled={busy} onClick={() => void open(entry)}><strong>{entry.title || 'Sin título'}</strong><small>{new Date(entry.updated_at).toLocaleDateString('es')} · {(entry.size_bytes / 1024).toFixed(1)} KiB</small></button>
        {confirmDelete === entry.id ? <div><p>¿Eliminar de la nube? La copia abierta en este navegador se conservará.</p><button disabled={busy} onClick={() => void remove(entry)}>Confirmar eliminación</button><button onClick={() => setConfirmDelete(null)}>Cancelar</button></div> : <button aria-label={`Eliminar de la nube: ${entry.title}`} disabled={busy} onClick={() => setConfirmDelete(entry.id)}>Eliminar</button>}
      </div>)}{loadingLibrary && <p>Cargando tu biblioteca…</p>}{!loadingLibrary && !entries.length && !error && <p>Todavía no tienes documentos guardados en esta cuenta. Crea uno nuevo o copia uno de este navegador.</p>}</div>
      <button className="text-button" onClick={() => setShowDevice(value => !value)}>Documentos del navegador sin cuenta</button>
      {showDevice && <div className="account-library">{deviceDocuments().filter(doc => doc.id !== 'welcome').map(doc => <div className="account-entry" key={doc.id}><span>{doc.title}</span><button onClick={() => onCopy(doc)}>Copiar a mi cuenta</button></div>)}<p className="privacy-note">Solo se sube el documento que elijas. El original permanece en el navegador.</p></div>}
      <p className="privacy-note">Los borradores se conservan en este dispositivo, asociados a tu cuenta, para recuperar cambios pendientes. Descarga copias de tus trabajos importantes.</p>
      <button className="text-button" disabled={busy} onClick={async () => { setBusy(true); try { await onSignOut(); } catch (e) { setError(accountError(e)); } finally { setBusy(false); } }}>Cerrar sesión</button>
    </> : <>
      <p>Entra para guardar documentos privados en tu cuenta. Tus documentos actuales del navegador se conservarán.</p>
      {!accountClient ? <p role="status" className="setup-note">{accountConfigurationError || 'El acceso a cuentas todavía no está configurado. Puedes seguir escribiendo sin iniciar sesión.'}</p> : <>
        {providers?.google && <button className="primary-button account-google" disabled={busy} onClick={async () => {
          if (!accountClient) return;
          setBusy(true); setError('');
          try {
            const { data, error } = await accountClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: accountRedirectUrl(), skipBrowserRedirect: true } });
            if (error || !data.url) throw error; window.location.assign(data.url);
          } catch (error) { setError(accountError(error)); setBusy(false); }
        }}>Continuar con Google</button>}
        {providers?.email && <form onSubmit={event => void emailLogin(event)}><label className="field-label">Tu correo electrónico<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com"/></label><button className="primary-button" disabled={busy || !email.trim()} type="submit">{busy ? 'Preparando acceso…' : 'Enviarme enlace para entrar'}</button></form>}
        {providers && !providers.google && !providers.email && <p role="status">El administrador todavía debe habilitar un método de acceso.</p>}
        {!providers && !error && <p>Cargando opciones de acceso…</p>}
      </>}
    </>}
    <button className="text-button" disabled={busy} onClick={() => setReload(n => n + 1)}>Actualizar</button>
    {notice && <p role="status" className="setup-note">{notice}</p>}
    {error && <p role="alert" className="import-error">{error}</p>}
  </>;
}
