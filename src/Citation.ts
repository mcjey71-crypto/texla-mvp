import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { formatReferences, type CitationStyle } from './citationStyles';
import { citedReferences, type Reference, validReference } from './references';

export const Citation = Node.create<{ getStyle: () => CitationStyle; getLibrary: () => Reference[] }>({
  addOptions() { return { getStyle: () => 'ieee', getLibrary: () => [] }; },
  name: 'citation', group: 'inline', inline: true, atom: true, selectable: true,
  addAttributes() {
    return { reference: { default: null, rendered: false } };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="citation"]', getAttrs: element => {
      try {
        const reference = JSON.parse(element.getAttribute('data-reference') || 'null');
        return validReference(reference) ? { reference } : false;
      } catch { return false; }
    } }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-type': 'citation', 'data-reference': JSON.stringify(node.attrs.reference),
      class: 'citation', title: node.attrs.reference?.title || 'Referencia',
    })];
  },
  renderText({ node }) { return `[${node.attrs.reference?.title || 'Referencia'}]`; },
  addProseMirrorPlugins() {
    const options = this.options;
    return [new Plugin({
      key: new PluginKey('citationNumbering'),
      props: {
        decorations(state) {
          const references = citedReferences(state.doc.toJSON(), options.getLibrary());
          const formatted = formatReferences(references, options.getStyle());
          const numbers = new Map(references.map((r, i) => [r.id, i + 1])); const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'citation') return;
            const ref = node.attrs.reference;
            if (!validReference(ref)) return;
            if (!numbers.has(ref.id)) numbers.set(ref.id, numbers.size + 1);
            const number = numbers.get(ref.id)!;
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
              'data-citation-number': String(number),
              'data-citation-label': formatted.citations.get(ref.id) || '[?]',
              'aria-label': `${formatted.citations.get(ref.id)}: ${ref.title}`,
              role: 'doc-biblioref',
            }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
