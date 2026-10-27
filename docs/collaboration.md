# Colaboración en Texla Docs

La implementación permite que varias personas escriban en el mismo documento, con nombres y cursores, guardado en el servidor y recuperación de cambios después de una desconexión. Incluye texto, tablas, ecuaciones, citas, biblioteca de referencias, estilo bibliográfico y formato del documento.

La publicación de este repositorio ya utiliza `https://texla-collaboration.mcjey71.workers.dev` como servidor predeterminado. En la web, abre **Compartir → Crear enlace de edición**; no necesitas introducir la dirección. La configuración se puede revisar con **Configuración de la conexión**. Los servidores guardados anteriormente en un navegador se conservan. La variable de GitHub `VITE_COLLABORATION_URL` permite sustituir el servidor predeterminado.

Antes de cada publicación, GitHub Actions comprueba la respuesta `/health`, la versión del protocolo y los permisos CORS para el origen de Texla. Esta comprobación no crea documentos ni envía contenido de usuarios.

**La página de GitHub Pages y el servidor son dos despliegues distintos.** Publicar la página no activa el servidor. Hace falta una cuenta de Cloudflare y desplegar el Worker una vez. No hay ningún servidor público de demostración ni se envían documentos privados al abrir la aplicación.

## Activación gratuita desde GitHub

