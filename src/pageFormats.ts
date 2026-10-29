export const PAGE_FORMATS = [
  { id: 'A4', label: 'A4 · 210 × 297 mm', width: 210, height: 297 },
  { id: 'Carta', label: 'Carta · 216 × 279 mm', width: 215.9, height: 279.4 },
  { id: 'A5', label: 'A5 · 148 × 210 mm', width: 148, height: 210 },
  { id: 'A3', label: 'A3 · 297 × 420 mm', width: 297, height: 420 },
  { id: 'A2', label: 'A2 · 420 × 594 mm', width: 420, height: 594 },
  { id: 'A1', label: 'A1 · 594 × 841 mm', width: 594, height: 841 },
  { id: 'Continuo', label: 'Continuo — sin páginas', width: 210, height: 297 },
] as const;
export type PageSize = typeof PAGE_FORMATS[number]['id'];
export const pageFormat = (value: unknown) => PAGE_FORMATS.find(page => page.id === value) || PAGE_FORMATS[0];
export const printPageSize = (value: PageSize) => {
  const page = pageFormat(value);
  // CSS does not support the A1/A2 keywords; explicit dimensions work for all sizes.
  return `${page.width}mm ${page.height}mm`;
};
export function latexPage(value: PageSize) {
  const page = pageFormat(value);
  // article only supports A4/A5/letter; geometry supplies the larger ISO sizes.
  return { classOption: value === 'Carta' ? 'letterpaper' : value === 'A5' ? 'a5paper' : 'a4paper', geometry: `paperwidth=${page.width}mm,paperheight=${page.height}mm` };
}
