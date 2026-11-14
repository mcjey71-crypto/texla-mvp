import { resolveFormat, type DocumentFormat } from './formalDocument';
import { fontDefinition } from './fonts';
import { printPageSize } from './pageFormats';

// Strings are CSS content, not markup or style declarations, including for shared documents.
export function cssContent(text: string) {
  return '"' + text.replace(/[\\"\n\r\f<>]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ') + '"';
}
export function footerPositions(format: DocumentFormat) {
  return { brand: format.pageNumbers === 'bottom-left' ? 'right' : 'left', text: format.pageNumbers === 'bottom' ? 'right' : 'center' } as const;
}
export function pageNumberExample(number: number, style: DocumentFormat['pageNumberStyle']) {
  if (!Number.isInteger(number) || number < 1 || number > 10001) return String(number);
  if (style === 'arabic') return String(number);
  let result = '';
  for (const [value, letters] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const) {
    while (number >= value) { result += letters; number -= value; }
  }
  return style === 'roman' ? result.toLowerCase() : result;
}
export function runningPageCss(input: DocumentFormat) {
  const f = resolveFormat(input), family = fontDefinition(f.fontFamily).css;
  const numberSlot = f.pageNumbers === 'bottom' ? 'bottom-center' : f.pageNumbers;
  const style = f.pageNumberStyle === 'arabic' ? 'decimal' : f.pageNumberStyle === 'roman' ? 'lower-roman' : 'upper-roman';
  const slots: Record<string,string> = { 'top-left': f.headerMode === 'custom' && f.headerText ? cssContent(f.headerText) : '""', 'top-center':'""', 'top-right':'""', 'bottom-left':'""', 'bottom-center':'""', 'bottom-right':'""' };
  const positions = footerPositions(f);
  const brand=cssContent('Texla Docs - El arte de escribir bien');
  if(f.footerBrand)slots['bottom-center']=brand;
  const footerSlot=f.footerBrand&&positions.text==='center'?(f.pageNumbers==='bottom-left'?'right':'left'):positions.text;
  if (f.footerText) slots[`bottom-${footerSlot}`] = cssContent(f.footerText);
  if (f.pageNumbers !== 'none') slots[numberSlot] = `${cssContent(f.pageNumberPrefix)} counter(page, ${style}) ${cssContent(f.pageNumberSuffix)}`;
  if(f.footerBrand&&numberSlot==='bottom-center'&&f.pageNumbers!=='none')slots[numberSlot]+=` "\\a " ${brand}`;
  return `@media print {
    @page { size: ${printPageSize(f.pageSize)}; margin: ${f.margin}cm;
      ${Object.entries(slots).map(([slot,content]) => `@${slot} { content: ${content}; font-family: ${family}; font-size: ${slot==='bottom-center'&&f.footerBrand?'8':'9'}pt; color: ${slot==='bottom-center'&&f.footerBrand?'#739681':'#333'}; vertical-align: ${slot==='bottom-center'&&f.footerBrand?'bottom':'middle'}; ${slot==='bottom-center'&&f.footerBrand?'white-space:pre;line-height:14pt;padding-bottom:5mm;print-color-adjust:exact;-webkit-print-color-adjust:exact;':''} }`).join('\n')}
    }
    @page:first { counter-increment: page ${f.pageNumberStart}; ${!f.numberFirstPage && f.pageNumbers !== 'none' ? `@${numberSlot} { content: ${f.footerBrand&&numberSlot==='bottom-center'?brand:'""'}; }` : ''} }
  }`;
}
