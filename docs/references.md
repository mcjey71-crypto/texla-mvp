# Referencias por DOI y estilos bibliográficos

## Uso

Abre **Referencias**, pega un DOI (por ejemplo `10.1038/nphys1170`) o su enlace `https://doi.org/…` y pulsa **Buscar datos por DOI**. Revisa título, autoría, año y los **Datos de publicación**. Elige **APA 7**, **IEEE** o **Vancouver (NLM)** y guarda o inserta la cita. **Editar** actualiza los datos de una fuente en todas sus citas. El estilo se guarda por documento; los documentos anteriores conservan IEEE como estilo inicial.

Las fuentes se identifican por DOI normalizado o URL. Reutilizar la misma fuente no duplica la bibliografía. Solo aparecen las fuentes citadas: al borrar la última cita se retira la entrada, pero la fuente permanece en la biblioteca. IEEE y Vancouver recalculan números por primera aparición; APA ordena alfabéticamente y utiliza autor-fecha, incluyendo desambiguación de año (`2024a`, `2024b`). La elección se aplica a la vista, impresión/PDF y exportación `.tex`.

## Servicios y privacidad

No requiere cuenta, clave API, IA ni servidor propio. Se consulta `GET https://api.crossref.org/works/{doi}` y, únicamente si responde 404, `GET https://api.datacite.org/dois/{doi}`. Se codifica el identificador para la URL y se verifica que la respuesta corresponda al DOI solicitado. Solo se envía el DOI, además de los datos normales de una conexión HTTP; no se envía el contenido del documento. Los enlaces web ordinarios admiten entrada manual, no extracción automática.

La consulta tiene un límite de 15 segundos, se cancela al cambiar de DOI o cerrar el diálogo, no reintenta automáticamente los errores y conserva hasta 100 resultados en memoria por sesión. Un error 429 muestra la limitación del proveedor. Las fuentes ya guardadas siguen disponibles sin conexión; nuevos DOI requieren internet. Crossref y DataCite no cubren todas las agencias de DOI ni garantizan metadatos completos. Esta integración no obtiene el PDF ni verifica la calidad científica de un artículo.

Documentos, estilo y biblioteca se guardan en `localStorage`, en este navegador. No se ha añadido una base de datos remota. Los límites de almacenamiento local existentes siguen aplicando.

## Guías revisadas y decisiones

Revisión: 26 de octubre de 2026. Se consultaron los textos completos de las siguientes páginas y las definiciones CSL indicadas abajo:

