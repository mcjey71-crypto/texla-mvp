// Public configuration only: never log keys or include administrative credentials in a build.
import { appendFileSync } from 'node:fs';
import { isPublicSupabaseKey } from '../shared/supabase-public-key.js';
class ConfigurationError extends Error {}
async function check() {
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url && !key) {
  console.log('Supabase is not configured; the device editor and Cloudflare collaboration remain available.');
} else {
  if (!url) throw new ConfigurationError('Falta la variable VITE_SUPABASE_URL en GitHub Actions.');
  if (!key) throw new ConfigurationError('Falta la variable VITE_SUPABASE_PUBLISHABLE_KEY en GitHub Actions.');
  if (!isPublicSupabaseKey(key)) throw new ConfigurationError('VITE_SUPABASE_PUBLISHABLE_KEY debe contener una clave pública sb_publishable_ o una clave anon válida; no se admite una clave administrativa.');
  let endpoint; try { endpoint = new URL(url); } catch { throw new ConfigurationError('VITE_SUPABASE_URL no contiene una URL válida. Copia la Project URL real.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new ConfigurationError('VITE_SUPABASE_URL debe ser la dirección HTTPS del proyecto, sin rutas, parámetros ni credenciales.');
  const response = await fetch(new URL('/auth/v1/settings', endpoint), { headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new ConfigurationError(`Supabase Auth respondió HTTP ${response.status}. Revisa la URL, la clave pública y que el proyecto esté activo.`);
  const settings = await response.json();
  console.log(`Supabase Auth responds. Google enabled: ${!!settings.external?.google}. Email enabled: ${!!settings.external?.email}.`);
  if (!settings.external?.google) console.log('::warning::Google sign-in still needs to be enabled in Supabase Authentication → Providers.');
  // limit=0 requests schema availability without retrieving any documents.
  const schema = await fetch(new URL('/rest/v1/texla_documents?select=id&limit=0', endpoint), { headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  const schemaResult = await schema.json().catch(() => ({}));
  const missing = schemaResult.code === 'PGRST205' || schemaResult.code === '42P01';
  if (missing) console.log('::warning::Apply supabase/migrations/202610270001_private_documents.sql in the Supabase SQL Editor to activate the document library.');
  console.log('This check does not execute migrations, verify authenticated policies or test delivery of sign-in emails.');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Configuración de cuentas de Texla\n\n- Supabase Auth responde correctamente.\n- Google habilitado: ${settings.external?.google ? 'sí' : 'no; actívalo en Authentication → Providers'}.\n- Correo habilitado: ${settings.external?.email ? 'sí; la entrega de mensajes requiere configuración del proveedor' : 'no'}.\n- Biblioteca: ${missing ? 'pendiente de ejecutar la migración SQL' : 'consulta de esquema completada; falta comprobar el acceso autenticado después de la migración'}.\n\n[Guía de activación](https://github.com/mcjey71-crypto/texla-mvp/blob/main/docs/supabase.md) · [Script SQL](https://github.com/mcjey71-crypto/texla-mvp/blob/main/supabase/migrations/202610270001_private_documents.sql)\n`);
}

}
try { await check(); } catch (error) {
  const message = error instanceof ConfigurationError ? error.message : 'No se pudo conectar con Supabase. Comprueba que la Project URL sea correcta y el proyecto esté activo.';
  console.error(`::error title=Configuración de Supabase::${message}`); process.exitCode = 1;
}
