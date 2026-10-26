import { describe, expect, it } from 'vitest';
import { formatReferences, parseAuthors } from './citationStyles';
import { normalizeReferenceLink, type Reference } from './references';
import { exportLatex } from './document';
const paper = (doi: string, family: string, year: number, title = 'A study of scientific writing'): Reference => ({ ...normalizeReferenceLink(doi), doi, title, authors: `${family}, Ana`, people: [{ family, given: 'Ana' }], year: String(year), issued: [year], type: 'article-journal', journal: 'Journal of Research', journalAbbreviation: 'J Res', volume: '12', issue: '3', pages: '123-129' });
const z = paper('10.1000/z', 'Zapata', 2024); const a = paper('10.1000/a', 'Alonso', 2020);
describe('CSL styles', () => {
 it('uses APA author-date citations, alphabetical bibliography and italic journal/volume', () => {
  const result = formatReferences([z, a], 'apa');
  expect(result.citations.get(z.id)).toBe('(Zapata, 2024)');
  expect(result.ids).toEqual([a.id, z.id]);
  expect(result.html).toContain('<i>Journal of Research</i>');
  expect(result.html).toContain('<i>12</i>');
  expect(result.textEntries[0]).toContain('Alonso, A. (2020)');
  expect(result.textEntries[0]).toContain('https://doi.org/10.1000/a');
  expect(result.hangingIndent).toBe(true);
 });
 it('disambiguates APA works by the same author and year, and uses et al. for 3 authors', () => {
  const same = { ...paper('10.1000/b','Zapata',2024,'Another study') };
  const result = formatReferences([z,same], 'apa');
  expect(new Set([...result.citations.values()]).size).toBe(2);
  expect([...result.citations.values()].join(' ')).toMatch(/2024a/);
  expect([...result.citations.values()].join(' ')).toMatch(/2024b/);
  const team = { ...z, people: [{ family:'Zapata',given:'Ana' },{ family:'Alonso',given:'Luis' },{ family:'Pérez',given:'María' }] };
  expect(formatReferences([team],'apa').citations.get(z.id)).toBe('(Zapata et al., 2024)');
 });
 it('uses IEEE bracketed numbers and first-citation bibliography order', () => {
  const result = formatReferences([z,a],'ieee');
  expect(result.citations.get(z.id)).toBe('[1]'); expect(result.citations.get(a.id)).toBe('[2]');
  expect(result.ids).toEqual([z.id,a.id]);
  expect(result.textEntries[0]).toContain('A. Zapata');
  expect(result.textEntries[0]).toContain('vol. 12'); expect(result.textEntries[0]).toContain('no. 3');
 });
 it('uses Vancouver NLM parentheses and journal abbreviation', () => {
  const result = formatReferences([z,a],'vancouver');
  expect(result.citations.get(z.id)).toBe('(1)'); expect(result.ids).toEqual([z.id,a.id]);
  expect(result.textEntries[0]).toContain('Zapata A');
  expect(result.textEntries[0]).toContain('J Res');
  expect(result.textEntries[0]).toMatch(/2024;12\(3\):123/);
 });
 it('preserves structured author names without guessing from spaces', () => {
  expect(parseAuthors('García López, Ana María; Universidad Nacional')).toEqual([{ family:'García López',given:'Ana María' },{ literal:'Universidad Nacional' }]);
 });
 it('matches APA and NLM journal examples from the reviewed guides', () => {
  const apa: Reference = { id:'sample-apa', url:'', title:'The eclipse of listening', authors:'Scruton, Roger', people:[{family:'Scruton',given:'Roger'}], year:'1996', type:'article-journal', journal:'The New Criterion', volume:'15', issue:'3', pages:'5-13' };
  expect(formatReferences([apa],'apa').textEntries[0].trim()).toBe('Scruton, R. (1996). The eclipse of listening. The New Criterion, 15(3), 5–13.');
  const nlm: Reference = { id:'sample-nlm', url:'', title:'Solid-organ transplantation in HIV-infected patients', authors:'', people:[{family:'Halpern',given:'Scott D'},{family:'Ubel',given:'Peter A'},{family:'Caplan',given:'Arthur L'}], year:'2002', issued:[2002,7,25], type:'article-journal', journal:'New England Journal of Medicine', journalAbbreviation:'N Engl J Med', volume:'347', issue:'4', pages:'284-287' };
  expect(formatReferences([nlm],'vancouver').textEntries[0].replace(/\s+/g,' ').trim()).toBe('1. Halpern SD, Ubel PA, Caplan AL. Solid-organ transplantation in HIV-infected patients. N Engl J Med. 2002 Jul 25;347(4):284–7.');
 });
 it('distinguishes electronic article numbers from page ranges', () => {
  const article = {...z, pages:'', articleNumber:'e12345'};
  expect(formatReferences([article],'ieee').textEntries[0]).toContain('Art. no. e12345');
  expect(formatReferences([article],'apa').textEntries[0]).toContain('Article e12345');
  expect(formatReferences([article],'ieee').textEntries[0]).not.toContain('pp. e12345');
 });
 it('exports selected APA citations and CSL typography without numeric labels', () => {
  const out = exportLatex('Tesis',{type:'doc',content:[{type:'paragraph',content:[{type:'citation',attrs:{reference:z}},{type:'citation',attrs:{reference:a}}]}]},[z,a],'apa');
  expect(out).toContain('\\hyperlink{ref1}{(Zapata, 2024)}');
  expect(out.indexOf('Alonso, A. (2020)')).toBeLessThan(out.indexOf('Zapata, A. (2024)'));
  expect(out).toContain('\\textit{Journal of Research}'); expect(out).toContain('\\hangindent=1.27cm');
  expect(out).not.toContain('[1]');
 });
});
