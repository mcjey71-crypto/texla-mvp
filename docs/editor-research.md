# Investigación y mejoras del editor formal

Revisión realizada el 26 de octubre de 2026. Criterio: facilitar la escritura formal en una interfaz visual, mantener las ecuaciones y la bibliografía, y conservar las funciones al exportar LaTeX. Se implementaron funciones propias de Texla; no se incorporó código de los editores comparados.

## Fuentes consultadas

| Editor | Características verificadas en las fuentes | Aplicación a Texla |
| --- | --- | --- |
| **Overleaf** | Editor colaborativo en línea, compilación LaTeX, editor visual y de código, tablas visuales, plantillas, buscar/reemplazar e historial. | Tablas editables, plantillas orientadas al propósito, buscar/reemplazar y copias completas. Mantener el código generado como vista secundaria. |
| **LyX** | Modelo WYSIWYM: el autor marca la estructura y el sistema se encarga de la composición. Secciones y numeración automáticas, índice, referencias cruzadas, matemáticas y bibliografía; orientado también a tesis y documentos largos. | Estilos de Sección/Subsección, numeración derivada de la estructura y un índice que se actualiza al editar. |
| **TeXstudio** | Plantillas, asistente de tablas, insertar/eliminar filas y columnas, vista de estructura, búsqueda, referencias y visor PDF. Su flujo principal sigue orientado al código. | Controles de tabla, navegación por secciones y búsqueda de texto desde la interfaz visual. |

Fuentes leídas:

