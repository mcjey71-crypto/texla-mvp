# Importar documentos a Texla

Pulsa **Importar documento** en la barra de herramientas o en el menú lateral, selecciona un archivo y pulsa **Convertir documento**. Revisa la vista previa y los avisos. Al pulsar **Crear documento editable**, se abre una copia nueva; los documentos existentes se conservan. Puedes editarla visualmente y elegir **Exportar → Documento LaTeX** para descargar el `.tex`.

| Archivo | Contenido recuperado | Qué revisar |
| --- | --- | --- |
| Word `.docx` | Títulos, párrafos, listas, negrita/cursiva, tablas y ecuaciones nativas habituales | Estilos de página, imágenes, notas, citas y matemáticas avanzadas. Los `.doc` antiguos deben guardarse como `.docx`. |
| PDF con texto | Texto seleccionable, agrupación aproximada de líneas/párrafos y separaciones de página | Orden de columnas, tablas y ecuaciones. No reconstruye el diseño original. |
| PDF escaneado | Texto mediante OCR opcional en español e inglés | Ortografía, números y orden. El OCR de texto no convierte fórmulas de una imagen en ecuaciones LaTeX. |
| OpenDocument `.odt` | Títulos, párrafos, listas y tablas básicas | Estilos, celdas combinadas, objetos incrustados, fórmulas e imágenes. |
| Markdown `.md`, `.markdown` | Títulos, listas, tablas, énfasis y fórmulas delimitadas | Imágenes y extensiones propias de otras aplicaciones. |
| Texto `.txt` | Párrafos y fórmulas entre `$…$`, `$$…$$`, `\(…\)` y `\[…\]` | Formato y estructura de párrafos. Usa UTF-8. |
| HTML `.html`, `.htm` | Estructura y formato básico, tablas y enlaces seguros | Estilos complejos; las imágenes se sustituyen por indicaciones de ubicación. Se eliminan scripts y contenido ejecutable. |
| LaTeX `.tex` | Títulos, listas, énfasis, ecuaciones y comandos habituales | Es una importación parcial, no un compilador: los entornos/macros no compatibles quedan como texto con un aviso. No carga `.bib`, archivos incluidos ni imágenes. |
| Texla `.texla.json` | Contenido, ecuaciones, referencias vinculadas y formato compatibles | La copia importada no contiene sesiones ni permisos de colaboración. |

Las referencias de otros formatos se conservan como texto, cuando están presentes en el contenido recuperable; no pasan automáticamente a ser citas vinculadas. Usa **Referencias** y la búsqueda DOI para registrarlas. Conserva siempre el archivo original, especialmente si contiene gráficos o ecuaciones complejas.

## PDF escaneado

Marca **Reconocer páginas escaneadas (OCR)** antes de convertir. Solo se aplica a las páginas con poco o ningún texto seleccionable. Los PDF mixtos conservan el texto de las otras páginas. En páginas que mezclan texto seleccionable con imágenes de texto, esas imágenes no se reconocen automáticamente.

El reconocimiento funciona en el navegador con Tesseract; los modelos de español/inglés y el motor se descargan desde el propio sitio de Texla cuando se necesitan. No se envía el archivo a una IA ni a un servicio de conversión. La primera descarga puede ocupar decenas de MB y una tesis escaneada puede tardar varios minutos. Necesitas conexión para obtener estos recursos la primera vez.

Los PDF protegidos con contraseña deben desbloquearse antes de importarlos. En archivos dañados o demasiado grandes, Texla muestra un error y conserva el documento abierto.

## Almacenamiento y límites

- Hasta **20 MB** por archivo y **100 páginas** por PDF; divide los archivos mayores.
- Los documentos Office se limitan a **32 MB descomprimidos** y 3.000 entradas del archivo comprimido.
- Los textos/HTML intermedios se limitan a un millón de caracteres y la estructura final usa los límites de las copias editables: hasta 5 MB, 50.000 nodos y 30 niveles.
- El espacio total local depende del navegador. Si no queda espacio, no se sustituye el documento actual.
- Con sesión iniciada, **Guardar también en mi cuenta** está marcado inicialmente para documentos de hasta 1 MiB. Puedes desmarcarlo para conservar la copia en ese navegador. Los documentos mayores se ofrecen solo como copia local: divídelos para guardarlos en la nube. Se mantienen las cuotas de cuenta y las reglas de acceso de Supabase.
- El archivo original no se almacena en Supabase ni Cloudflare: solo el contenido convertido, si eliges guardarlo en tu cuenta. Compartir sigue creando una versión colaborativa independiente.

## Desarrollo

`npm run dev` y `npm run build` preparan automáticamente los recursos PDF/OCR con `scripts/prepare-import-assets.mjs`. Están en `public/import-assets/`, excluido de Git y copiado al sitio por Vite. Los importadores y el motor PDF se cargan por separado; las personas que solo redactan no descargan los modelos OCR.

Las pruebas de navegador cubren documentos Word con ecuaciones, PDF seleccionable/escaneado/protegido, ODT, Markdown, HTML no confiable, texto y LaTeX; verifican edición y descarga `.tex`. Los ejemplos pequeños están en `tests/fixtures/import/`. Para regenerarlos se puede ejecutar `scripts/create-import-fixtures.py` con Python, python-docx, reportlab y Pillow; no es necesario para ejecutar las pruebas.
