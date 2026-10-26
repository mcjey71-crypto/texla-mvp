import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { nextSectionNumber } from './formalDocument';

export function documentHeadings(doc: PMNode) {
  const headings: { text: string; pos: number; level: number; number: string }[] = [];
  const counters = [0, 0];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') headings.push({ text: node.textContent, pos, level: node.attrs.level, number: nextSectionNumber(node.attrs.level, counters) });
  });
  return headings;
}
export const SectionNumbering = Extension.create<{ isNumbered: () => boolean }>({
  name: 'sectionNumbering', addOptions() { return { isNumbered: () => false }; },
  addProseMirrorPlugins() {
    const options = this.options;
    return [new Plugin({ key: new PluginKey('sectionNumbering'), props: { decorations(state) {
      return DecorationSet.create(state.doc, documentHeadings(state.doc).map(h => Decoration.node(h.pos, h.pos + state.doc.nodeAt(h.pos)!.nodeSize, {
        id: `texla-section-${h.pos}`, ...(options.isNumbered() && h.number ? { 'data-section-number': h.number } : {}),
      })));
    } } })];
  },
});
export const TableOfContents = Node.create<{ isNumbered: () => boolean }>({
  name: 'tableOfContents', group: 'block', atom: true, selectable: true,
  addOptions() { return { isNumbered: () => false }; },
  parseHTML() { return [{ tag: 'nav[data-type="table-of-contents"]' }]; },
  renderHTML() { return ['nav', { 'data-type': 'table-of-contents' }, 'Índice']; },
  renderText() { return '\nÍndice\n'; },
  addNodeView() {
    const numbered = this.options.isNumbered;
    return ({ editor }) => {
      const dom = document.createElement('nav'); dom.className = 'document-contents'; dom.dataset.type = 'table-of-contents'; dom.contentEditable = 'false'; dom.setAttribute('aria-label', 'Índice del documento');
      let last = '';
      const render = () => {
        const headings = documentHeadings(editor.state.doc).filter(h => h.level >= 2);
        const key = JSON.stringify([headings, numbered()]); if (key === last) return; last = key;
        dom.replaceChildren(); const title = document.createElement('h2'); title.textContent = 'Índice'; dom.append(title);
        if (!headings.length) { const hint = document.createElement('p'); hint.textContent = 'Aplica Sección o Subsección a tus encabezados para completar el índice.'; dom.append(hint); }
        for (const h of headings) {
          const link = document.createElement('a'); link.href = `#texla-section-${h.pos}`; link.className = h.level === 3 ? 'contents-child' : '';
          link.textContent = `${numbered() ? `${h.number}. ` : ''}${h.text || 'Sección sin título'}`;
          link.addEventListener('click', e => { e.preventDefault(); editor.chain().setTextSelection(h.pos + 1).scrollIntoView().run(); }); dom.append(link);
        }
      };
      render(); editor.on('transaction', render);
      return { dom, ignoreMutation: () => true, stopEvent: event => event.type === 'click', destroy() { editor.off('transaction', render); } };
    };
  },
});
export const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-type="page-break"]' }]; },
  renderHTML() { return ['div', { 'data-type': 'page-break', class: 'page-break', contenteditable: 'false' }, 'Salto de página']; },
  renderText() { return '\n'; },
});
