# Texla Docs

Editor visual de documentos formales con exportación a LaTeX. Primera versión gratuita, construida con React, TypeScript, Tiptap, KaTeX y MathLive.

## Desarrollo

Requiere Node.js 22 o posterior y npm. Se verificó con Node.js 24.

```sh
npm ci
npm run dev -- --port 5173
```

## Validación

```sh
npm test
npm run build
# El servidor de desarrollo se inicia automáticamente si hace falta:
npm run test:e2e
npm run collab:check
npm run test:collaboration
npm run test:accounts
# Opcional: requiere TeX Live con español y los paquetes del preámbulo
npm run test:latex
```

Las pruebas de navegador utilizan `/usr/bin/chromium`. En otra máquina, define `CHROMIUM_PATH` con la ruta de Chromium instalado. Las pruebas unitarias cubren delimitadores matemáticos, escape de texto y exportación. Las pruebas de navegador cubren edición, pegado desde el portapapeles, fórmulas, persistencia, descarga, aislamiento del historial entre documentos y pantalla móvil.

## Funciones

- Documentos múltiples, búsqueda, renombrado y plantillas originales de tesis, artículo académico e informe técnico.
- Tablas visuales con encabezados y controles para añadir/eliminar filas y columnas; exportación a LaTeX.
- Secciones y subsecciones numeradas, índice automático navegable y saltos de página.
- Buscar y reemplazar texto, con distinción de mayúsculas y deshacer. Ctrl/Cmd+F abre la herramienta.
- Formato por documento: A4/Carta, márgenes, tamaño del texto e interlineado. Se conserva al imprimir y exportar.
- Copias editables `.texla.json` para descargar y abrir trabajos como documentos nuevos, sin reemplazar los existentes.
- Editor visual con títulos, listas, negrita, cursiva, subrayado y alineación izquierda, centrada, derecha o justificada. Usa el botón Justificar o Ctrl+Mayús+J; en pantallas pequeñas, el selector de alineación. La elección se guarda con el documento y se conserva al imprimir. La exportación LaTeX justifica por defecto y aplica las otras alineaciones por párrafo.
- Matemáticas visuales con teclado MathLive, plantillas y edición al hacer clic. Las ecuaciones en bloque se muestran sin recuadro, centradas y numeradas automáticamente a la derecha; la numeración se recalcula al editar y se conserva al imprimir. Las fórmulas en línea no llevan número. La exportación usa el entorno `equation` para numeración nativa en LaTeX.
- Pegado de texto con fórmulas delimitadas por `$$…$$`, `\[…\]`, `\(…\)` o `$…$`.
- Biblioteca de referencias por documento, búsqueda de metadatos por DOI y estilos APA 7, IEEE y Vancouver (NLM). En los estilos numéricos, la misma fuente reutiliza su número; eliminar citas renumera las restantes. APA usa autor-fecha y bibliografía alfabética. Los enlaces normalizados y DOI detectan fuentes ya registradas.
- Exportación `.tex` con `article`, `amsmath`, `amssymb` y español; impresión/PDF mediante navegador.
- Compartir por enlace con edición simultánea, cursores, guardado en servidor y reconexión. Requiere activar el servidor Cloudflare incluido; consulta [la guía de colaboración](docs/collaboration.md).
- Guardado local para documentos sin cuenta y copias de recuperación. Con sesión iniciada, los nuevos documentos privados se guardan también en Supabase; al compartir, se crea una versión colaborativa en Cloudflare. La búsqueda por DOI consulta Crossref y DataCite sin clave de API. Las fuentes tipográficas se sirven localmente.
- Diseño adaptable en marfil y verde bosque. Identidad visual en `public/texla-brand.png`.

## Límites de esta versión

Los documentos sin cuenta se guardan en este navegador y origen; los privados de una cuenta se guardan en Supabase y los compartidos se sincronizan con Cloudflare. Borrar los datos del navegador elimina las copias locales y los permisos recordados; descarga copias para conservar el trabajo. Hay cuentas con Google/correo y una biblioteca privada mediante Supabase, después de activar las tablas y proveedores. No hay invitaciones por correo a documentos compartidos ni pagos. La colaboración usa enlaces con permiso de edición y necesita una cuenta gratuita de Cloudflare para activar el backend incluido. La aplicación convierte fórmulas compatibles con KaTeX; no interpreta documentos LaTeX completos ni OCR de imágenes. El pegado matemático conserva texto y fórmulas, pero no interpreta todo Markdown. La exportación conserva estructura, tablas, ecuaciones y formato de página; tipografía del editor y zoom son preferencias de visualización. El índice visual se actualiza con los encabezados, pero solo el compilador TeX calcula sus números de página. PDF usa el motor de impresión del navegador, no un compilador TeX. La compilación de ejemplos se comprueba con `npm run test:latex`; requiere `pdflatex`, español de Babel y los paquetes del preámbulo. El índice requiere dos pasadas. Esto no añade un compilador al sitio web.

