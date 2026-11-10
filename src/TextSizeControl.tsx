import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Minus, Plus } from 'lucide-react';
import { textAppearance } from './richFormatting';

export function selectedTextSize(editor: Editor, fallback: number) {
  const explicit = textAppearance(editor.getAttributes('textAppearance').appearance).size;
  if (explicit) return explicit;
  const dom = editor.view.domAtPos(editor.state.selection.from).node;
  const element = dom instanceof HTMLElement ? dom : dom.parentElement;
  const measured = element ? parseFloat(getComputedStyle(element).fontSize) * .75 : fallback;
  return Math.min(96, Math.max(5, Math.round(measured * 10) / 10));
}

export function applyTextSize(editor: Editor, size: number) {
  if (!editor.isEditable || !Number.isFinite(size) || size < 5 || size > 96) return false;
  const { from, to, empty } = editor.state.selection;
  const type = editor.schema.marks.textAppearance;
  if (empty) return editor.chain().focus().setMark('textAppearance', { appearance: { ...textAppearance(editor.getAttributes('textAppearance').appearance), size } }).run();
  const tr = editor.state.tr;
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'commentThread') return false;
    if (!node.isText) return;
    const appearance = textAppearance(node.marks.find(m => m.type === type)?.attrs.appearance);
    tr.addMark(Math.max(from, pos), Math.min(to, pos + node.nodeSize), type.create({ appearance: { ...appearance, size } }));
  });
  editor.view.dispatch(tr); editor.view.focus(); return true;
}

export default function TextSizeControl({ editor, fallback }: { editor: Editor; fallback: number }) {
  const current = selectedTextSize(editor, fallback);
  const [value, setValue] = useState(String(current));
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  useEffect(() => { if (!editing) setValue(String(current)); }, [current, editing]);
  function apply() {
    editingRef.current = false;
    setEditing(false);
    const size = Number(value.replace(',', '.'));
    if (!value.trim() || !applyTextSize(editor, size)) setValue(String(current));
  }
  return <div className="text-size-control" role="group" aria-label="Tamaño de letra">
    <button type="button" aria-label="Disminuir tamaño de letra" title="Disminuir tamaño de letra" disabled={current <= 5} onMouseDown={e => e.preventDefault()} onClick={() => applyTextSize(editor, Math.max(5, current - 1))}><Minus size={14}/></button>
    <input aria-label="Tamaño de letra en puntos" title="Texto seleccionado o lo que escribas a continuación · 5 a 96 pt" inputMode="decimal" value={value} onFocus={() => { editingRef.current = true; setEditing(true); }} onChange={e => setValue(e.target.value)} onBlur={() => { if (editingRef.current) apply(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') { editingRef.current = false; setValue(String(current)); setEditing(false); editor.view.focus(); } }}/>
    <button type="button" aria-label="Aumentar tamaño de letra" title="Aumentar tamaño de letra" disabled={current >= 96} onMouseDown={e => e.preventDefault()} onClick={() => applyTextSize(editor, Math.min(96, current + 1))}><Plus size={14}/></button>
  </div>;
}
