import { createClient, type Session } from '@supabase/supabase-js';

export function publicConfiguration(url: string | undefined, key: string | undefined) {
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Falta completar la configuración de las cuentas.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('La dirección del servicio de cuentas no es válida.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('La configuración necesita una clave pública sb_publishable_.');
  return { url: endpoint.origin, key };
}
let configuration: ReturnType<typeof publicConfiguration> = null;
export let accountConfigurationError = '';
try { configuration = publicConfiguration(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY); }
catch (error) { accountConfigurationError = error instanceof Error ? error.message : 'No se pudo cargar la configuración de cuentas.'; }
export const accountClient = configuration ? createClient(configuration.url, configuration.key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

// Bind each request to the session that started it. Switching accounts cannot retarget an in-flight save.
export function databaseFor(session: Session) {
  if (!configuration) throw new Error('El servicio de cuentas todavía no está configurado.');
  return createClient(configuration.url, configuration.key, {
    accessToken: async () => session.access_token,
  });
}
export const accountRedirectUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;
export async function signInOptions(signal: AbortSignal): Promise<{ google: boolean; email: boolean }> {
  if (!configuration) return { google: false, email: false };
  const response = await fetch(`${configuration.url}/auth/v1/settings`, { headers: { apikey: configuration.key }, signal });
  if (!response.ok) throw new Error('No se pudieron consultar las opciones de acceso.');
  const settings = await response.json(); return { google: !!settings.external?.google, email: !!settings.external?.email };
}

export function accountError(error: unknown): string {
  const detail = error as { code?: string; message?: string; status?: number };
  if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(detail?.code || '')) return 'La biblioteca aún no está activada. El administrador debe ejecutar el script SQL de Texla en Supabase.';
  if (detail?.code === '40001' || detail?.code === 'P0002') return 'Este documento cambió en otro dispositivo. Conserva tus cambios como una copia o abre la versión de la nube.';
  if (detail?.code === 'P0001' && detail.message?.startsWith('TEXLA_QUOTA')) return 'Se alcanzó una cuota de la biblioteca: máximo 50 documentos, 10 MiB por cuenta y 1 MiB por documento, sujetos al espacio total disponible.';
  if (detail?.status === 401 || detail?.code === 'PGRST301') return 'La sesión ha caducado. Vuelve a iniciar sesión para guardar tus cambios.';
  if (detail?.code === 'over_email_send_rate_limit' || detail?.status === 429) return 'Se alcanzó el límite de solicitudes. Espera un momento antes de reintentar.';
  if (detail?.message?.includes('Email address') || detail?.code === 'email_address_invalid') return 'Revisa el correo electrónico. El envío de enlaces debe estar habilitado por el administrador.';
  return 'No se pudo completar la operación. Revisa tu conexión o vuelve a intentarlo. Tus cambios abiertos se conservan.';
}
