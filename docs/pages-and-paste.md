# Tamaños de página, CV y portapapeles matemático

Los documentos nuevos en blanco usan **A4**. Las plantillas conservan sus ajustes específicos, como Carta para UTEC. En Diseño o Formato del documento se elige A4, Carta, A5, A3, A2, A1 o **Continuo — sin páginas**. La elección se conserva en el navegador, cuenta, copias editables y colaboración.

Los tamaños ISO usan las dimensiones de la serie A en milímetros; Carta mide 215,9 × 279,4 mm. La vista del editor se adapta a su ancho disponible, mientras la impresión y LaTeX usan las dimensiones físicas elegidas. La exportación declara dimensiones explícitas para A1 y A2, también en CSS, donde sus nombres no son tamaños predefinidos válidos. La impresora física debe admitir el papel seleccionado.

Continuo tiene altura libre, ancho adaptable y no muestra separaciones ni bordes de hoja. No es una hoja física de altura infinita. Al imprimir o exportar `.tex` se usa A4 y se omiten los saltos manuales; se puede seleccionar otro papel antes de exportar. Cambiar de modo no elimina los saltos guardados ni el contenido.

El CV estilo Harvard está en **Plantillas → Profesional**. Usa una columna, títulos sobrios, viñetas, educación, experiencia, liderazgo y habilidades. Es una adaptación editable, no una plantilla oficial. Véanse [sus criterios](templates.md#cv-estilo-harvard).

## Copiar ecuaciones

Pega directamente en el editor con Ctrl+V / Cmd+V o en Pegar contenido. Se admiten:

- Texto con delimitadores LaTeX `\(...\)`, `\[...\]`, `$...$` y `$$...$$`.
- HTML con datos LaTeX explícitos, incluidos nodos matemáticos de Texla.
- MathML de presentación: fracciones, raíces, subíndices, superíndices, sumas, límites, matrices y otras estructuras compatibles. Las anotaciones TeX de KaTeX tienen prioridad y se elimina su representación visual duplicada.
- Imágenes de ecuaciones que incluyen LaTeX explícito en sus metadatos o en la URL histórica de Google Charts (`cht=tx&chl=...`). Se lee la fórmula de la URL sin descargar la imagen.

La disponibilidad depende del navegador, la aplicación de origen y cómo se copia. **No se garantiza que todas las ecuaciones nativas de Google Docs incluyan esa información.** Si llega solamente una imagen, un formato interno privado o una estructura matemática no admitida, no se inventa una ecuación: se mantiene una indicación visible para revisar y se explica la alternativa. El pegado no consulta una IA ni usa servicios externos de reconocimiento matemático.

Desde Google Docs, la alternativa es **Archivo → Descargar → Microsoft Word (.docx)** y después **Importar documento** en Texla. Las ecuaciones que el DOCX conserve como objetos matemáticos de Word pueden convertirse mediante el importador existente. Si también son imágenes dentro de Word, requieren el editor de ecuaciones o una transcripción LaTeX; exportar no recupera una estructura que ya se perdió.

Las pruebas de navegador usan portapapeles HTML/MathML representativos y verifican texto adyacente, formato básico, fórmulas editables, rechazo de scripts, mensajes para imágenes y exportación. No sustituyen una prueba manual en una cuenta de Google Docs con el documento concreto del usuario.
