
import { pageFormat, type PageSize } from './pageFormats';
import { fontDefinition, type DocumentFont } from './fonts';
export type DocumentFormat = {
  pageSize: PageSize; fontSize: 10 | 11 | 12; fontFamily: DocumentFont;
  lineSpacing: 1 | 1.15 | 1.5 | 2; margin: 2 | 2.5 | 2.54 | 3;
  numberedSections: boolean; sectionStyle: 'sections' | 'chapters';
  firstLineIndent: 0 | 1.25 | 1.27; paragraphSpacing: 0 | 6;
  paragraphAlignment: 'left' | 'justify'; headingStyle: 'editorial' | 'formal' | 'apa' | 'cv';
  pageNumbers: 'bottom' | 'top-right' | 'none'; bibliographyGroups: boolean;
};
export const DEFAULT_FORMAT: DocumentFormat = { pageSize: 'A4', fontSize: 11, fontFamily: 'Literata', lineSpacing: 1.5, margin: 2.5, numberedSections: false, sectionStyle: 'sections', firstLineIndent: 0, paragraphSpacing: 6, paragraphAlignment: 'justify', headingStyle: 'editorial', pageNumbers: 'bottom', bibliographyGroups:false };
export const FORMAT_KEYS = Object.keys(DEFAULT_FORMAT) as (keyof DocumentFormat)[];
export function resolveFormat(value?: Partial<DocumentFormat>): DocumentFormat {
  return { pageSize: pageFormat(value?.pageSize).id, fontSize: value?.fontSize === 10 || value?.fontSize === 12 ? value.fontSize : 11,
    fontFamily: fontDefinition(value?.fontFamily).id,
    lineSpacing: [1,1.15,2].includes(value?.lineSpacing as number) ? value!.lineSpacing! : 1.5,
    margin: [2,2.54,3].includes(value?.margin as number) ? value!.margin! : 2.5, numberedSections: value?.numberedSections === true,
    sectionStyle: value?.sectionStyle === 'chapters' ? 'chapters' : 'sections',
    firstLineIndent: value?.firstLineIndent === 1.25 || value?.firstLineIndent === 1.27 ? value.firstLineIndent : 0,
    paragraphSpacing: value?.paragraphSpacing === 0 ? 0 : 6, paragraphAlignment: value?.paragraphAlignment === 'left' ? 'left' : 'justify',
    bibliographyGroups: value?.bibliographyGroups === true,
    headingStyle: value?.headingStyle === 'formal' || value?.headingStyle === 'apa' || value?.headingStyle === 'cv' ? value.headingStyle : 'editorial', pageNumbers: value?.pageNumbers === 'top-right' || value?.pageNumbers === 'none' ? value.pageNumbers : 'bottom',
  };
}
export function nextSectionNumber(level: number, counters: number[]): string {
  if (level < 2) return '';
  const depth = Math.min(level - 2, 2);
  counters[depth] = (counters[depth] || 0) + 1;
  for (let i = depth + 1; i < 3; i++) counters[i] = 0;
  return counters.slice(0, depth + 1).map(n => n || 0).join('.');
}
export { createTemplate, TEMPLATES, type TemplateId } from './templates';
