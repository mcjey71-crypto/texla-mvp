import { describe, expect, it } from 'vitest';
import { parseMathText, exportLatex, nodeToLatex } from './document';
describe('AI math paste', () => {
 it('preserves mixed text and all four math delimiters', () => {
  const blocks = parseMathText('Antes $x^2$ y \\(y\\).\n$$E=mc^2$$\n\\[a+b=c\\]\nDespués');
  expect(blocks[0].content?.map(n => n.type)).toEqual(['text', 'inlineMath', 'text', 'inlineMath', 'text']);
  expect(blocks.filter(n => n.type === 'blockMath').map(n => n.attrs?.latex)).toEqual(['E=mc^2', 'a+b=c']);
  expect(blocks.at(-1)?.content?.[0].text).toBe('Después');
 });
 it('retains multiline equations and escaped dollars', () => {
  expect(parseMathText('\\[\\begin{aligned}a&=b\\\\\nc&=d\\end{aligned}\\]')[0].attrs?.latex).toContain('\nc&=d');
  expect(parseMathText('Precio \\$10 sin fórmula')[0].content?.[0].type).toBe('text');
 });
});
describe('LaTeX export', () => {
 it('escapes prose without corrupting mathematical commands', () => {
  const out = exportLatex('Tesis & ciencia', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '50% & a_b', marks: [{ type: 'bold' }] }] }, { type: 'blockMath', attrs: { latex: '\\frac{a}{b}' } }] });
  expect(out).toContain('\\textbf{50\\% \\& a\\_b}'); expect(out).toContain('\\begin{equation}\n\\frac{a}{b}\n\\end{equation}'); expect(out).toContain('\\end{document}');
 });
 it('exports headings, lists and emphasis', () => {
  expect(nodeToLatex({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Resumen' }] })).toContain('\\subsection*{Resumen}');
  expect(nodeToLatex({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una idea' }] }] }] })).toContain('\\item Una idea');
 });
});
describe('formal equation numbering', () => {
 it('uses automatic LaTeX numbering for blocks while keeping inline formulas unnumbered', () => {
  const out = exportLatex('Resultados', { type: 'doc', content: parseMathText('Texto $a+b$\n$$E=mc^2$$\nTexto\n\\[x^2+y^2=z^2\\]') });
  expect(out.match(/\\begin\{equation\}/g)).toHaveLength(2);
  expect(out.match(/\\end\{equation\}/g)).toHaveLength(2);
  expect(out).toContain('$a+b$');
  expect(out).not.toContain('\\tag');
 });
});
