# Cuentas y biblioteca privada de Texla

Texla integra Supabase Auth para entrar con Google o mediante un enlace enviado al correo. Cada cuenta tiene una biblioteca privada en PostgreSQL, guardado automático y reglas RLS que comprueban el propietario. Cloudflare continúa guardando y sincronizando las versiones compartidas por enlace.

**Publicar la página no crea las tablas ni configura los proveedores de acceso.** Hace falta aplicar el SQL y completar los ajustes siguientes en el proyecto Supabase. No se necesita enviar al chat la contraseña de la base de datos ni una clave administrativa.

## 1. Activar la base de datos

1. Abre tu proyecto en el panel de Supabase.
2. Entra en **SQL Editor → New query**.
3. Copia el archivo completo [202610270001_private_documents.sql](../supabase/migrations/202610270001_private_documents.sql) y pulsa **Run**.
4. Debe terminar sin errores. La migración crea `public.texla_documents`, el procedimiento de guardado y las reglas de acceso. No importa, reemplaza ni elimina documentos existentes de Texla. Se puede volver a ejecutar sobre el esquema creado por esta misma versión.

La migración se prueba con PostgreSQL mediante PGlite: usuarios A/B, lectura anónima, escritura y borrado ajenos, cambios de propietario, versiones en conflicto, documentos inválidos y cuotas. Esto verifica las reglas del archivo; no demuestra que ya se haya ejecutado en tu proyecto remoto.

## 2. Configurar las direcciones de acceso

En **Authentication → URL Configuration**:

- **Site URL:** `https://mcjey71-crypto.github.io/texla-mvp/`
- Añade esa misma dirección exacta a **Redirect URLs**.
- Solo para desarrollo, puedes añadir `http://localhost:5173/` y `http://127.0.0.1:5173/`.

La aplicación usa PKCE y devuelve el acceso a la ruta correcta de GitHub Pages. Abre los enlaces de correo en el mismo navegador desde el que los solicitaste. Si un enlace falla o caduca, solicita uno nuevo; no reutilices el código de acceso.

## 3. Habilitar Google

