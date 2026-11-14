import { useEffect, useRef, useState } from 'react';
import type { Editor, MappablePosition } from '@tiptap/core';
import { Check, MessageSquare, Plus, X } from 'lucide-react';
import { createComment, documentComments, replyToComment, resolveComment } from './comments';

export default function CommentsPanel({ editor, name, request, selected, shared, syncStatus, onNameChange, onClose }: { editor: Editor; name: string; request: number; selected: string; shared: boolean; syncStatus: string; onNameChange: (name: string) => void; onClose: () => void }) {
  const [, refresh] = useState(0);
  const [author, setAuthor] = useState(name);
  const [draft, setDraft] = useState<string | null>(null);
  const [quote, setQuote] = useState('');
  const [filter, setFilter] = useState('open');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const anchor = useRef<{ from: MappablePosition; to: MappablePosition; removed?: boolean } | undefined>(undefined);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const update = ({ transaction }: { transaction: Parameters<Editor['utils']['getUpdatedPosition']>[1] }) => {
      if (anchor.current && transaction.docChanged) {
        const a = editor.utils.getUpdatedPosition(anchor.current.from, transaction), b = editor.utils.getUpdatedPosition(anchor.current.to, transaction);
        anchor.current = { from: a.position, to: b.position, removed: anchor.current.removed || !!(a.mapResult?.deletedAcross && b.mapResult?.deletedAcross) };
      }
      refresh(n => n + 1);
    };
    editor.on('transaction', update); return () => { editor.off('transaction', update); };
  }, [editor]);
  function start() {
    if (draft !== null) { bodyInput.current?.focus(); return; }
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 500);
    anchor.current = text ? { from: editor.utils.createMappablePosition(from), to: editor.utils.createMappablePosition(to) } : undefined;
    setQuote(text); setDraft(''); setError(''); requestAnimationFrame(() => bodyInput.current?.focus());
  }
  useEffect(() => { if (request) start(); }, [request]);
  useEffect(() => { if (selected) { setFilter('all'); requestAnimationFrame(() => document.getElementById(`comment-${selected}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); } }, [selected]);
  const threads = documentComments(editor.state.doc);
  const visible = threads.filter(t => filter === 'all' || (filter === 'resolved' ? t.resolved : !t.resolved));
  function submit() {
    const range = anchor.current;
    const attached = range && !range.removed && range.to.position > range.from.position;
    const id = createComment(editor, author, draft || '', attached ? { from: range.from.position, to: range.to.position, quote } : undefined);
    if (!id) { setError('No se pudo añadir el comentario. Revisa el texto y la conexión del documento.'); return; }
    setDraft(null); anchor.current = undefined; setFilter('open'); setError('');
  }
  return <aside className="comments-panel" aria-label="Comentarios del documento">
    <header><div><span className="comments-eyebrow">CONVERSACIÓN DEL DOCUMENTO</span><h2><MessageSquare size={20}/> Comentarios <span>{threads.length}</span></h2></div><button aria-label="Cerrar comentarios" onClick={onClose}><X size={18}/></button></header>
    <p className="comments-intro">{shared ? 'Visibles para todas las personas con el enlace de este documento.' : 'Se guardan con el documento y se incluirán cuando lo compartas.'}</p>
    {shared && <p className="comments-sync" role="status">{syncStatus}</p>}
    <div className="comments-controls"><select aria-label="Mostrar comentarios" value={filter} onChange={e => setFilter(e.target.value)}><option value="open">Pendientes</option><option value="resolved">Resueltos</option><option value="all">Todos</option></select><button onMouseDown={e => e.preventDefault()} onClick={start} disabled={!editor.isEditable}><Plus size={15}/> Añadir comentario</button></div>
    <label className="comment-author">Tu nombre en los comentarios<input maxLength={60} value={author} onChange={e => { setAuthor(e.target.value); onNameChange(e.target.value); }} placeholder="Tu nombre"/></label>
    {draft !== null && <form className="comment-composer" onSubmit={e => { e.preventDefault(); submit(); }}>
      <strong>{quote ? 'Sobre el texto seleccionado' : 'Comentario general'}</strong>{quote && <blockquote>{quote}</blockquote>}
      {quote && anchor.current?.removed && <small>El texto se eliminó. Se guardará como comentario general.</small>}
      <textarea ref={bodyInput} aria-label="Nuevo comentario" placeholder="Comparte una observación con tu equipo…" maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)}/>
      <div className="comment-actions"><button type="button" onClick={() => { setDraft(null); anchor.current = undefined; }}>Cancelar</button><button className="comment-primary" disabled={!draft.trim() || !editor.isEditable}>Publicar comentario</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    <div className="comment-list">{!visible.length && <div className="comments-empty"><MessageSquare size={28}/><strong>{filter === 'resolved' ? 'Sin comentarios resueltos' : 'Espacio para una buena revisión'}</strong><p>Selecciona un fragmento y añade un comentario, o deja una observación general.</p></div>}
      {visible.map(thread => <article className={`comment-card ${thread.id === selected ? 'selected' : ''} ${thread.resolved ? 'resolved' : ''}`} id={`comment-${thread.id}`} key={thread.id}>
        <div className="comment-card-top"><span>{thread.resolved ? 'Resuelto' : 'Pendiente'}</span><button aria-label={thread.resolved ? 'Reabrir comentario' : 'Resolver comentario'} title={thread.resolved ? 'Reabrir comentario' : 'Marcar como resuelto'} disabled={!editor.isEditable} onClick={() => resolveComment(editor, thread.id, !thread.resolved)}>{thread.resolved ? 'Reabrir' : <Check size={17}/>}</button></div>
        {thread.quote && <button className="comment-quote" disabled={!thread.anchor} onClick={() => { if (thread.anchor) editor.chain().focus().setTextSelection(thread.anchor).scrollIntoView().run(); }}>{thread.quote}{!thread.anchor && <small>El texto asociado fue eliminado.</small>}</button>}
        {thread.messages.map(message => <div className="comment-message" key={message.id}><div><strong>{message.author}</strong><time>{new Date(message.created).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.body}</p></div>)}
        {!thread.resolved && <form onSubmit={e => { e.preventDefault(); if (replyToComment(editor, thread.id, author, replies[thread.id] || '')) setReplies(current => ({ ...current, [thread.id]: '' })); else setError('El comentario cambió. Revisa su estado antes de responder.'); }}><textarea aria-label="Responder al comentario" placeholder="Añadir una respuesta…" maxLength={4000} value={replies[thread.id] || ''} onChange={e => setReplies(current => ({ ...current, [thread.id]: e.target.value }))}/><button className="comment-primary" disabled={!replies[thread.id]?.trim() || !editor.isEditable}>Responder</button></form>}
      </article>)}
    </div>
    <p className="comments-footnote">Los comentarios se conservan en la copia editable. No aparecen en la impresión ni en el archivo LaTeX.</p>
  </aside>;
}
