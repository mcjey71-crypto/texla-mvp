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
```

Las pruebas de navegador utilizan `/usr/bin/chromium`. En otra máquina, define `CHROMIUM_PATH` con la ruta de Chromium instalado. Las pruebas unitarias cubren delimitadores matemáticos, escape de texto y exportación. Las pruebas de navegador cubren edición, pegado desde el portapapeles, fórmulas, persistencia, descarga, aislamiento del historial entre documentos y pantalla móvil.

## Funciones

- Documentos múltiples, búsqueda, renombrado y plantilla académica.
- Editor visual con títulos, listas, negrita, cursiva, subrayado y alineación izquierda, centrada, derecha o justificada. Usa el botón Justificar o Ctrl+Mayús+J; en pantallas pequeñas, el selector de alineación. La elección se guarda con el documento y se conserva al imprimir. La exportación LaTeX justifica por defecto y aplica las otras alineaciones por párrafo.
- Matemáticas visuales con teclado MathLive, plantillas y edición al hacer clic. Las ecuaciones en bloque se muestran sin recuadro, centradas y numeradas automáticamente a la derecha; la numeración se recalcula al editar y se conserva al imprimir. Las fórmulas en línea no llevan número. La exportación usa el entorno `equation` para numeración nativa en LaTeX.
- Pegado de texto con fórmulas delimitadas por `$$…$$`, `\[…\]`, `\(…\)` o `$…$`.
- Biblioteca de referencias por documento, citas numéricas por primera aparición y bibliografía automática. La misma fuente reutiliza su número; eliminar citas renumera las restantes. Los enlaces normalizados y DOI detectan fuentes ya registradas.
- Exportación `.tex` con `article`, `amsmath`, `amssymb` y español; impresión/PDF mediante navegador.
- Guardado automático en `localStorage`. No requiere claves ni servicios externos. Las fuentes se sirven localmente.
- Diseño adaptable en marfil y verde bosque. Identidad visual en `public/texla-brand.png`.

## Límites de esta versión

Los documentos se guardan únicamente en este navegador y origen. Borrar sus datos elimina los documentos; exporta una copia para conservarlos. No hay cuentas, backend, sincronización, colaboración ni pagos. La aplicación convierte fórmulas compatibles con KaTeX; no interpreta documentos LaTeX completos ni OCR de imágenes. El pegado matemático conserva texto y fórmulas, pero no interpreta todo Markdown. La exportación conserva la estructura básica y ecuaciones; los ajustes visuales de fuente, zoom y formato de página son preferencias de visualización. PDF usa el motor de impresión del navegador, no un compilador TeX. No se ha verificado compilación con una distribución TeX.

## Entorno en la nube

Usar el checkout existente en `/workspace/texla-mvp`; cada tarea ya está aislada, no crear worktrees salvo petición explícita. Instalar con `npm ci --cache /workspace/.npm`, ejecutar las pruebas unitarias y compilar. Iniciar Vite en el puerto 5173 y comprobar la respuesta HTTP y el editor en Chromium. Los procesos deben reiniciarse después de restaurar un entorno. Los archivos de fuente y el lockfile deben conservarse.

## Publicación gratuita en GitHub Pages

GitHub Pages ofrece alojamiento gratuito para repositorios públicos. El repositorio puede almacenar el código; Pages sirve el editor desde una URL pública. No convierte el guardado local en almacenamiento en la nube.

1. En GitHub, abre `Settings → Pages` y selecciona **GitHub Actions** como fuente de publicación.
2. El workflow `.github/workflows/pages.yml` compila, prueba y publica en cada push a `main`. Si el primer intento ocurrió antes de activar Pages, abre `Actions → Publish Texla Docs to GitHub Pages → Run workflow`.
3. La URL prevista para este repositorio es `https://mcjey71-crypto.github.io/texla-mvp/`. Úsala cuando el workflow de publicación finalice correctamente.

La compilación usa la ruta base del repositorio, también para las fuentes de MathLive. Para reproducirla: `npm run build -- --base=/texla-mvp/`. La aplicación no pide datos de pago ni llama a APIs de IA. Cuentas, documentos sincronizados y colaboración requerirían un backend adicional.

## Referencias y bibliografía

Desde **Referencias** en la barra del editor, introduce el enlace o DOI, título, autoría y año. Puedes guardar una fuente sin citarla, insertar una cita en la posición actual o buscar y reutilizar fuentes de la biblioteca. La bibliografía al final del documento incluye únicamente las fuentes citadas, en orden de primera aparición. Si se elimina la última cita de una fuente, esta sale de la bibliografía pero permanece en la biblioteca. Deshacer restaura las citas y recalcula los números.

Las citas guardan una identidad estable y sus datos, por lo que copiar y pegar entre documentos de Texla conserva la fuente. Los documentos anteriores siguen siendo compatibles. El archivo `.tex` incluye `\cite`, `thebibliography`, `\bibitem` y enlaces con `hyperref`; compilar dos veces en un motor LaTeX resuelve las referencias cruzadas. La impresión del navegador incluye citas y bibliografía.

La detección reconoce DOI escritos solos, con `doi:` o mediante `doi.org`/`dx.doi.org`. Para enlaces web, elimina fragmentos y parámetros conocidos de seguimiento, ordena los parámetros restantes y unifica HTTP/HTTPS para comparar. Conserva las rutas y parámetros que pueden identificar obras distintas. Un DOI y una página editorial con otra dirección pueden representar la misma obra sin que el sistema lo detecte. No se consulta la web, no se verifica la calidad de las fuentes y no se autocompletan sus metadatos. Esta versión usa citas numéricas; no incorpora estilos CSL/APA, importación desde Mendeley ni una biblioteca compartida en la nube.
