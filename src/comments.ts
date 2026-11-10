import { Mark, Node, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

// Threads live inside the same ProseMirror/Yjs document as their anchors. Each
// message is a separate immutable child, so concurrent replies merge instead
// of replacing an array. Bodies are attributes, never part of manuscript text.
const hiddenAttribute = (value: unknown) => ({ default: value, rendered: false });
export const CommentMessage = Node.create({
  name: 'commentMessage', atom: true, selectable: false,
  addAttributes() { return { id: hiddenAttribute(''), author: hiddenAttribute(''), body: hiddenAttribute(''), created: hiddenAttribute(0) }; },
  parseHTML() { return []; },
  renderHTML() { return ['span', { 'data-texla-comment-message': '', hidden: 'hidden' }]; },
  renderText() { return ''; },
});
export const CommentThread = Node.create({
  name: 'commentThread', group: 'block', content: 'commentMessage+', atom: true, selectable: false, isolating: true,
  addAttributes() { return { id: hiddenAttribute(''), quote: hiddenAttribute(''), resolved: hiddenAttribute(false) }; },
  parseHTML() { return []; },
  renderHTML() { return ['div', { 'data-texla-comment-thread': '', class: 'comment-storage', hidden: 'hidden', contenteditable: 'false' }, 0]; },
  renderText() { return ''; },
});
export const CommentAnchor = Mark.create({
  name: 'commentAnchor', inclusive: false, excludes: '',
  addAttributes() { return { id: hiddenAttribute('') }; },
  parseHTML() { return []; },
  renderHTML({ mark }) { return ['span', { class: 'comment-anchor', 'data-comment-id': String(mark.attrs.id), title: 'Ver comentario' }, 0]; },
});
export type Thread = { id: string; pos: number; node: PMNode; quote: string; resolved: boolean; anchor?: { from: number; to: number }; messages: { id: string; author: string; body: string; created: number }[] };
export function documentComments(doc: PMNode): Thread[] {
  const threads: Thread[] = [];
  const anchors = new Map<string, { from: number; to: number }>();
  doc.descendants((node, pos) => {
    if (node.type.name === 'commentThread') {
      const messages: Thread['messages'] = [];
      node.forEach(child => { if (typeof child.attrs.body === 'string') messages.push({ id: String(child.attrs.id), author: String(child.attrs.author || 'Invitado').slice(0, 60), body: child.attrs.body.slice(0, 4000), created: Number(child.attrs.created) || 0 }); });
      threads.push({ id: String(node.attrs.id), pos, node, quote: String(node.attrs.quote || '').slice(0, 500), resolved: node.attrs.resolved === true, messages });
      return false;
    }
    for (const mark of node.marks) if (mark.type.name === 'commentAnchor') {
      const id = String(mark.attrs.id), existing = anchors.get(id);
      anchors.set(id, { from: existing?.from ?? pos, to: pos + node.nodeSize });
    }
  });
  for (const thread of threads) thread.anchor = anchors.get(thread.id);
  return threads;
}
export function createComment(editor: Editor, author: string, body: string, range?: { from: number; to: number; quote: string }) {
  if (!editor.isEditable || !body.trim() || body.length > 4000) return false;
  const id = crypto.randomUUID(), tr = editor.state.tr;
  const message = editor.schema.nodes.commentMessage.create({ id: crypto.randomUUID(), author: author.trim().slice(0, 60) || 'Invitado', body: body.trim(), created: Date.now() });
  if (range && range.to > range.from) tr.addMark(range.from, range.to, editor.schema.marks.commentAnchor.create({ id }));
  tr.insert(tr.doc.content.size, editor.schema.nodes.commentThread.create({ id, quote: range?.quote.slice(0, 500) || '', resolved: false }, [message]));
  editor.view.dispatch(tr); return id;
}
export function replyToComment(editor: Editor, id: string, author: string, body: string) {
  if (!editor.isEditable || !body.trim() || body.length > 4000) return false;
  const thread = documentComments(editor.state.doc).find(t => t.id === id);
  if (!thread || thread.resolved) return false;
  const message = editor.schema.nodes.commentMessage.create({ id: crypto.randomUUID(), author: author.trim().slice(0, 60) || 'Invitado', body: body.trim(), created: Date.now() });
  editor.view.dispatch(editor.state.tr.insert(thread.pos + thread.node.nodeSize - 1, message)); return true;
}
export function resolveComment(editor: Editor, id: string, resolved: boolean) {
  if (!editor.isEditable) return;
  const thread = documentComments(editor.state.doc).find(t => t.id === id);
  if (thread) editor.view.dispatch(editor.state.tr.setNodeMarkup(thread.pos, undefined, { ...thread.node.attrs, resolved }));
}
