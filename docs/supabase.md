# Configuración pública de Supabase

El workflow de GitHub Pages ya entrega las variables de Supabase al proceso de compilación de Vite. Este cambio prepara la configuración: todavía no añade inicio de sesión, tablas, permisos ni migración de documentos a Supabase. La colaboración existente continúa usando Cloudflare.

## Sitio publicado

En [Settings → Secrets and variables → Actions → Variables](https://github.com/mcjey71-crypto/texla-mvp/settings/variables/actions), crea estas **Repository variables**:

| Nombre | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | La Project URL real, normalmente `https://identificador.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave pública que comienza por `sb_publishable_` |

No pegues los textos de ejemplo como «Pegue la URL…». Usa los valores que proporciona tu proyecto. La URL está en la configuración del proyecto y la clave publicable en **Settings → API Keys** de Supabase.

Después de guardar o cambiar estas variables, ejecuta [Actions → Publish Texla Docs to GitHub Pages → Run workflow](https://github.com/mcjey71-crypto/texla-mvp/actions/workflows/pages.yml) sobre `main`. Vite incorpora la configuración que utiliza la aplicación durante la compilación; cambiar una variable por sí solo no actualiza una publicación anterior.

## Desarrollo local

Copia `.env.example` a `.env.local` y rellena los dos valores reales. Reinicia Vite después de cambiarlos. `.env.local` está excluido de Git y no debe subirse al repositorio. No hace falta modificar ningún archivo de código para guardar las credenciales.

## Qué se puede utilizar en el frontend

La Project URL y la clave **publishable** son configuración pública diseñada para aplicaciones de navegador. No son una contraseña administrativa y no sustituyen los permisos de acceso.

Nunca uses la contraseña de la base de datos, una clave `service_role`, una clave `sb_secret_` ni un token personal de Supabase en variables `VITE_*`: cualquier valor utilizado desde Vite puede quedar visible en el navegador, aunque se haya almacenado como un secret de GitHub.

Antes de habilitar cuentas y documentos personales, debemos implementar Supabase Auth, las tablas necesarias y sus reglas de **Row Level Security (RLS)** para que cada usuario solo pueda consultar o modificar documentos autorizados. También hay que configurar las URL de redirección y el proveedor Google en Supabase. Guardar estas dos variables no realiza esos pasos automáticamente.
