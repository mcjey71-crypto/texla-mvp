import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Numbers are derived from document order, never saved into the content.
// Inserting, deleting, moving, undoing or switching documents recalculates them.
export const EquationNumbering = Extension.create({
  name: 'equationNumbering',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('equationNumbering'),
      props: {
        decorations(state) {
          let number = 0;
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'blockMath') return;
            number += 1;
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
              'data-equation-number': String(number),
              'aria-label': `Ecuación ${number}. Haz clic para editar.`,
            }));
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
