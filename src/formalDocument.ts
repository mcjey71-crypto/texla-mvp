
import { pageFormat, type PageSize } from './pageFormats';
import { fontDefinition, type DocumentFont } from './fonts';
export type DocumentFormat = {
  pageSize: PageSize; fontSize: 10 | 11 | 12; fontFamily: DocumentFont;
  lineSpacing: 1 | 1.15 | 1.5 | 2; margin: 2 | 2.5 | 2.54 | 3;
  numberedSections: boolean; sectionStyle: 'sections' | 'chapters';
  firstLineIndent: 0 | 1.25 | 1.27; paragraphSpacing: 0 | 6;
  paragraphAlignment: 'left' | 'justify'; headingStyle: 'editorial' | 'formal' | 'apa' | 'cv';
  pageNumbers: 'bottom' | 'bottom-left' | 'bottom-right' | 'top-right' | 'none'; bibliographyGroups: boolean;
  headerMode: 'auto' | 'custom' | 'none'; headerText: string; footerText: string; footerBrand: boolean;
  pageNumberStart: number; pageNumberStyle: 'arabic' | 'roman' | 'Roman'; numberFirstPage: boolean;
  pageNumberPrefix: string; pageNumberSuffix: string;
};
export const DEFAULT_FORMAT: DocumentFormat = { pageSize: 'A4', fontSize: 11, fontFamily: 'Literata', lineSpacing: 1.5, margin: 2.5, numberedSections: false, sectionStyle: 'sections', firstLineIndent: 0, paragraphSpacing: 6, paragraphAlignment: 'justify', headingStyle: 'editorial', pageNumbers: 'bottom', bibliographyGroups:false, headerMode:'auto',headerText:'',footerText:'',footerBrand:true,pageNumberStart:1,pageNumberStyle:'arabic',numberFirstPage:true,pageNumberPrefix:'',pageNumberSuffix:'' };
export const FORMAT_KEYS = Object.keys(DEFAULT_FORMAT) as (keyof DocumentFormat)[];
export function resolveFormat(value?: Partial<DocumentFormat>): DocumentFormat {
  const plain = (text: unknown, limit: number) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit) : '';
  return { pageSize: pageFormat(value?.pageSize).id, fontSize: value?.fontSize === 10 || value?.fontSize === 12 ? value.fontSize : 11,
    fontFamily: fontDefinition(value?.fontFamily).id,
    lineSpacing: [1,1.15,2].includes(value?.lineSpacing as number) ? value!.lineSpacing! : 1.5,
    margin: [2,2.54,3].includes(value?.margin as number) ? value!.margin! : 2.5, numberedSections: value?.numberedSections === true,
    sectionStyle: value?.sectionStyle === 'chapters' ? 'chapters' : 'sections',
    firstLineIndent: value?.firstLineIndent === 1.25 || value?.firstLineIndent === 1.27 ? value.firstLineIndent : 0,
    paragraphSpacing: value?.paragraphSpacing === 0 ? 0 : 6, paragraphAlignment: value?.paragraphAlignment === 'left' ? 'left' : 'justify',
    bibliographyGroups: value?.bibliographyGroups === true,
    headingStyle: value?.headingStyle === 'formal' || value?.headingStyle === 'apa' || value?.headingStyle === 'cv' ? value.headingStyle : 'editorial', pageNumbers: ['top-right','bottom-left','bottom-right','none'].includes(value?.pageNumbers || '') ? value!.pageNumbers! : 'bottom',
    headerMode: value?.headerMode === 'custom' || value?.headerMode === 'none' ? value.headerMode : 'auto',
    headerText:plain(value?.headerText,120),footerText:plain(value?.footerText,120),footerBrand:value?.footerBrand!==false,
    pageNumberStart:Number.isInteger(value?.pageNumberStart)&&value!.pageNumberStart!>=1&&value!.pageNumberStart!<=9999?value!.pageNumberStart!:1,
    pageNumberStyle:value?.pageNumberStyle==='roman'||value?.pageNumberStyle==='Roman'?value.pageNumberStyle:'arabic',
    numberFirstPage:value?.numberFirstPage!==false,pageNumberPrefix:plain(value?.pageNumberPrefix,30),pageNumberSuffix:plain(value?.pageNumberSuffix,30),
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
