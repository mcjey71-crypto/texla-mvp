import { normalizeReferenceLink, type Person, type Reference } from './references';

type RecordData = Record<string, any>;
const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number'
  ? String(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : '';
const first = (value: unknown) => text(Array.isArray(value) ? value[0] : value);
const formatNames = (people: Person[]) => people.map(p => p.literal || [p.family, p.given].filter(Boolean).join(', ')).join('; ');
const crossrefTypes: Record<string, string> = { 'journal-article': 'article-journal', 'book-chapter': 'chapter', book: 'book', 'monograph': 'book', 'proceedings-article': 'paper-conference', 'posted-content': 'article', dissertation: 'thesis', report: 'report', dataset: 'dataset' };
const dataciteTypes: Record<string, string> = { JournalArticle: 'article-journal', Book: 'book', BookChapter: 'chapter', ConferencePaper: 'paper-conference', Dataset: 'dataset', Dissertation: 'thesis', Report: 'report', Software: 'software', Preprint: 'article' };

function verifyDoi(doi: string, returned: unknown) {
  if (!text(returned) || normalizeReferenceLink(text(returned)).id !== normalizeReferenceLink(doi).id) throw new Error('El registro recibido no coincide con el DOI solicitado.');
}
export function fromCrossref(doi: string, m: RecordData): Reference {
  verifyDoi(doi, m.DOI);
  const people: Person[] = (Array.isArray(m.author) ? m.author : []).map((a: RecordData) => a.family || a.given ? { family: text(a.family), given: text(a.given) } : { literal: text(a.name) }).filter((p: Person) => p.family || p.given || p.literal);
  const date = (m.published || m['published-print'] || m['published-online'] || m.issued)?.['date-parts']?.[0];
  const issued = Array.isArray(date) ? date.filter((n: unknown) => Number.isInteger(n)) as number[] : [];
  const identity = normalizeReferenceLink(doi);
  return { ...identity, doi: identity.id.slice(4), title: first(m.title), people, authors: formatNames(people), year: issued[0] ? String(issued[0]) : '', issued,
    type: crossrefTypes[m.type] || 'article', journal: first(m['container-title']), journalAbbreviation: first(m['short-container-title']),
    volume: text(m.volume), issue: text(m.issue), pages: text(m.page), articleNumber: text(m['article-number']), publisher: text(m.publisher), source: 'Crossref', retrievedAt: new Date().toISOString() };
}
export function fromDataCite(doi: string, a: RecordData): Reference {
  verifyDoi(doi, a.doi);
  const people: Person[] = (Array.isArray(a.creators) ? a.creators : []).map((p: RecordData) => p.familyName || p.givenName ? { family: text(p.familyName), given: text(p.givenName) } : { literal: text(p.name) }).filter((p: Person) => p.family || p.given || p.literal);
  const year = /^\d{4}$/.test(String(a.publicationYear)) ? String(a.publicationYear) : '';
  const container = a.container || {};
  const identity = normalizeReferenceLink(doi);
  return { ...identity, doi: identity.id.slice(4), title: text(a.titles?.[0]?.title), people, authors: formatNames(people), year, issued: year ? [Number(year)] : [],
    type: dataciteTypes[a.types?.resourceTypeGeneral] || (['article-journal','book','chapter','paper-conference','report','thesis','dataset','software'].includes(a.types?.citeproc) ? a.types.citeproc : 'article'), journal: text(container.title), volume: text(container.volume), issue: text(container.issue),
    pages: [text(container.firstPage), text(container.lastPage)].filter(Boolean).join('-'), publisher: text(typeof a.publisher === 'object' ? a.publisher.name : a.publisher), source: 'DataCite', retrievedAt: new Date().toISOString() };
}
const cache = new Map<string, Reference>();
async function request(url: string, signal: AbortSignal): Promise<Response> {
  try { return await fetch(url, { signal, headers: { Accept: 'application/json' } }); }
  catch (e) { if (signal.aborted) throw e; throw new Error('No se pudo conectar con el registro bibliográfico. Comprueba tu conexión o completa los datos manualmente.'); }
}
export async function lookupDoi(input: string, signal?: AbortSignal): Promise<Reference> {
  const identity = normalizeReferenceLink(input);
  if (!identity.id.startsWith('doi:')) throw new Error('Para buscar datos automáticamente, introduce un DOI o un enlace de doi.org.');
  if (cache.has(identity.id)) return structuredClone(cache.get(identity.id)!);
  const doi = identity.id.slice(4); const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    let result: Reference;
    const crossref = await request(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, controller.signal);
    if (crossref.status === 404) {
      const datacite = await request(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, controller.signal);
      if (datacite.status === 404) throw new Error('No encontramos este DOI en Crossref ni DataCite. Revisa el identificador o introduce la fuente manualmente.');
      if (datacite.status === 429) throw new Error('DataCite ha limitado las consultas. Espera un momento antes de volver a buscar.');
      if (!datacite.ok) throw new Error('DataCite no está disponible ahora. Puedes completar la referencia manualmente.');
      result = fromDataCite(doi, (await datacite.json()).data?.attributes || {});
    } else {
      if (crossref.status === 429) throw new Error('Crossref ha limitado las consultas. Espera un momento antes de volver a buscar.');
      if (!crossref.ok) throw new Error('Crossref no está disponible ahora. Puedes completar la referencia manualmente.');
      result = fromCrossref(doi, (await crossref.json()).message || {});
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(identity.id, structuredClone(result));
    return result;
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('La consulta tardó demasiado. Vuelve a intentarlo o completa los datos manualmente.');
    throw e;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function missingMetadata(r: Reference): string[] {
  return [!r.title && 'título', !r.authors && 'autoría', !r.year && 'año', r.type === 'article-journal' && !r.journal && 'revista'].filter(Boolean) as string[];
}
