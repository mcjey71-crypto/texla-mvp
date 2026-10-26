import CSL from 'citeproc';
import { cslHtmlToLatex } from './cslToLatex';
import apa from './csl/apa.csl?raw';
import ieee from './csl/ieee.csl?raw';
import vancouver from './csl/vancouver.csl?raw';
import en from './csl/locales-en-US.xml?raw';
import es from './csl/locales-es-ES.xml?raw';
import type { Reference, Person } from './references';

export type CitationStyle = 'ieee' | 'apa' | 'vancouver';
export const STYLE_LABELS = { ieee: 'IEEE', apa: 'APA 7', vancouver: 'Vancouver (NLM)' };
export const resolveStyle = (value: unknown): CitationStyle => value === 'apa' || value === 'vancouver' ? value : 'ieee';
/** Semicolon separates people; family, given is explicit. Unstructured names stay literal. */
export function parseAuthors(value: string): Person[] {
  return value.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const comma = part.indexOf(',');
    return comma >= 0 ? { family: part.slice(0, comma).trim(), given: part.slice(comma + 1).trim() } : { literal: part };
  });
}
export function toCsl(r: Reference) {
  const doi = r.doi || (r.id.startsWith('doi:') ? r.id.slice(4) : undefined);
  return { id: r.id, type: r.type || (r.journal ? 'article-journal' : 'webpage'), title: r.title,
    author: r.people?.length ? r.people : parseAuthors(r.authors),
    issued: r.issued?.length ? { 'date-parts': [r.issued] } : r.year ? { 'date-parts': [[Number(r.year)]] } : undefined,
    'container-title': r.journal || undefined, 'container-title-short': r.journalAbbreviation || undefined,
    volume: r.volume || undefined, issue: r.issue || undefined, page: r.pages || undefined, number: r.articleNumber || undefined, publisher: r.publisher || undefined,
    DOI: doi, URL: r.url };
}
export type FormattedReferences = { citations: Map<string, string>; html: string; textEntries: string[]; latexEntries: string[]; ids: string[]; hangingIndent: boolean; lineSpacing: number };
const cache = new Map<string, FormattedReferences>();
export function formatReferences(references: Reference[], style: CitationStyle): FormattedReferences {
  if (!references.length) return { citations: new Map(), html: '', textEntries: [], latexEntries: [], ids: [], hangingIndent: false, lineSpacing: 1 };
  const key = JSON.stringify([style, references]); const cached = cache.get(key); if (cached) return cached;
  const items = new Map(references.map(r => [r.id, toCsl(r)]));
  // English locale matches the source guides and avoids silently mixing localized variants.
  const engine = new CSL.Engine({ retrieveLocale: lang => lang.startsWith('es') ? es : en, retrieveItem: id => items.get(id) }, { apa, ieee, vancouver }[style], 'en-US', true);
  engine.updateItems(references.map(r => r.id));
  engine.setOutputFormat('text');
  const citations = new Map(references.map(r => [r.id, engine.makeCitationCluster([{ id: r.id }])]));
  const textResult = engine.makeBibliography();
  engine.setOutputFormat('html');
  const result = engine.makeBibliography();
  if (!result || !textResult) throw new Error('No se pudo generar la bibliografía. Revisa los datos de las fuentes.');
  const formatted = { citations, html: result[1].join(''), textEntries: textResult[1], latexEntries: result[1].map(cslHtmlToLatex), ids: result[0].entry_ids.map((entry: string[]) => entry[0]), hangingIndent: !!result[0].hangingindent, lineSpacing: Number(result[0].linespacing) || 1 };
  if (cache.size >= 6) cache.delete(cache.keys().next().value!);
  cache.set(key, formatted); return formatted;
}
