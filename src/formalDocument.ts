import type { DocNode } from './document';
import type { CitationStyle } from './citationStyles';

export type DocumentFormat = { pageSize: 'A4' | 'Carta'; fontSize: 11 | 12; lineSpacing: 1 | 1.5 | 2; margin: 2 | 2.5 | 3; numberedSections: boolean };
export const DEFAULT_FORMAT: DocumentFormat = { pageSize: 'A4', fontSize: 11, lineSpacing: 1.5, margin: 2.5, numberedSections: false };
export function resolveFormat(value?: Partial<DocumentFormat>): DocumentFormat {
  return { pageSize: value?.pageSize === 'Carta' ? 'Carta' : 'A4', fontSize: value?.fontSize === 12 ? 12 : 11,
    lineSpacing: value?.lineSpacing === 1 || value?.lineSpacing === 2 ? value.lineSpacing : 1.5,
    margin: value?.margin === 2 || value?.margin === 3 ? value.margin : 2.5, numberedSections: value?.numberedSections === true };
}
export function nextSectionNumber(level: number, counters: number[]): string {
  if (level < 2) return '';
  const depth = Math.min(level - 2, 1);
  counters[depth] = (counters[depth] || 0) + 1;
  if (depth === 0) counters[1] = 0;
  return counters.slice(0, depth + 1).join('.');
}
export type TemplateId = 'thesis' | 'article' | 'report';
export const TEMPLATES: { id: TemplateId; title: string; description: string }[] = [
  { id: 'thesis', title: 'Tesis', description: 'Resumen, índice, problema, marco teórico, metodología y resultados.' },
  { id: 'article', title: 'Artículo académico', description: 'Resumen, palabras clave, introducción, métodos, resultados y discusión.' },
  { id: 'report', title: 'Informe técnico', description: 'Objetivo, alcance, procedimiento, resultados y recomendaciones.' },
];
const text = (value: string): DocNode[] => [{ type: 'text', text: value }];
const paragraph = (value: string): DocNode => ({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: text(value) });
const heading = (value: string, level = 2): DocNode => ({ type: 'heading', attrs: { level }, content: text(value) });
export function createTemplate(id: TemplateId): { title: string; content: DocNode; format: DocumentFormat; citationStyle: CitationStyle } {
  const sections = {
    thesis: ['Planteamiento del problema', 'Objetivos', 'Marco teórico', 'Metodología', 'Resultados', 'Discusión', 'Conclusiones'],
    article: ['Introducción', 'Materiales y métodos', 'Resultados', 'Discusión', 'Conclusiones'],
    report: ['Objetivo y alcance', 'Antecedentes', 'Procedimiento', 'Resultados y análisis', 'Conclusiones', 'Recomendaciones'],
  }[id];
  const title = { thesis: 'Mi tesis', article: 'Mi artículo académico', report: 'Mi informe técnico' }[id];
  return { title, citationStyle: id === 'report' ? 'ieee' : 'apa', format: { ...DEFAULT_FORMAT, fontSize: 12, numberedSections: true }, content: { type: 'doc', content: [
    heading(title, 1), paragraph('Autoría: escribe tu nombre. Institución: escribe tu institución.'),
    heading('Resumen'), paragraph('Resume el propósito, el método, los principales resultados y las conclusiones de tu trabajo.'),
    paragraph('Palabras clave: añade los términos principales de tu investigación.'),
    ...(id === 'article' ? [] : [{ type: 'tableOfContents' }, { type: 'pageBreak' }]),
    ...sections.flatMap(section => [heading(section), paragraph(`Desarrolla aquí: ${section.toLowerCase()}.`)]),
  ] } };
}