1. [Overleaf, README oficial](https://github.com/overleaf/overleaf/blob/main/README.md): colaboración, compilación y características de Community Edition/Server Pro.
2. [Overleaf, textos de interfaz del repositorio oficial](https://github.com/overleaf/overleaf/blob/main/services/web/locales/en.json): entradas `homepage_insert_figures_create_tables`, `homepage_visual_editor_and_code_editor`, `homepage_built_in_templates`, `hotkey_find_and_replace`, `document_history_and_version_control`, entre otras. Se revisó también el [componente de barra de herramientas](https://github.com/overleaf/overleaf/blob/main/services/web/frontend/js/features/ide-react/components/toolbar/toolbar.tsx). Esto confirma que Overleaf ya dispone de edición visual; Texla no presenta esa idea como una función inédita.
3. [LyX, manual de introducción, copia del código en GitHub](https://github.com/cburschka/lyx/blob/master/lib/doc/Intro.lyx): filosofía de trabajo, estructura, numeración, índice y aplicaciones a documentos científicos. Esta fuente es un espejo del manual de LyX; no se presenta como una visita a la web principal.
4. [TeXstudio, README oficial](https://github.com/texstudio-org/texstudio/blob/master/README.md) y [manual oficial de edición](https://github.com/texstudio-org/texstudio/blob/master/utilities/manual/source/editing.md): plantillas, estructura, tablas y búsqueda.

Las páginas principales de Overleaf, LyX, Texmaker y Authorea devolvieron un bloqueo del proxy del entorno. La comparación se basa en los documentos accesibles anteriores. No se atribuyen funciones no comprobadas a Texmaker o Authorea ni se comparan precios, límites de planes o condiciones actuales. Los enlaces a ramas activas pueden cambiar después de esta revisión.

## Funciones incorporadas

### Tablas visuales

**Tabla** permite elegir filas y columnas e insertar un encabezado. Se escribe directamente en las celdas, se avanza con Tab y aparecen controles para añadir/eliminar filas y columnas, alternar el encabezado y eliminar la tabla. Las operaciones se pueden deshacer. La exportación utiliza `longtable`, `array`, `booktabs` y `multirow`, escapa el texto y conserva las posiciones de celdas combinadas importadas. Los encabezados se repiten al continuar la tabla, salvo si contienen elementos que cambian contadores como ecuaciones en bloque. La interfaz de esta entrega no incluye combinar celdas, pies numerados ni referencias cruzadas a tablas. Los anchos visuales y los del motor TeX no se prometen idénticos.

### Plantillas de trabajo

**Plantillas** ofrece tesis, artículo académico e informe técnico, además de una página en blanco. Son estructuras originales y editables con indicaciones para redactar; no contienen resultados ni citas inventados. No sustituyen las normas de una universidad o revista ni son plantillas oficiales de esas instituciones.

### Estructura e índice

En **Estilo de párrafo**, Título representa el título del trabajo; Sección y Subsección corresponden a los niveles de estructura. **Formato del documento** permite numerarlos automáticamente. Al borrar, mover, cambiar de nivel o deshacer un encabezado, su número se recalcula. Si el texto ya contiene números escritos manualmente, deben retirarse antes de activar la numeración automática.

**Índice automático** inserta un índice antes de la primera sección, o al final si todavía no existen secciones. Incluye las secciones y subsecciones, se actualiza al editar y sus entradas permiten navegar. No inventa números de página en el editor: el navegador muestra un documento continuo. El `.tex` usa `\tableofcontents`; dos compilaciones LaTeX resuelven sus páginas. **Salto de página** se conserva al imprimir y se exporta como `\clearpage`.

### Formato por documento

Tamaño A4/Carta, texto 11/12 puntos, interlineado sencillo/1,5/doble, márgenes 2/2,5/3 cm y numeración de secciones. Se guardan por documento y se aplican al editor, impresión y exportación. En móvil se reduce el margen de la vista para aprovechar el ancho; la impresión conserva el margen elegido. El zoom y la tipografía elegida en el editor siguen siendo preferencias de visualización. El formato de la bibliografía lo determina el estilo bibliográfico seleccionado.

### Buscar y reemplazar

**Buscar y reemplazar**, Ctrl/Cmd+F o Ctrl/Cmd+H buscan texto literal en títulos, párrafos y tablas. Admite distinguir mayúsculas, navegar entre coincidencias, reemplazar una o todas y deshacer. Puede encontrar texto dividido por negritas o cursivas; no cruza ecuaciones, citas u otros elementos atómicos. Las fórmulas y los datos bibliográficos se modifican desde sus herramientas respectivas. No se interpretan expresiones regulares.

### Copias editables

**Copias editables** o **Exportar → Copia editable de Texla** descargan un `.texla.json` con contenido, ecuaciones, tablas, biblioteca, estilo bibliográfico y formato. **Abrir copia de Texla** valida el archivo y el esquema del editor, y lo abre con una identidad nueva sin reemplazar documentos existentes. Rechaza archivos incompatibles o mayores de 5 MB y comunica errores de espacio. No es una importación de `.tex`, Word ni proyectos de Overleaf, ni un historial automático.

## Qué queda fuera de esta entrega

- Colaboración simultánea, permisos, comentarios compartidos y cuentas: necesitan autenticación y almacenamiento remoto.
- Historial duradero y sincronización entre dispositivos: las copias editables ayudan a conservar el trabajo, pero el guardado habitual sigue siendo local.
- Compilar PDF en un servidor: requiere infraestructura para ejecutar TeX de forma aislada. El botón PDF actual utiliza la impresión del navegador.
- Imágenes y gestión de archivos asociados, pies de figura/tabla y referencias cruzadas: requieren manejo de recursos y exportación de paquetes de archivos.
- Notas al pie, ecuaciones referenciables, importación BibTeX/RIS, agrupación de citas y plantillas editoriales específicas: funciones útiles para siguientes entregas.
- Autocompletar comandos, terminales o administración manual de paquetes: no son la prioridad para el flujo visual de Texla.

## Validación

Pruebas unitarias y de Chromium verifican exportación, índices, formato persistente, tablas, búsquedas que respetan fórmulas, recuperación de copias, uso móvil y las funciones previas. `npm run test:latex` comprueba tres documentos con APA, IEEE y Vancouver mediante tres pasadas de `pdflatex`, incluyendo índice, tabla con celdas combinadas y encabezado de varios párrafos, ecuación y citas. Requiere una distribución TeX con español y los paquetes declarados en la exportación; este comando es independiente del despliegue de GitHub Pages.
