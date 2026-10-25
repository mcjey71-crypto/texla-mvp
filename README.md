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
# Con el servidor de desarrollo ejecutándose:
npm run test:e2e
```

Las pruebas de navegador utilizan `/usr/bin/chromium`. En otra máquina, define `CHROMIUM_PATH` con la ruta de Chromium instalado. Las pruebas unitarias cubren delimitadores matemáticos, escape de texto y exportación. Las pruebas de navegador cubren edición, pegado desde el portapapeles, fórmulas, persistencia, descarga, aislamiento del historial entre documentos y pantalla móvil.

## Funciones

- Documentos múltiples, búsqueda, renombrado y plantilla académica.
- Editor visual con títulos, listas, negrita, cursiva, subrayado y alineación.
- Matemáticas visuales con teclado MathLive, plantillas y edición al hacer clic. Las ecuaciones en bloque se muestran sin recuadro, centradas y numeradas automáticamente a la derecha; la numeración se recalcula al editar y se conserva al imprimir. Las fórmulas en línea no llevan número. La exportación usa el entorno `equation` para numeración nativa en LaTeX.
- Pegado de texto con fórmulas delimitadas por `$$…$$`, `\[…\]`, `\(…\)` o `$…$`.
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
