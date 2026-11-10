import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentAnchor, CommentMessage, CommentThread, documentComments } from './comments';
import { makeBackup, readBackup, type SavedDocument } from './backup';
import { exportLatex } from './document';

const schema = getSchema([StarterKit, CommentThread, CommentMessage, CommentAnchor]);
function sample(): SavedDocument {
  return { id: 'test', title: 'Revisión', updated: 1, content: { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Texto del informe', marks: [{ type: 'commentAnchor', attrs: { id: 'thread-1' } }] }] },
    { type: 'commentThread', attrs: { id: 'thread-1', quote: 'Texto del informe', resolved: false }, content: [
      { type: 'commentMessage', attrs: { id: 'message-1', author: 'Ana', body: 'Revisar la fuente. \\input{private}', created: 100 } },
    ] },
  ] } };
}
describe('document comments', () => {
  it('keeps anchors and messages in editable backups but excludes review content from manuscript text and LaTeX', () => {
    const restored = readBackup(makeBackup(sample()));
    const node = schema.nodeFromJSON(restored.content); node.check();
    expect(node.textContent).toBe('Texto del informe');
    const threads = documentComments(node);
    expect(threads).toHaveLength(1); expect(threads[0].anchor).toEqual({ from: 1, to: 18 });
    expect(threads[0].messages[0].body).toContain('Revisar la fuente');
    const latex = exportLatex(restored.title, restored.content);
    expect(latex).toContain('Texto del informe'); expect(latex).not.toContain('Revisar la fuente'); expect(latex).not.toContain('private');
  });
  it('retains the conversation and quote if the associated text is deleted', () => {
    const doc = sample(); doc.content.content!.shift();
    const thread = documentComments(schema.nodeFromJSON(doc.content))[0];
    expect(thread.anchor).toBeUndefined(); expect(thread.quote).toBe('Texto del informe'); expect(thread.messages).toHaveLength(1);
  });
  it('rejects malformed or oversized comment messages in backups', () => {
    for (const patch of [{ body: {} }, { body: 'x'.repeat(4001) }, { author: null }, { created: -1 }]) {
      const doc = sample(); Object.assign(doc.content.content![1].content![0].attrs!, patch);
      expect(() => readBackup(makeBackup(doc))).toThrow('respuesta no válida');
    }
  });
});
