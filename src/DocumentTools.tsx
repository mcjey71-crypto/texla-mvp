import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentFormat } from './formalDocument';

export function FormatControls({value,onChange}: {value:DocumentFormat;onChange:(patch:Partial<DocumentFormat>)=>void}) {
  return <div className="format-controls"><label>Tamaño de página<select value={value.pageSize} onChange={e=>onChange({pageSize:e.target.value as DocumentFormat['pageSize']})}><option>A4</option><option>Carta</option></select></label>
    <label>Tamaño del texto<select value={value.fontSize} onChange={e=>onChange({fontSize:Number(e.target.value) as 11|12})}><option value="11">11 pt</option><option value="12">12 pt</option></select></label>
    <label>Interlineado<select value={value.lineSpacing} onChange={e=>onChange({lineSpacing:Number(e.target.value) as 1|1.5|2})}><option value="1">Sencillo</option><option value="1.5">1,5 líneas</option><option value="2">Doble</option></select></label>
    <label>Márgenes<select value={value.margin} onChange={e=>onChange({margin:Number(e.target.value) as 2|2.5|3})}><option value="2">2 cm</option><option value="2.5">2,5 cm</option><option value="3">3 cm</option></select></label>
    <label className="check-label"><input type="checkbox" checked={value.numberedSections} onChange={e=>onChange({numberedSections:e.target.checked})}/> Numerar secciones automáticamente</label>
    <p>Se guarda con este documento y se aplica a la impresión y a LaTeX. El índice usa los estilos Sección y Subsección. La tipografía del editor puede diferir de la del archivo LaTeX.</p>
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
