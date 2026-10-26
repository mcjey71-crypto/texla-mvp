import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromCrossref, fromDataCite, lookupDoi, missingMetadata } from './doi';
import crossref from '../tests/fixtures/crossref.json';
import datacite from '../tests/fixtures/datacite.json';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {'Content-Type':'application/json'} });
describe('DOI metadata', () => {
 it('maps a real Crossref record including structured authors and publication fields', () => {
  const result = fromCrossref('10.1038/nphys1170',crossref.message);
  expect(result.title).toBe('Measured measurement'); expect(result.people).toEqual([{family:'Aspelmeyer',given:'Markus'}]);
  expect(result.year).toBe('2009'); expect(result.journal).toBe('Nature Physics'); expect(result.type).toBe('article-journal');
  expect(result.volume).toBe('5'); expect(result.issue).toBe('1'); expect(result.pages).toBe('11-12');
  expect(missingMetadata(result)).toEqual([]);
 });
 it('maps DataCite and reports genuinely missing publication metadata', () => {
  const result=fromDataCite('10.5281/zenodo.3242077',datacite.data.attributes);
  expect(result.year).toBe('2019');expect(result.people).toHaveLength(2);expect(result.type).toBe('article-journal');
  expect(missingMetadata(result)).toContain('revista');
 });
 it('rejects mismatched records and does not invent absent dates or authors', () => {
  expect(()=>fromCrossref('10.1000/a',crossref.message)).toThrow('no coincide');
  const result=fromCrossref('10.1000/empty',{DOI:'10.1000/empty',title:['A title'],type:'journal-article'});
  expect(missingMetadata(result)).toEqual(['autoría','año','revista']);expect(result.authors).toBe('');
 });
 it('falls back to DataCite only after Crossref returns 404; caches normalized DOI', async () => {
  const fetch=vi.fn().mockResolvedValueOnce(response({},404)).mockResolvedValueOnce(response(datacite));vi.stubGlobal('fetch',fetch);
  const result=await lookupDoi('10.5281/zenodo.3242077');expect(result.source).toBe('DataCite');
  expect(fetch.mock.calls[0][0]).toContain('api.crossref.org');expect(fetch.mock.calls[1][0]).toContain('api.datacite.org');
  await lookupDoi('https://doi.org/10.5281/ZENODO.3242077');expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('reports rate limiting without repeated automatic requests or fallback', async () => {
  const fetch=vi.fn().mockResolvedValue(response({},429));vi.stubGlobal('fetch',fetch);
  await expect(lookupDoi('10.1000/rate-limit')).rejects.toThrow('limitado');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('reports missing records and preserves a useful manual-entry path', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({},404)));
  await expect(lookupDoi('10.1000/missing')).rejects.toThrow('manualmente');
 });
 it('supports cancellation and refuses non-DOI URLs without network access', async () => {
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const controller=new AbortController();controller.abort();
  await expect(lookupDoi('10.1000/cancel',controller.signal)).rejects.toMatchObject({name:'AbortError'});
  await expect(lookupDoi('https://example.org/article')).rejects.toThrow('DOI');expect(fetch).not.toHaveBeenCalled();
 });
});