1. En [Google Cloud Console](https://console.cloud.google.com/), configura el proyecto y la pantalla de consentimiento de OAuth. Si la aplicación está en modo de prueba, añade como usuarios de prueba los correos que probarán Texla.
2. Crea un **OAuth Client ID** de tipo **Web application**.
3. En origen JavaScript autorizado, utiliza `https://mcjey71-crypto.github.io`.
4. En URI de redirección autorizada, pega la **Callback URL que muestra Supabase** en Authentication → Providers → Google, normalmente `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Esta dirección de Google es distinta de la dirección del sitio Texla.
5. En Supabase → Authentication → Providers → Google, habilita el proveedor y guarda allí el **Client ID** y **Client Secret** de Google. El secret va solo en Supabase, nunca en variables `VITE_*` ni en el repositorio.
6. Regresa a Texla → **Iniciar sesión → Actualizar**. Aparecerá **Continuar con Google** cuando el proveedor esté habilitado.

Para acceso por correo, habilita Email. Texla envía enlaces de entrada sin contraseña. El correo incorporado de Supabase tiene restricciones de prueba; para recibir usuarios ajenos al equipo del proyecto configura un proveedor SMTP adecuado y revisa sus cuotas. No se ha añadido SMS ni envío automático por WhatsApp.

## 4. Variables públicas de la página

La dirección pública de producción está fijada en [pages.yml](../.github/workflows/pages.yml): `https://ciesoqrffrdofyekrvck.supabase.co`. Este valor sustituye la variable anterior `VITE_SUPABASE_URL` de GitHub, que contenía una dirección inválida. Para cambiar de proyecto, actualiza esa línea del workflow y la clave pública correspondiente.

En [Settings → Secrets and variables → Actions → Variables](https://github.com/mcjey71-crypto/texla-mvp/settings/variables/actions), configura la clave:

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave pública completa `sb_publishable_…`, o la clave JWT antigua con rol `anon` |

Los valores se incorporan al compilar. Después de cambiarlos, ejecuta [Publish Texla Docs to GitHub Pages](https://github.com/mcjey71-crypto/texla-mvp/actions/workflows/pages.yml) sobre `main`. La publicación comprueba que la configuración usa una clave publicable o anon y que Supabase Auth responde; informa si Google todavía no está habilitado. No muestra la clave en los registros ni ejecuta migraciones.

Nunca uses una contraseña, una clave `service_role`, una `sb_secret_` ni un token personal en variables `VITE_*`. Aunque se guardase como secret de GitHub, un valor utilizado por Vite quedaría expuesto en el navegador. La clave publicable permite iniciar solicitudes; la autenticación y las reglas RLS determinan qué datos puede consultar o modificar cada usuario.

## Cómo usar la biblioteca

- Pulsa **Iniciar sesión**. Sin iniciar sesión, los documentos siguen funcionando como antes, guardados en el navegador.
- Con sesión iniciada, los documentos privados nuevos y las copias importadas se guardan automáticamente en tu cuenta. El estado cambia a **Guardado en tu cuenta** solo después de la confirmación del servidor.
- Abre **Mi cuenta** o **Mi biblioteca en la nube** para recuperar un documento desde otro dispositivo. El listado lateral muestra los documentos abiertos en ese navegador; el diálogo de biblioteca consulta los que están en Supabase.
- Para llevar trabajo anterior a la nube, abre **Mi cuenta → Documentos del navegador sin cuenta → Copiar a mi cuenta**. Solo se sube lo que elijas; los originales no se eliminan.
- Al salir de la cuenta, su biblioteca deja de mostrarse. Los borradores se conservan en un espacio local separado para esa cuenta, para recuperar cambios pendientes cuando vuelvas a entrar. No es cifrado local: evita conservar sesiones o borradores sensibles en dispositivos compartidos y elimina los datos del sitio cuando corresponda.
- Si una escritura falla, aparece un aviso y el documento abierto se conserva. Pulsa **Reintentar guardado**. No se anuncia guardado en la nube mientras haya errores o cambios pendientes.
- Si otro dispositivo modificó el mismo documento privado, Texla no sobrescribe esa versión. Usa **Guardar mis cambios como otro documento** para conservar ambas versiones; después puedes abrir el original actualizado desde la biblioteca.
- **Eliminar de la nube** pide confirmación y conserva cualquier copia abierta en el navegador. La eliminación libera cuota. Las copias exportadas siguen siendo independientes y no contienen sesiones, enlaces de colaboración ni permisos administrativos.

## Cuotas del piloto

Son límites de Texla, no promesas de capacidad del plan contratado:

| Recurso | Límite |
| --- | --- |
| Documentos privados por cuenta | 50 |
| Contenido privado por cuenta | 10 MiB |
| Un documento privado | 1 MiB |
| Contenido privado sumado entre cuentas | 250 MiB |

Las cuotas se comprueban dentro de la base de datos, también si alguien intenta omitir la interfaz. El límite global reserva margen para índices y otras estructuras; no mide el tamaño físico total del proyecto, ni sustituye las cuotas de Supabase sobre base de datos, tráfico o autenticación. Revisa el uso real en el panel antes de abrir el registro masivamente. El código no cambia el proyecto a un plan de pago.

Estos topes son independientes de los del [servidor colaborativo Cloudflare](collaboration.md). Al compartir, el mismo documento se sincroniza mediante Cloudflare; el registro de la cuenta conserva su identidad y el acceso colaborativo. Las cuotas de ambos servicios siguen aplicándose.

## Qué sigue pendiente

Esta entrega implementa cuentas y biblioteca privada; **los enlaces de colaboración existentes siguen otorgando edición a quien los tenga**. Iniciar sesión no convierte esos enlaces en invitaciones por correo ni en permisos de solo lectura. Compartir conserva el mismo ID y la misma fila de la biblioteca. El contenido colaborativo se sincroniza en Cloudflare; el registro privado de Supabase guarda un acceso y una instantánea para reabrir ese mismo documento desde otra sesión del propietario. El servidor colaborativo es la fuente de los cambios compartidos. Guardar una copia privada mediante la acción explícita de copia sigue creando un documento independiente.

Todavía no hay historial navegable de versiones, copias de seguridad automáticas fuera del proveedor, borrado de cuenta desde Texla, invitaciones nominales ni invitaciones con roles por documento. Los accesos compartidos creados desde un documento de la cuenta se recuperan entre dispositivos después de sincronizarse; los enlaces creados sin cuenta siguen dependiendo del navegador que los conserva. Conserva las copias `.texla.json`. Las revisiones de PostgreSQL detectan conflictos; no constituyen un historial recuperable de cada edición.

## Desarrollo y pruebas

Copia `.env.example` a `.env.local` y rellena los valores públicos. El archivo local está excluido de Git; reinicia Vite al cambiarlo.

```sh
npm ci
npm test
npm run test:accounts
npm run test:e2e
npm run test:collaboration
npm run build -- --base=/texla-mvp/
```

Las pruebas de cuentas usan respuestas simuladas de Auth/REST y verifican el flujo de la aplicación; las pruebas de políticas ejecutan SQL real en PGlite. El acceso real con Google, la recepción de correo y la aplicación de la migración deben verificarse en el proyecto configurado por el administrador.

## Compartir sin duplicar

El campo `collaboration` del sobre privado `payload` contiene servidor, sala y capacidades de edición/propietario. Solo el dueño de la fila puede leerlo mediante RLS; no se incorpora a las copias descargadas ni a la bibliografía. Se reutiliza la tabla y el procedimiento existentes, sin migración adicional. Al dejar de compartir, se elimina el acceso del registro y se conserva la misma identidad. Si falla la sincronización de la cuenta, se muestra un aviso: el enlace local puede funcionar, pero su recuperación desde otro dispositivo queda pendiente. Las pruebas comprueban el aislamiento RLS también para este campo.