- **APA 7**: [Purdue OWL, reglas básicas](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/reference_list_basic_rules.html) y [artículos en publicaciones periódicas](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/reference_list_articles_in_periodicals.html). Autoría con apellidos e iniciales, año entre paréntesis, revista y volumen en cursiva, DOI como URL, orden alfabético, sangría francesa de 1,27 cm y doble interlineado. El motor aplica las reglas de autoría y desambiguación de APA 7. Se comprueba también un ejemplo bibliográfico de la guía en una prueba automatizada.
- **IEEE**: [Purdue OWL, referencias](https://owl.purdue.edu/owl/research_and_citation/ieee_style/reference_list.html) y [citas en el texto](https://owl.purdue.edu/owl/research_and_citation/ieee_style/in-text_citation.html). Citas entre corchetes, orden de primera aparición, reutilización del número de una fuente, iniciales antes del apellido, volumen/número/páginas/fecha y DOI. Los números de artículo se distinguen de los rangos de páginas.
- **Vancouver**: [NLM, ejemplos de referencias recomendados por ICMJE](https://www.nlm.nih.gov/bsd/uniform_requirements.html). Se usa la variante NLM/Citing Medicine de secuencia de citas: `(1)` en el texto, revista abreviada, año;volumen(número):páginas, seis autores y luego et al. cuando corresponda. Existen variantes de Vancouver con otros delimitadores y reglas editoriales. Se comprueba un ejemplo de artículo de esta guía en una prueba automatizada.

La página de ejemplos de APA Style y Citing Medicine en NCBI respondieron con verificaciones de navegador; el PDF/manual del sitio de IEEE devolvió 403 en este entorno. No se presentan como guías leídas: se recurrió a las páginas legibles de Purdue y NLM y al repositorio mantenido por CSL. Los archivos CSL contienen enlaces a su documentación original.

## Motor, procedencia y licencias

Las reglas las ejecuta **citeproc-js 2.4.63**, no plantillas bibliográficas escritas a mano. Se emplean archivos originales del proyecto [Citation Style Language](https://citationstyles.org/), sin cambios en su contenido:

| Archivo local | Archivo del proyecto CSL | Commit fijado |
| --- | --- | --- |
| `src/csl/apa.csl` | `styles/apa.csl`, APA 7 | `d2cc4207b65000f5c2bdc0c44d7a26ed18ab6606` |
| `src/csl/ieee.csl` | `styles/ieee.csl`, guía IEEE 11.29.2023 | mismo commit |
| `src/csl/vancouver.csl` | `styles/nlm-citation-sequence.csl` | mismo commit |
| `src/csl/locales-en-US.xml`, `locales-es-ES.xml` | repositorio `locales` | `8bef426f89f38c0789223c50e53ec2197bc50bb3` |

Repositorios: [styles](https://github.com/citation-style-language/styles) y [locales](https://github.com/citation-style-language/locales). Estilos y traducciones bajo CC BY-SA 3.0; se preservan sus autores y derechos en los XML, con avisos en `src/csl/`. El nombre local `vancouver.csl` corresponde a `nlm-citation-sequence.csl`; los estilos dependientes `icmje` y `vancouver-nlm` del repositorio oficial remiten a este mismo archivo.

citeproc-js se distribuye sin modificaciones bajo su opción CPAL 1.0, con licencia, aviso y código fuente completo disponibles en `public/licenses/`. El gestor de referencias muestra atribución y enlaces a CSL, citeproc-js y las licencias. La versión queda fijada por `package-lock.json`.

Se usa la localización `en-US` de los estilos, visible en el selector. La interfaz está en español; términos bibliográficos como `et al.`, `n.d.` y meses siguen las convenciones en inglés. Los títulos recuperados no se traducen automáticamente. La exportación conserva las entradas generadas por CSL y sus cursivas; usa enlaces internos en LaTeX, sin depender de BibTeX. Una modificación posterior del archivo `.tex` no recalcula su bibliografía: hay que actualizarla en Texla y volver a exportar.

## Alcance y revisión de los datos

La cobertura verificada se centra en artículos académicos por DOI. Se recuperan autores estructurados, título, fecha publicada, revista, abreviatura suministrada, volumen, número, páginas o número de artículo y editorial. No se inventan datos ausentes; el formulario avisa de título/autoría/año/revista faltantes. Es posible editar los campos recuperados.

- Revisa nombres, fecha, mayúsculas de títulos y campos incompletos contra el artículo original. El motor no puede reconstruir metadatos ausentes ni decidir con certeza cuáles son nombres propios.
- Si no hay abreviatura oficial de revista, se utiliza el título completo. Puede introducirse la abreviatura correcta manualmente; no se inventa ni consulta automáticamente un catálogo de abreviaturas.
- La entrada manual usa `Apellidos, Nombres; Apellidos, Nombres`. Los nombres sin coma se preservan como autoría literal/institucional para no adivinar apellidos compuestos.
- Se pueden elegir otros tipos de fuente, pero obras complejas con editores, traducciones, ediciones, lugares de publicación o datos especiales requieren ampliar el modelo de metadatos para cubrir todas sus reglas. No se promete cobertura completa de todo tipo documental.
- Se insertan citas individuales sin localizadores de página, agrupación de varias fuentes o modo narrativo. Estas funciones quedan pendientes; no deben confundirse con el formato de las entradas bibliográficas.
- El estilo bibliográfico no convierte toda la tesis en una plantilla completa APA/IEEE: márgenes, portada, encabezados y otras reglas del manuscrito requieren configuración adicional. Se inicia la bibliografía en una página nueva al imprimir y exportar.

## Verificación

Las pruebas unitarias cubren datos de Crossref y DataCite, identidad, errores, cancelación, caché, orden, desambiguación, ejemplos de guías, tipografía y exportación. Las pruebas de Chromium cubren el flujo DOI con respuestas controladas, cambio y persistencia de estilo, edición, errores de red, respuestas tardías, renumeración, pegado entre documentos y uso móvil.

Se ejecutó la función real `lookupDoi` desde Node.js con HTTPS verificado contra Crossref (`10.1038/nphys1170`) y DataCite (`10.5281/zenodo.3242077`, pasando por la respuesta 404 de Crossref). También se verificaron las cabeceras CORS para el origen de GitHub Pages. Chromium en este entorno no confía en el certificado del proxy, por lo que no se afirma una prueba integral navegador-registro con conexión real. Las pruebas no deshabilitan TLS ni alteran almacenes de certificados. La compilación del `.tex` con una distribución TeX no está verificada.
