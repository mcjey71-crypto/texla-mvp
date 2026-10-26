import { describe, expect, it } from 'vitest';
import { normalizeReferenceLink, citedReferences, mergeReferenceLibrary, validReference, type Reference } from './references';
import { exportLatex, type DocNode } from './document';
const source = (link: string, title: string): Reference => ({ ...normalizeReferenceLink(link), title, authors: 'García & Pérez', year: '2026' });
const a = source('https://doi.org/10.1000/alpha', 'Fuente A');
const b = source('https://example.org/study?id=2', 'Fuente B');
const citation = (reference: Reference): DocNode => ({ type: 'citation', attrs: { reference } });
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
describe('reference identity', () => {
 it('recognizes DOI forms, case and resolver URLs', () => {
  for (const link of ['10.1000/ALPHA', 'doi:10.1000/alpha', 'http://dx.doi.org/10.1000/Alpha', 'https://doi.org/10.1000/alpha?utm_source=chatgpt']) {
   expect(normalizeReferenceLink(link).id).toBe(a.id);
  }
 });
 it('ignores tracking and fragments while preserving source query parameters', () => {
  expect(normalizeReferenceLink('http://example.org/study?utm_source=ai&id=2#section').id).toBe(b.id);
  expect(normalizeReferenceLink('https://example.org/study?id=3').id).not.toBe(b.id);
  expect(normalizeReferenceLink('https://example.org/Study?id=2').id).not.toBe(b.id);
  expect(normalizeReferenceLink('https://example.org/a?b=2&a=1').id).toBe(normalizeReferenceLink('https://example.org/a?a=1&b=2').id);
 });
 it('rejects invalid links and unsafe protocols', () => {
  for (const link of ['', 'texto sin enlace', 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.org', 'https://doi.org/not-a-doi']) expect(() => normalizeReferenceLink(link)).toThrow();
  expect(validReference({ ...a, url: 'javascript:alert(1)' })).toBe(false);
 });
});
describe('citation order and persistence', () => {
 it('deduplicates repeated sources and follows first appearance, including nested paragraphs', () => {
  const content = doc({ type: 'paragraph', content: [citation(a)] }, { type: 'blockquote', content: [{ type: 'paragraph', content: [citation(b), citation(a)] }] });
  expect(citedReferences(content).map(r => r.id)).toEqual([a.id, b.id]);
  expect(citedReferences(doc(citation(b), citation(a))).map(r => r.id)).toEqual([b.id, a.id]);
  expect(citedReferences(doc(citation(b))).map(r => r.id)).toEqual([b.id]);
 });
 it('keeps unused sources and recovers embedded references when pasting into another document', () => {
  expect(mergeReferenceLibrary([a, b], doc())).toEqual([a, b]);
  expect(mergeReferenceLibrary([], doc(citation(a), citation(a)))).toEqual([a]);
 });
 it('exports one bibliography entry per cited source, consistent numbers and escaped metadata', () => {
  const out = exportLatex('Tesis', doc({ type: 'paragraph', content: [citation(b), citation(a), citation(b)] }), [a, b]);
  expect(out).toContain('\\hyperlink{ref1}{[1]}\\hyperlink{ref2}{[2]}\\hyperlink{ref1}{[1]}');
  expect(out.match(/\\hypertarget/g)).toHaveLength(2);
  expect(out).toContain('\\hypertarget{ref1}{}[1]');
  expect(out).toContain('García \\& Pérez');
  expect(out).toContain('Fuente B');
  expect(out).toContain('https://example.org/study?id=2');
  expect(exportLatex('Vacío', doc(), [a, b])).not.toContain('thebibliography');
 });
 it('ignores malformed citation metadata', () => {
  expect(citedReferences(doc({ type: 'citation', attrs: { reference: { title: 'bad' } } }))).toEqual([]);
 });
});
