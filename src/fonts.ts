export const FONTS = [
  { id: 'Literata', css: 'Literata, Georgia, serif', latexFallback: 'TeX Gyre Pagella', pdfPackage: 'mathpazo' },
  { id: 'Times New Roman', css: '"Times New Roman", Tinos, serif', latexFallback: 'TeX Gyre Termes', pdfPackage: 'mathptmx' },
  { id: 'Arial', css: 'Arial, Arimo, sans-serif', latexFallback: 'TeX Gyre Heros', pdfPackage: 'helvet' },
  { id: 'Calibri', css: 'Calibri, Carlito, sans-serif', latexFallback: 'TeX Gyre Heros', pdfPackage: 'helvet' },
  { id: 'Cambria', css: 'Cambria, "STIX Two Text", serif', latexFallback: 'TeX Gyre Termes', pdfPackage: 'mathptmx' },
  { id: 'Georgia', css: 'Georgia, Literata, serif', latexFallback: 'TeX Gyre Pagella', pdfPackage: 'mathpazo' },
  { id: 'EB Garamond', css: '"EB Garamond", Georgia, serif', latexFallback: 'TeX Gyre Pagella', pdfPackage: 'mathpazo' },
  { id: 'STIX Two Text', css: '"STIX Two Text", Tinos, serif', latexFallback: 'TeX Gyre Termes', pdfPackage: 'mathptmx' },
] as const;
export type DocumentFont = typeof FONTS[number]['id'];
export function fontDefinition(value: unknown) { return FONTS.find(font => font.id === value) || FONTS[0]; }
export function fontLatex(value: DocumentFont): string {
  const font = fontDefinition(value);
  return `% Fuente elegida: ${font.id}. Para usarla exactamente, compila con XeLaTeX/LuaLaTeX y la fuente instalada.\n% pdfLaTeX usa una familia sustitutiva; las métricas pueden cambiar.\n\\usepackage{iftex}\n\\ifPDFTeX\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{${font.pdfPackage}}\n${font.pdfPackage === 'helvet' ? '\\renewcommand{\\familydefault}{\\sfdefault}\n' : ''}\\else\n\\usepackage{fontspec}\n\\IfFontExistsTF{${font.id}}{\\setmainfont{${font.id}}}{\\IfFontExistsTF{${font.latexFallback}}{\\setmainfont{${font.latexFallback}}}{\\setmainfont{Latin Modern Roman}}}\n\\fi\n`;
}
