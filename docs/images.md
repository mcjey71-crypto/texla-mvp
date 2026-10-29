# Imágenes y figuras

En el editor, coloca el cursor y pulsa **Imagen**. Selecciona un PNG, JPG o WebP y añade pie de figura, fuente/crédito y descripción accesible. Ajusta el ancho y la alineación antes de insertar; **Editar imagen** permite cambiarlos después. **Quitar** elimina la figura del texto y **Deshacer** la recupera. Los números se recalculan en orden de aparición.

Se admiten hasta **20 figuras por documento** y archivos originales de hasta **10 MiB** y 40 megapíxeles. El navegador optimiza cada archivo a un máximo de **2400 píxeles por lado y 1 MiB**. WebP se convierte en PNG para facilitar la compilación LaTeX. Conserva los originales si necesitas su resolución completa. SVG, GIF y PDF no se aceptan como imágenes en esta primera versión.

## Activar las imágenes en la nube

La carga local funciona sin configuración adicional. Para guardar imágenes en documentos de una cuenta y compartirlas por enlace:

1. Abre el **SQL Editor** del mismo proyecto Supabase que usa Texla.
2. Copia y ejecuta **todo** [202610290001_image_storage.sql](../supabase/migrations/202610290001_image_storage.sql). Es idempotente: puede ejecutarse de nuevo. La integración de cuentas debe estar activada previamente según [la guía de Supabase](supabase.md).
3. Comprueba en **Storage** que aparece el bucket `texla-images`. No añadas permisos de escritura anónima ni cambies sus políticas.
4. Inicia sesión en Texla, crea un documento, inserta una imagen y espera a **Guardado en tu cuenta**. Ábrelo desde otro navegador. Si lo compartes, comprueba el enlace desde una ventana sin sesión.

No hacen falta nuevas claves de API ni cambios en el servidor Cloudflare. Se usa la sesión existente de Supabase. Si falta el bucket, Texla muestra un aviso y permite reintentar sin perder el documento ni el archivo seleccionado. El sitio de GitHub Pages no puede ejecutar esta migración: debe hacerlo el administrador del proyecto.

## Almacenamiento y acceso

- Sin cuenta, las imágenes se guardan en **IndexedDB** de ese navegador; el documento guarda únicamente referencias pequeñas. Borrar los datos del sitio también elimina esas imágenes. Descarga copias editables para conservarlas.
- En la nube, los archivos se guardan **cifrados con AES-256-GCM** en Supabase Storage. El bucket tiene lectura pública de los archivos cifrados: el contenido solo se descifra con la clave incluida en el documento. La clave no se coloca en la URL del archivo. La escritura, listado y eliminación requieren sesión y están restringidos a la carpeta del propietario; no se sobrescriben archivos.
- Los documentos privados conservan las claves en sus filas protegidas por RLS. Los compartidos las incluyen en la sesión colaborativa protegida por el enlace de edición. Quien recibe ese enlace puede ver y descargar las imágenes; conserva el enlace con el mismo cuidado que el documento. La colaboración y la aplicación procesan las claves: esto no es una promesa de cifrado de extremo a extremo frente al operador de la plataforma.
- Un invitado sin cuenta puede ver las figuras y editar sus pies. Para **añadir archivos nuevos** a un documento compartido debe iniciar sesión. Los archivos que sube se almacenan en su carpeta de Supabase.
- Compartir y guardar un documento local con imágenes en una cuenta sube primero los archivos y luego registra sus referencias. Las copias exportadas incluyen los archivos; no necesitan acceso al bucket original.
- Los archivos consumen la cuota de **Storage del proyecto Supabase**, aparte de las cuotas del JSON en la base de datos. El límite de 1 MiB por documento en la nube sigue aplicándose al texto y sus metadatos, no a los archivos de imagen. El plan gratuito tiene capacidad y transferencia limitadas: consulta **Usage** en Supabase; no hay almacenamiento ilimitado ni cuota separada del proveedor para cada usuario de Texla.

Quitar una figura o borrar un documento **no borra automáticamente el archivo de Storage ni su caché local**, porque podría seguir en otra copia o ser necesario para deshacer. Esta versión todavía no incluye recolección automática de archivos sin uso ni un medidor de cuota de imágenes. Las cargas canceladas pueden dejar archivos sin referencia. Para limpiar Storage manualmente, verifica primero que ningún documento o copia activa dependa del archivo. Revocar un enlace no retira imágenes ya descargadas por sus invitados.

## Exportación e importación

- **Imprimir / guardar como PDF** prepara las imágenes antes de abrir la impresión. Los controles de edición no se imprimen.
- **Documento LaTeX** descarga un ZIP cuando hay figuras, con `documento.tex`, `imagenes/` y una nota de compilación. Extrae todo y compila con pdfLaTeX, XeLaTeX o LuaLaTeX; `graphicx` y `figure` conservan imagen, ancho, alineación, numeración, pie y fuente. TeX puede mover las figuras para distribuir las páginas. Sin imágenes, se sigue descargando un `.tex`.
- **Copia editable de Texla** incorpora las imágenes en un `.texla.json` de hasta **32 MiB**, sin permisos de colaboración ni claves del almacenamiento remoto. Al abrirla se crean archivos locales con identidades nuevas. No depende del navegador original.
- La importación de Word, PDF, ODT, HTML y proyectos `.tex` sigue sin recuperar automáticamente sus imágenes. Puedes añadirlas después con **Imagen**. Esta función no interpreta un flujograma ni convierte una fotografía de una fórmula en matemáticas editables.

## Verificación

Las pruebas cubren selección y rechazo de archivos, edición de tamaño y pie, persistencia, renumeración/deshacer, copia portable, ZIP, impresión, reapertura en otra cuenta/dispositivo, invitados compartidos y error/reintento de bucket ausente. Las pruebas de RLS ejecutan las políticas en PostgreSQL local con PGlite. Las pruebas de cuentas simulan Supabase Storage y usan el servidor colaborativo local; no certifican que la migración ya esté aplicada en producción. `npm run test:latex` compila también una figura real con pdfLaTeX y XeLaTeX.
