# Plantillas y tipografías de Texla

La galería ofrece diez plantillas. Cada una crea un documento independiente con contenido orientativo y ajustes propios. Compartir ese documento **no crea otro documento**.

| Plantilla | Fuente elegida | Papel / márgenes | Interlineado | Referencias |
| --- | --- | --- | --- | --- |
| Tesis general | Times New Roman 12 | A4 / 2,5 cm | 1,5 | APA 7 |
| Tesis UTEC — PFC/Capstone | Times New Roman 12 | Carta / 3 cm | 1,5 | IEEE, grupos primarias/complementarias |
| Artículo académico | Times New Roman 12 | Carta / 2,54 cm | Doble | APA 7 |
| Informe técnico | Arial 11 | A4 / 2,5 cm | 1,15 | IEEE |
| Proyecto de investigación | Cambria 12 | A4 / 2,5 cm | 1,5 | APA 7 |
| Ensayo académico | Georgia 11 | Carta / 2,54 cm | Doble | APA 7 |
| Informe de laboratorio | STIX Two Text 11 | A4 / 2,5 cm | 1,5 | IEEE |
| Monografía | EB Garamond 12 | A4 / 2,5 cm | 1,5 | APA 7 |
| Carta formal | Calibri 11 | A4 / 2,5 cm | Sencillo | Sin bibliografía inicial |
| Reporte de caso clínico | Times New Roman 12 | A4 / 2,5 cm | Doble | Vancouver |

**No existe una norma de formato única para todas las tesis, informes o revistas.** Salvo los criterios extraídos de los PDF UTEC y los ajustes básicos APA indicados, estas combinaciones son decisiones editoriales sugeridas. Las instrucciones de la universidad, revista, curso o destinatario prevalecen. Las plantillas no certifican cumplimiento editorial o institucional completo.

## Fuentes utilizadas para UTEC

Se revisaron los dos documentos aportados por el usuario, sin publicar los PDF originales en el repositorio:

1. **Guía de redacción del Informe Final del Proyecto Capstone.pdf**. Su portada interna dice *Guía de redacción del Informe del Proyecto Final de Ingeniería*, edición **2026.2**, carreras AM, CI, EN e IQ. Se utilizaron las secciones de resumen, capítulos I–X, referencias (p. 32) y anexos (pp. 33–34).
2. **Plantilla para Proyecto Final de Carrera.pdf**. Contiene portada, índices, resumen, abstract, diez capítulos, referencias y anexos. La portada de ejemplo menciona Ingeniería Industrial, por lo que Texla deja la carrera como campo editable.

La denominación **Tesis UTEC — PFC/Capstone** responde al nombre solicitado por el usuario, pero los archivos son de Proyecto Final de Ingeniería/Carrera, no un reglamento general de tesis UTEC. Esta distinción se muestra en los criterios de la tarjeta.

### Evidencia del formato

- El PDF de plantilla tiene **24 páginas**, de **612 × 792 puntos**, es decir, **Carta**.
- Las fuentes incrustadas y el texto de los capítulos identifican **Times New Roman de 12 puntos**. Los encabezados de capítulo usan aproximadamente 16 puntos.
- La plantilla indica explícitamente **sangría de 1,25 cm**.
- Los márgenes de **3 cm** y el interlineado **1,5** son una reconstrucción aproximada de la composición observada: inicio del texto alrededor de 85 puntos y distancia entre líneas cercana a 20,7 puntos en el PDF. No se presentan como una regla institucional escrita que los archivos no declaran globalmente.
- La numeración se reconstruye automáticamente. En el ejemplo, varios subtítulos posteriores al capítulo V conservan números del capítulo anterior; Texla sigue el capítulo correspondiente y el esquema de la guía.

### Estructura y guía incorporadas

