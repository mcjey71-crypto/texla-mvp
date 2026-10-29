import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentFormat } from './formalDocument';
import { PAGE_FORMATS } from './pageFormats';
import { FONTS } from './fonts';

export function FormatControls({value,onChange}: {value:DocumentFormat;onChange:(patch:Partial<DocumentFormat>)=>void}) {
  return <div className="format-controls"><label>Tamaño de página<select value={value.pageSize} onChange={e=>onChange({pageSize:e.target.value as DocumentFormat['pageSize']})}>{PAGE_FORMATS.map(page=><option key={page.id} value={page.id}>{page.label}</option>)}</select></label>
    {value.pageSize === 'Continuo' && <p role="status">Altura libre y ancho adaptable al editor, sin separaciones de página. Al imprimir o exportar a LaTeX, el contenido se distribuye en hojas A4. Puedes elegir otro tamaño antes de exportar.</p>}
    <label>Tamaño del texto<select value={value.fontSize} onChange={e=>onChange({fontSize:Number(e.target.value) as DocumentFormat['fontSize']})}><option value="10">10 pt</option><option value="11">11 pt</option><option value="12">12 pt</option></select></label>
    <label>Interlineado<select value={value.lineSpacing} onChange={e=>onChange({lineSpacing:Number(e.target.value) as DocumentFormat['lineSpacing']})}><option value="1">Sencillo</option><option value="1.15">1,15 líneas</option><option value="1.5">1,5 líneas</option><option value="2">Doble</option></select></label>
    <label>Márgenes<select value={value.margin} onChange={e=>onChange({margin:Number(e.target.value) as DocumentFormat['margin']})}><option value="2">2 cm</option><option value="2.5">2,5 cm</option><option value="2.54">2,54 cm (1 pulgada)</option><option value="3">3 cm</option></select></label>
    <label>Fuente del documento<select value={value.fontFamily} onChange={e=>onChange({fontFamily:e.target.value as DocumentFormat['fontFamily']})}>{FONTS.map(font=><option key={font.id}>{font.id}</option>)}</select></label>
    <label>Sangría de primera línea<select value={value.firstLineIndent} onChange={e=>onChange({firstLineIndent:Number(e.target.value) as DocumentFormat['firstLineIndent']})}><option value="0">Sin sangría</option><option value="1.25">1,25 cm</option><option value="1.27">1,27 cm (APA)</option></select></label>
    <label>Espacio entre párrafos<select value={value.paragraphSpacing} onChange={e=>onChange({paragraphSpacing:Number(e.target.value) as 0|6})}><option value="0">0 pt</option><option value="6">6 pt</option></select></label>
    <label>Alineación predeterminada<select value={value.paragraphAlignment} onChange={e=>onChange({paragraphAlignment:e.target.value as 'left'|'justify'})}><option value="justify">Justificado</option><option value="left">Izquierda</option></select></label>
    <label>Numeración de páginas<select value={value.pageNumbers} onChange={e=>onChange({pageNumbers:e.target.value as DocumentFormat['pageNumbers']})}><option value="bottom">Abajo, centrada</option><option value="top-right">Arriba, a la derecha</option><option value="none">Sin número</option></select></label>
    <label>Diseño de títulos<select value={value.headingStyle} onChange={e=>onChange({headingStyle:e.target.value as DocumentFormat['headingStyle']})}><option value="formal">Formal</option><option value="apa">APA (títulos al tamaño del texto)</option><option value="editorial">Editorial</option><option value="cv">CV formal</option></select></label>
    <label>Estructura de numeración<select value={value.sectionStyle} onChange={e=>onChange({sectionStyle:e.target.value as 'chapters'|'sections'})}><option value="sections">Secciones</option><option value="chapters">Capítulos (I, II, III…)</option></select></label>
    <label className="check-label"><input type="checkbox" checked={value.numberedSections} onChange={e=>onChange({numberedSections:e.target.checked})}/> Numerar secciones automáticamente</label>
    <label className="check-label"><input type="checkbox" checked={value.bibliographyGroups} onChange={e=>onChange({bibliographyGroups:e.target.checked})}/> Agrupar bibliografía como UTEC (primarias y complementarias)</label>
    <p>El formato se guarda y se comparte con el documento. Si una fuente no está instalada, se usa una sustituta libre. Para la fuente exacta en LaTeX, usa XeLaTeX o LuaLaTeX con la fuente instalada. Las páginas se numeran al imprimir o compilar.</p>
  </div>;
}
export function InsertTable({onInsert}: {onInsert:(rows:number,cols:number)=>void}) {
  const [rows,setRows]=useState(4);const [cols,setCols]=useState(3);
  return <><h2 id="modal-title">Organiza tus resultados.</h2><p>Escribe directamente en las celdas. La primera fila será el encabezado; usa Tab para avanzar entre celdas.</p><div className="table-dimensions"><label className="field-label">Filas<select aria-label="Filas" value={rows} onChange={e=>setRows(Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}</select></label><label className="field-label">Columnas<select aria-label="Columnas" value={cols} onChange={e=>setCols(Number(e.target.value))}>{Array.from({length:7},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}</select></label></div><button className="primary-button" onClick={()=>onInsert(rows,cols)}>Insertar tabla</button></>;
}
export function TableControls({editor}: {editor:Editor}) {
  if (!editor.isActive('table')) return null;
  return <div className="table-controls" aria-label="Editar tabla"><span>Tabla</span><button onClick={()=>editor.chain().focus().addRowAfter().run()}>Añadir fila</button><button onClick={()=>editor.chain().focus().addColumnAfter().run()}>Añadir columna</button><button onClick={()=>editor.chain().focus().toggleHeaderRow().run()}>Encabezado</button><button onClick={()=>editor.chain().focus().deleteRow().run()}>Eliminar fila</button><button onClick={()=>editor.chain().focus().deleteColumn().run()}>Eliminar columna</button><button onClick={()=>editor.chain().focus().deleteTable().run()}>Eliminar tabla</button></div>;
}
