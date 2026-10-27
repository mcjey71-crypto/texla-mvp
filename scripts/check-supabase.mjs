// Public configuration only: never log keys or include administrative credentials in a build.
import { appendFileSync } from 'node:fs';
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url && !key) {
  console.log('Supabase is not configured; the device editor and Cloudflare collaboration remain available.');
} else {
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Set both Supabase variables and use only an sb_publishable_ public key.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('Invalid public Supabase URL.');
  const response = await fetch(new URL('/auth/v1/settings', endpoint), { headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Supabase Auth did not respond successfully (HTTP ${response.status}). Check the public configuration and project status.`);
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