1. Crea una cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up) y utiliza **Workers Free**. No hace falta comprar un dominio: se usa `workers.dev`. Si es tu primer Worker, configura el subdominio de Workers de la cuenta.
2. En Cloudflare, copia el **Account ID** de la cuenta que alojará Texla. En tu perfil → **API Tokens**, crea un token usando la plantilla **Edit Cloudflare Workers**, limitado a esa cuenta. El token permite desplegar código: no lo pegues en chats, documentos ni en el código fuente.
3. En [Settings → Secrets and variables → Actions](https://github.com/mcjey71-crypto/texla-mvp/settings/secrets/actions), añade el token como **Repository secret** llamado `CLOUDFLARE_API_TOKEN`. En la pestaña **Variables**, añade `CLOUDFLARE_ACCOUNT_ID` con el identificador de cuenta.
4. En [Actions → Publish collaboration server](https://github.com/mcjey71-crypto/texla-mvp/actions/workflows/collaboration.yml), pulsa **Run workflow** sobre `main`. Esto crea el Worker y su almacenamiento SQLite de Durable Objects. Solo se ejecuta manualmente; los commits de la página no lo despliegan automáticamente.
5. Al finalizar, copia la dirección HTTPS que muestra el paso **Deploy to Cloudflare Workers**, por ejemplo `https://texla-collaboration.tu-subdominio.workers.dev`.
6. Abre [Texla Docs](https://mcjey71-crypto.github.io/texla-mvp/), pulsa **Compartir**, introduce esa dirección y tu nombre, y pulsa **Crear enlace de edición**. El navegador recuerda el servidor. Comparte el enlace de edición con tu equipo.
7. Para que nadie tenga que configurar la dirección al crear nuevos documentos, añade también la **variable de Actions** `VITE_COLLABORATION_URL` con esa URL y vuelve a ejecutar **Publish Texla Docs to GitHub Pages**. Es una dirección pública, no una contraseña.

Los invitados solo abren el enlace: no necesitan cuenta de Cloudflare ni configurar el servidor. Para comprobar que el despliegue funciona, abre el enlace en otro navegador o en una ventana privada, escribe desde ambos y espera el estado **Guardado en el servidor**. Comprueba también que los cambios reaparecen al cerrar y volver a abrir.

Alternativa desde una terminal con Node.js 24:

```sh
npm ci
npx wrangler login
npm run collab:deploy
```

El inicio de sesión se hace en el navegador del propietario. `wrangler.jsonc` permite el origen `https://mcjey71-crypto.github.io`. Si cambia el dominio de Texla, actualiza `ALLOWED_ORIGINS` y vuelve a desplegar. La variable de Vite se incorpora durante la compilación, no después.

## Uso y permisos

- Compartir crea una versión colaborativa y conserva el original local. Continúa trabajando en el documento marcado **Documento compartido**.
- Cualquier persona que tenga el enlace puede editar, descargar y reenviar ese enlace. Es un acceso por enlace, no una invitación restringida a un correo electrónico. Los nombres de participantes son elegidos por ellos, no identidades verificadas.
- El navegador que crea el enlace conserva un permiso adicional para **Dejar de compartir**. La acción exige confirmación, desconecta a los participantes y borra el estado activo del documento en el servidor. No puede retirar copias ya descargadas o guardadas por otros participantes. Cloudflare puede conservar recuperación del almacenamiento según su política.
- El permiso de administración se conserva en ese navegador: borrar sus datos puede perderlo. Este MVP no tiene cuentas ni recuperación de propietario entre dispositivos. Un administrador de Cloudflare conserva control sobre el servicio.
- El token de edición va en el fragmento `#share=…`, no en una consulta enviada a GitHub Pages, y se retira de la barra de direcciones al abrirlo. El permiso administrativo nunca se incluye en el enlace ni en las copias `.texla.json`.
- La aplicación guarda una copia CRDT en IndexedDB y una representación local del documento. Si se corta la conexión mientras editas, puedes seguir escribiendo en el documento abierto; al reconectar se combinan los cambios. La carga de la página sin internet desde cero no está implementada. El almacenamiento del navegador puede borrarse o alcanzar su cuota: descarga copias para respaldar trabajo importante.
- **Guardado en el servidor** se muestra tras recibir la confirmación de almacenamiento, no solo al enviar un cambio. Una desconexión, rechazo o límite muestra un estado distinto. Si el enlace deja de funcionar, todavía puedes exportar la copia que tengas abierta.
- Deshacer en el editor compartido afecta a tus cambios de contenido y no deshace las aportaciones ajenas. Cambios simultáneos del mismo ajuste de formato o de una misma referencia se resuelven por campo/registro; no existe un diálogo de conflictos. El estilo bibliográfico y la numeración se recalculan a partir del contenido compartido.
- No hay acceso de solo lectura, cuentas, comentarios, historial navegable, recuperación automática de versiones ni cifrado de extremo a extremo. HTTPS protege el transporte; el servidor procesa y almacena el documento.

## Base de datos, cuotas y costes

Cada documento usa un Durable Object con una fila SQLite que conserva el estado Yjs y hashes de los permisos. El Worker acepta WebSockets autenticados y usa hibernación para reducir consumo durante la inactividad. No se guarda el contenido en el repositorio GitHub ni se consulta una IA.

Límites deliberados de esta primera versión:

| Recurso | Límite implementado |
| --- | --- |
| Tamaño del estado compartido | 1 MiB por documento, incluyendo datos de sincronización |
| Conexiones por documento | 12, incluyendo pestañas del mismo usuario |
| Nuevos documentos por IP | Aproximadamente 5 por minuto por ubicación Cloudflare |
| Nuevos documentos del servidor | 50 por día UTC y 500 creaciones acumuladas |

Las cuotas de creación acotan el uso anónimo del MVP y no equivalen a capacidad ilimitada ni a protección completa contra abuso. Desactivar un enlace no reinicia el contador acumulado. Antes de ampliar estos topes o abrir el servicio a gran escala, añade cuentas, cuotas por usuario, recuperación de propiedad y supervisión de consumo. Los límites están en `server/index.ts` y `wrangler.jsonc`.

Según la documentación oficial consultada el **27 de octubre de 2026**, Workers Free admite Durable Objects con SQLite. Sus límites publicados incluyen **5 GB de almacenamiento total**, **100 000 filas escritas al día**, **5 millones de filas leídas al día**, **100 000 solicitudes diarias de Durable Objects** y **13 000 GB-s de ejecución al día**. Las solicitudes del Worker tienen su propia cuota. Cada lote de cambios aceptado escribe una fila; el tamaño de la base no es el único límite relevante.

En Free, al superar una cuota, las operaciones correspondientes fallan; las cuotas diarias se restablecen a las 00:00 UTC (**19:00 de Lima del día anterior**). La aplicación conserva los cambios locales y avisa si no puede sincronizarlos. Una cuota de almacenamiento requiere liberar datos o cambiar de plan; no se resuelve solo esperando al día siguiente. El código no activa planes de pago. Si el propietario cambia la cuenta a Paid, se aplican las tarifas de Cloudflare y debe supervisar su consumo.

Fuentes oficiales revisadas en el repositorio de documentación de Cloudflare:

- [Precios y comportamiento al superar cuotas](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/platform/pricing.mdx).
- [Tabla de cuotas y almacenamiento SQLite](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx).
- [WebSockets con hibernación](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/best-practices/websockets.mdx).
- [Límites de frecuencia por ubicación](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/runtime-apis/bindings/rate-limit.mdx).

## Desarrollo y validación

```sh
npm ci
npm run collab:dev
# En otra terminal:
npm run dev
```

Abre `http://127.0.0.1:5173`, pulsa Compartir y utiliza `http://127.0.0.1:8787` como servidor. El entorno `test` solo admite esos orígenes locales y usa almacenamiento local en `.wrangler/`; nunca debe desplegarse como producción.

```sh
npm test
npm run collab:check
npm run test:e2e
npm run test:collaboration
npm run build -- --base=/texla-mvp/
```

Las pruebas de colaboración levantan la aplicación y el Worker local y utilizan contextos independientes de Chromium. Cubren sincronización, deshacer, formato, tablas, ecuaciones, citas, desconexión, recuperación de cambios pendientes tras cerrar una pestaña, avisos cuando el navegador bloquea IndexedDB, controles de acceso, revocación y acceso móvil. También se verificó la recuperación del estado después de reiniciar completamente el Worker local. La prueba local no demuestra que el Worker esté desplegado en la cuenta de Cloudflare: esa comprobación debe hacerse después de la activación.
