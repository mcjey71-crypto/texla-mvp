import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { validReference } from './references';

export const Citation = Node.create({
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
    return [new Plugin({
      key: new PluginKey('citationNumbering'),
      props: {
        decorations(state) {
          const numbers = new Map<string, number>(); const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'citation') return;
            const ref = node.attrs.reference;
            if (!validReference(ref)) return;
            if (!numbers.has(ref.id)) numbers.set(ref.id, numbers.size + 1);
            const number = numbers.get(ref.id)!;
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
              'data-citation-number': String(number),
              'aria-label': `Referencia ${number}: ${ref.title}`,
              role: 'doc-biblioref',
            }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
