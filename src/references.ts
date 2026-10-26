import type { DocNode } from './document';

export type Person = { family?: string; given?: string; literal?: string };
export type Reference = {
  id: string; url: string; title: string; authors: string; year: string;
  people?: Person[]; type?: string; journal?: string; journalAbbreviation?: string;
  volume?: string; issue?: string; pages?: string; articleNumber?: string; publisher?: string;
  issued?: number[]; doi?: string; source?: 'Crossref' | 'DataCite'; retrievedAt?: string;
};

/** Conservative identity: keep meaningful query parameters and path case. */
export function normalizeReferenceLink(input: string): { id: string; url: string } {
  let value = input.trim().replace(/^doi:\s*/i, '');
  if (/^10\.\d{4,9}\//i.test(value)) value = `https://doi.org/${value}`;
  if (!/^https?:\/\//i.test(value) && !/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Introduce un enlace web válido o un DOI.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) {
    throw new Error('Usa un enlace http/https sin credenciales, o un DOI.');
  }
  if (/^(dx\.)?doi\.org$/i.test(url.hostname)) {
    let doi: string;
    try { doi = decodeURIComponent(url.pathname.slice(1)).toLowerCase(); } catch { throw new Error('El DOI contiene caracteres no válidos.'); }
    if (!/^10\.\d{4,9}\/\S+$/.test(doi)) throw new Error('El DOI debe tener el formato 10.xxxx/identificador.');
    return { id: `doi:${doi}`, url: `https://doi.org/${doi}` };
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  // HTTP and HTTPS versions identify the same source. Keep the usable input URL.
  const identity = new URL(url.href); identity.protocol = 'https:';
  return { id: identity.href, url: url.href };
}

export function validReference(value: unknown): value is Reference {
  if (!value || typeof value !== 'object') return false;
  const r = value as Reference;
  return typeof r.id === 'string' && typeof r.url === 'string' && typeof r.title === 'string'
    && typeof r.authors === 'string' && typeof r.year === 'string'
    && (() => { try { return normalizeReferenceLink(r.url).id === r.id; } catch { return false; } })();
}

/** Each source appears once, in order of first citation, including nested paragraphs. */
export function citedReferences(content: DocNode, library: Reference[] = []): Reference[] {
  const stored = new Map(library.map(r => [r.id, r]));
  const seen = new Set<string>(); const result: Reference[] = [];
  const visit = (node: DocNode) => {
    if (node.type === 'citation' && validReference(node.attrs?.reference)) {
      const reference = node.attrs!.reference as Reference;
      if (!seen.has(reference.id)) { seen.add(reference.id); result.push(stored.get(reference.id) || reference); }
    }
    node.content?.forEach(visit);
  };
  visit(content); return result;
}

export function mergeReferenceLibrary(library: Reference[], content: DocNode): Reference[] {
  const stored = new Map(library.map(r => [r.id, r]));
  for (const reference of citedReferences(content)) if (!stored.has(reference.id)) stored.set(reference.id, reference);
  return [...stored.values()];
}