Portada con carrera, título, autores, asesores y ORCID; tabla de contenido; índices de tablas, figuras y anexos; resumen y abstract; diez capítulos de diseño de ingeniería; bibliografía; siete grupos de anexos de la guía y un octavo de proceso iterativo, opcional según la plantilla.

El resumen contiene una indicación de **150–300 palabras**, hasta una página y **4–8 palabras clave**, siguiendo la guía. Los capítulos incluyen instrucciones breves entre corchetes para sustituir al redactar; no se incluyen resultados ni referencias ficticias.

La bibliografía aparece **antes de los anexos**, se alimenta de las citas utilizadas y mantiene los números IEEE por primera aparición. En **Referencias → Grupo bibliográfico (UTEC)** se clasifica cada fuente como primaria o complementaria. Las fuentes no clasificadas y más de 30 referencias producen avisos para revisión; no se eliminan fuentes automáticamente. No se infiere la categoría desde el DOI.

La tabla de contenido enlaza a los encabezados y se actualiza al editarlos. Los números de página se calculan al compilar LaTeX. Los índices de tablas, figuras y anexos son espacios de trabajo **manuales**, expresamente señalados; no se inventan páginas. La inclusión de imágenes y planos no está resuelta por estas plantillas: conserva sus archivos originales para la entrega final.

## APA y otros formatos

Para el artículo y ensayo se incorporan ajustes básicos conocidos de APA 7: Carta, márgenes de una pulgada, doble espacio, sangría de media pulgada, alineación izquierda y títulos al tamaño del cuerpo; Times New Roman 12 o Georgia 11. La composición final debe revisarse según el tipo de trabajo y las instrucciones de la institución. IEEE y Vancouver seleccionan el estilo bibliográfico: no implican una maquetación oficial de revista o congreso.

Páginas oficiales para contrastar las instrucciones de entrega:

- [APA: fuentes](https://apastyle.apa.org/style-grammar-guidelines/paper-format/font)
- [APA: márgenes](https://apastyle.apa.org/style-grammar-guidelines/paper-format/margins)
- [APA: interlineado](https://apastyle.apa.org/style-grammar-guidelines/paper-format/line-spacing)
- [IEEE: plantillas de conferencias](https://www.ieee.org/conferences/publishing/templates.html)
- [ICMJE: preparación de manuscritos](https://www.icmje.org/recommendations/browse/manuscript-preparation/preparing-for-submission.html)

En esta sesión, la red del entorno bloqueó el acceso a esas páginas externas. No se atribuyen a una consulta web reciente; la investigación documental verificable de UTEC se basa en los PDF aportados. Los estilos bibliográficos CSL existentes mantienen sus pruebas y documentación previa.

## Fuentes, impresión y LaTeX

Hay ocho opciones: Literata, Times New Roman, Arial, Calibri, Cambria, Georgia, EB Garamond y STIX Two Text. La elección se guarda por documento, se incluye en copias editables, se sincroniza al colaborar y se incorpora al `.tex`. Sangría, márgenes, espaciado, alineación predeterminada, estilo de capítulos y posición de números de página también son persistentes.

Texla no distribuye fuentes propietarias de Microsoft. Usa la fuente instalada cuando está disponible y sustitutas libres cuando falta: Tinos para Times New Roman, Arimo para Arial, Carlito para Calibri, STIX Two Text para Cambria y Literata para Georgia. No todas las sustituciones tienen métricas idénticas. Las fuentes libres se sirven desde el propio sitio.

Para reproducir exactamente la familia elegida en LaTeX, usa **XeLaTeX o LuaLaTeX con esa fuente instalada**. El preámbulo incluye alternativas TeX Gyre y Latin Modern; pdfLaTeX usa familias sustitutivas. Esto puede alterar los saltos de página. La impresión del navegador utiliza el tamaño y márgenes del documento y números de página mediante cajas de margen CSS en navegadores compatibles; desactiva los encabezados/pies automáticos del navegador para evitar URL/fecha adicionales.