## Entorno en la nube

Usar el checkout existente en `/workspace/texla-mvp`; cada tarea ya está aislada, no crear worktrees salvo petición explícita. Instalar con `npm ci --cache /workspace/.npm`, ejecutar las pruebas unitarias y compilar. Iniciar Vite en el puerto 5173 y comprobar la respuesta HTTP y el editor en Chromium. Los procesos deben reiniciarse después de restaurar un entorno. Los archivos de fuente y el lockfile deben conservarse.

## Publicación gratuita en GitHub Pages

GitHub Pages ofrece alojamiento gratuito para repositorios públicos. El repositorio puede almacenar el código; Pages sirve el editor desde una URL pública. No convierte el guardado local en almacenamiento en la nube.

1. En GitHub, abre `Settings → Pages` y selecciona **GitHub Actions** como fuente de publicación.
2. El workflow `.github/workflows/pages.yml` compila, prueba y publica en cada push a `main`. Si el primer intento ocurrió antes de activar Pages, abre `Actions → Publish Texla Docs to GitHub Pages → Run workflow`.
3. La URL prevista para este repositorio es `https://mcjey71-crypto.github.io/texla-mvp/`. Úsala cuando el workflow de publicación finalice correctamente.

La compilación usa la ruta base del repositorio, también para las fuentes de MathLive. Para reproducirla: `npm run build -- --base=/texla-mvp/`. La aplicación no pide datos de pago ni llama a APIs de IA. El backend colaborativo se despliega por separado con el workflow **Publish collaboration server**. Su activación y sus cuotas se explican en [docs/collaboration.md](docs/collaboration.md).

## Configuración de Supabase

Texla integra Supabase Auth y una biblioteca privada con guardado automático, aislamiento por propietario y detección de conflictos entre dispositivos. Consulta [Supabase: activación del SQL, Google/correo, cuotas y límites](docs/supabase.md). El workflow utiliza `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; el administrador debe ejecutar la migración y configurar los proveedores antes de usar las cuentas.

## Referencias y bibliografía

Desde **Referencias**, pega un DOI y pulsa **Buscar datos por DOI**. Crossref y DataCite permiten recuperar metadatos sin API key ni IA. Revisa los campos, elige **APA 7**, **IEEE** o **Vancouver (NLM)** y guarda o inserta la cita. Puedes editar fuentes guardadas y reutilizarlas sin duplicados. Los datos ausentes se completan manualmente.

El estilo se guarda por documento y se aplica a citas, bibliografía, impresión y `.tex`. La bibliografía incluye solo fuentes citadas. Al eliminar la última cita de una fuente, esta desaparece de la bibliografía pero permanece en la biblioteca. Deshacer restaura las citas. Copiar y pegar citas entre documentos conserva sus datos; los documentos anteriores siguen siendo compatibles.

El formato usa **citeproc-js** y estilos del proyecto **Citation Style Language (CSL)**. La exportación incluye entradas ya formateadas y enlaces internos con `hyperref`; no requiere BibTeX. Se verifican artículos académicos por DOI. Las convenciones bibliográficas están en inglés y los títulos mantienen el idioma original; revisa los datos recuperados y los requisitos particulares de tu institución.

La detección reconoce DOI solos, con `doi:` o enlaces de `doi.org`/`dx.doi.org`. Para enlaces web elimina parámetros de seguimiento y fragmentos, y conserva rutas y parámetros que distinguen obras. Una página editorial y un DOI pueden representar la misma obra sin que el sistema lo detecte. Los enlaces web comunes permiten entrada manual, sin búsqueda automática.

Consulta [guías revisadas, procedencia de estilos, licencias, pruebas y límites](docs/references.md). No hay importación desde Mendeley. Al compartir un documento se sincroniza su biblioteca de referencias; no hay biblioteca global de una cuenta.

## Mejoras para documentos formales

La barra **Tabla · Índice automático · Salto de página · Buscar y reemplazar · Formato del documento · Copias editables** reúne las nuevas funciones. Usa **Plantillas** para empezar una tesis, artículo o informe. Las plantillas son puntos de partida, no formatos oficiales de instituciones.

Consulta la [investigación de Overleaf, LyX y TeXstudio, funciones incorporadas y límites](docs/editor-research.md).

## Importación de documentos

Usa **Importar documento** para convertir Word, PDF (incluidos escaneados con OCR opcional), ODT, Markdown, TXT, HTML, LaTeX y copias de Texla en un documento editable. La conversión se realiza en el navegador y permite revisar el resultado antes de guardarlo. Consulta [formatos, límites y funcionamiento del OCR](docs/importing.md).
