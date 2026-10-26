import { useEffect, useState } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type TextMatch = { from: number; to: number };
export function findText(doc: PMNode, query: string, matchCase = false): TextMatch[] {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
  const result: TextMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    let run = ''; let start = pos + 1;
    const flush = () => { for (const m of run.matchAll(pattern)) result.push({ from: start + m.index!, to: start + m.index! + m[0].length }); run = ''; };
    node.forEach((child, offset) => {
      if (child.isText) { if (!run) start = pos + 1 + offset; run += child.text; }
      else flush();
    }); flush(); return false;
  });
  return result;
}
const searchKey = new PluginKey<{ query: string; matchCase: boolean }>('documentSearch');
export const DocumentSearch = Extension.create({
  name: 'documentSearch', addProseMirrorPlugins() { return [new Plugin({ key: searchKey,
    state: { init: () => ({query:'',matchCase:false}), apply: (tr, value) => tr.getMeta(searchKey) || value },
    props: { decorations(state) { const search = searchKey.getState(state)!; return DecorationSet.create(state.doc, findText(state.doc,search.query,search.matchCase).map(m => Decoration.inline(m.from,m.to,{class: state.selection.from === m.from && state.selection.to === m.to ? 'search-match current-match' : 'search-match'}))); } },
  })]; },
});
export default function SearchDocument({editor,onClose}: {editor:Editor;onClose:()=>void}) {
  const [query,setQuery] = useState(''); const [replacement,setReplacement] = useState(''); const [matchCase,setMatchCase] = useState(false); const [,rerender] = useState(0);
  useEffect(() => { const refresh = () => rerender(n=>n+1);editor.on('transaction',refresh);return () => {editor.off('transaction',refresh);}; },[editor]);
  useEffect(() => {editor.view.dispatch(editor.state.tr.setMeta(searchKey,{query,matchCase}));},[editor,query,matchCase]);
  useEffect(() => () => {if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(searchKey,{query:'',matchCase:false}));},[editor]);
  const matches = findText(editor.state.doc,query,matchCase);
  const current = matches.findIndex(m=>m.from===editor.state.selection.from && m.to===editor.state.selection.to);
  function select(direction:number) { if (!matches.length) return;const index = current < 0 ? (direction > 0 ? 0 : matches.length-1) : (current+direction+matches.length)%matches.length;const m=matches[index];editor.chain().setTextSelection(m).scrollIntoView().run(); }
  function replace(all:boolean) {
    const chosen = all ? matches : current >= 0 ? [matches[current]] : matches.slice(0,1);
    if (!chosen.length) return;
    const tr=editor.state.tr; for (const m of [...chosen].reverse()) tr.insertText(replacement,m.from,m.to);editor.view.dispatch(tr.scrollIntoView());
  }
  return <section className="document-search" aria-label="Buscar y reemplazar">
    <div><input autoFocus aria-label="Buscar en el texto" placeholder="Buscar en el documento" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();select(e.shiftKey?-1:1)}}}/><span role="status">{matches.length ? current < 0 ? `${matches.length} coincidencias` : `${current+1} de ${matches.length}` : '0 coincidencias'}</span><button disabled={!matches.length} onClick={()=>select(-1)} aria-label="Coincidencia anterior">↑</button><button disabled={!matches.length} onClick={()=>select(1)} aria-label="Coincidencia siguiente">↓</button><button onClick={onClose} aria-label="Cerrar búsqueda">×</button></div>
    <div><input aria-label="Reemplazar por" placeholder="Reemplazar por" value={replacement} onChange={e=>setReplacement(e.target.value)}/><button disabled={!matches.length} onClick={()=>replace(false)}>Reemplazar</button><button disabled={!matches.length} onClick={()=>replace(true)}>Reemplazar todo</button><label><input type="checkbox" checked={matchCase} onChange={e=>setMatchCase(e.target.checked)}/> Mayúsculas</label></div>
    <small>Busca texto en párrafos, títulos y tablas. Las ecuaciones y los datos bibliográficos se editan desde sus propias herramientas.</small>
  </section>;
}
