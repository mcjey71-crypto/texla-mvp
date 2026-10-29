import { resolveFormat, type DocumentFormat } from './formalDocument';
import { tableToLatex } from './tableLatex';
import { latexPage } from './pageFormats';
import { fontLatex } from './fonts';
import { formatReferences, referenceGroups, type CitationStyle } from './citationStyles';
import { citedReferences, type Reference } from './references';
export type DocNode = { type: string; text?: string; attrs?: Record<string, any>; marks?: { type: string; attrs?: Record<string, any> }[]; content?: DocNode[] };
// ChatGPT, Claude and other tools commonly emit these four math delimiters.
export function parseMathText(text: string): DocNode[] {
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  const blocks: DocNode[] = []; let line: DocNode[] = []; let end = 0;
  const flush = () => { if (line.length) { blocks.push({ type: 'paragraph', content: line }); line = []; } };
  const appendText = (value: string) => value.split('\n').forEach((part, index) => { if (index) flush(); if (part) line.push({ type: 'text', text: part }); });
  for (const match of text.matchAll(pattern)) {
    appendText(text.slice(end, match.index));
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4]).trim();
    if (match[1] !== undefined || match[2] !== undefined) { flush(); blocks.push({ type: 'blockMath', attrs: { latex } }); }
    else line.push({ type: 'inlineMath', attrs: { latex } });
    end = match.index! + match[0].length;
  }
  appendText(text.slice(end)); flush(); return blocks.length ? blocks : [{ type: 'paragraph' }];
}
const escapeTex = (s: string) => s.replace(/[\\{}$&#%_~^]/g, c => ({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' }[c]!));
export function nodeToLatex(node: DocNode, citationNumbers: Map<string, number> = new Map(), citationLabels?: Map<string, string>, format = resolveFormat(), bibliographyContent = ''): string {
  if (node.type === 'text') { let text = escapeTex(node.text || ''); for (const mark of node.marks || []) { if (mark.type === 'bold') text = `\\textbf{${text}}`; if (mark.type === 'italic') text = `\\textit{${text}}`; if (mark.type === 'underline') text = `\\underline{${text}}`; } return text; }
  if (node.type === 'citation') { const number = citationNumbers.get(node.attrs?.reference?.id); return number ? citationLabels ? `\\hyperlink{ref${number}}{${escapeTex(citationLabels.get(node.attrs?.reference?.id) || '[?]')}}` : `\\cite{ref${number}}` : '[referencia no disponible]'; }
  if (node.type === 'inlineMath') return `$${node.attrs?.latex || ''}$`;
  if (node.type === 'blockMath') return `\n\\begin{equation}\n${node.attrs?.latex || ''}\n\\end{equation}\n`;
  if (node.type === 'bibliographyAnchor') return bibliographyContent || `\\section*{Referencias bibliográficas}\n\\phantomsection\n\\addcontentsline{toc}{section}{Referencias bibliográficas}\n${format.bibliographyGroups ? '\\subsection*{Referencias primarias}\n\\subsection*{Referencias complementarias}\n' : ''}`;
  if (node.type === 'table') return tableToLatex(node, child => nodeToLatex(child, citationNumbers, citationLabels, format, bibliographyContent));
  if (node.type === 'tableOfContents') return '\\tableofcontents\n';
  if (node.type === 'pageBreak') return format.pageSize === 'Continuo' ? '\n' : '\\clearpage\n';
  const inner = (node.content || []).map(child => nodeToLatex(child, citationNumbers, citationLabels, format, bibliographyContent)).join('');
  switch (node.type) {
    case 'heading': {
      if (node.attrs?.level === 1 && format.headingStyle === 'cv') return `\n\\begin{center}\\Large\\bfseries ${inner}\\end{center}\n`;
      if (node.attrs?.level === 1) return `\n\\section*{${inner}}\n`;
      const command = node.attrs?.level === 2 ? 'section' : node.attrs?.level === 3 ? 'subsection' : 'subsubsection';
      const numbered = format.numberedSections && node.attrs?.numbered !== false;
      return `\n\\${command}${numbered ? '' : '*'}{${inner}}\n${numbered ? '' : `\\phantomsection\n\\addcontentsline{toc}{${command}}{${inner}}\n`}`;
    }
    case 'paragraph': {
      // LaTeX paragraphs are justified by default. Scope other alignments so
      // they cannot change the following justified paragraph.
      const alignment = { left: '\\raggedright', center: '\\centering', right: '\\raggedleft' }[(node.attrs?.textAlign || format.paragraphAlignment) as 'left' | 'center' | 'right'];
      return alignment ? `\\begingroup${alignment}\n${inner}\\par\\endgroup\n\n` : `${inner}\n\n`;
    }
    case 'bulletList': return `\\begin{itemize}\n${inner}\\end{itemize}\n`;
    case 'orderedList': return `\\begin{enumerate}\n${inner}\\end{enumerate}\n`;
    case 'listItem': return `\\item ${inner}`;
    case 'blockquote': return `\\begin{quote}\n${inner}\\end{quote}\n`;
    case 'hardBreak': return '\\\\\n';
    case 'horizontalRule': return '\\medskip\\hrule\\medskip\n';
    default: return inner;
  }
}
export function exportLatex(title: string, content: DocNode, library: Reference[] = [], style: CitationStyle = 'ieee', options?: Partial<DocumentFormat>): string {
  const format = resolveFormat(options);
  const paper = latexPage(format.pageSize);
  const references = citedReferences(content, library);
  const numbers = new Map(references.map((ref, index) => [ref.id, index + 1]));
  const formatted = formatReferences(references, style);
  const entry = (i: number) => {
    const number = numbers.get(formatted.ids[i]);
    return `${style === 'apa' ? '\\hangindent=1.27cm\\hangafter=1 ' : ''}\\hypertarget{ref${number}}{}${formatted.latexEntries[i]}\\par${style === 'apa' ? '' : '\\medskip'}`;
  };
  const entries = format.bibliographyGroups ? referenceGroups(references,formatted).map(group=>`\\subsection*{${group.title}}\n${group.indices.map(entry).join('\n')}`).join('\n') : formatted.ids.map((_,i)=>entry(i)).join('\n');
  const bibliography = references.length ? `\n\\clearpage\n${style === 'apa' ? '\\begin{center}\\textbf{Referencias}\\end{center}' : '\\section*{Referencias}'}\n\\phantomsection\n\\addcontentsline{toc}{section}{Referencias}\n\\begingroup\n\\setlength{\\parindent}{0pt}\n${style === 'apa' ? '\\begin{spacing}{2}\n' : ''}${entries}\n${style === 'apa' ? '\\end{spacing}\n' : ''}\\endgroup\n` : '';

  const anchored = (node: DocNode): boolean => node.type === 'bibliographyAnchor' || !!node.content?.some(anchored);
  const structure = format.headingStyle === 'cv' ? `\\usepackage{titlesec}\n\\titleformat{\\section}{\\bfseries\\normalsize}{}{0pt}{}[\\titlerule]\n\\titlespacing*{\\section}{0pt}{8pt}{4pt}\n\\let\\cvitemize\\itemize\n\\let\\endcvitemize\\enditemize\n\\renewenvironment{itemize}{\\cvitemize\\setlength{\\itemsep}{0pt}\\setlength{\\parsep}{0pt}\\setlength{\\topsep}{0pt}}{\\endcvitemize}\n` : format.headingStyle !== 'editorial' ? `\\usepackage{titlesec}\n\\titleformat{\\section}${format.sectionStyle === 'chapters' ? '[display]' : ''}{\\centering\\bfseries${format.headingStyle === 'apa' ? '\\normalsize' : '\\fontsize{16}{20}\\selectfont'}}{${format.sectionStyle === 'chapters' ? 'CAPÍTULO \\Roman{section}' : '\\thesection'}}{0.5em}{}\n\\titleformat{\\subsection}{\\bfseries\\normalsize}{\\thesubsection}{0.5em}{}\n\\titleformat{\\subsubsection}{\\bfseries\\normalsize}{\\thesubsubsection}{0.5em}{}\n` : '';
  const pageNumbers = format.pageNumbers === 'none' ? '\\pagestyle{empty}\n' : format.pageNumbers === 'top-right' ? '\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyhead[R]{\\thepage}\n\\renewcommand{\\headrulewidth}{0pt}\n\\setlength{\\headheight}{15pt}\n' : '\\pagestyle{plain}\n';
  return `\\documentclass[${format.fontSize}pt,${paper.classOption}]{article}\n${fontLatex(format.fontFamily)}\\usepackage[spanish]{babel}\n\\usepackage{amsmath,amssymb}\n\\usepackage{xurl}\n\\urlstyle{same}\n\\usepackage{setspace}\n\\usepackage{longtable,array,booktabs,multirow}\n\\usepackage[${paper.geometry},margin=${format.margin}cm]{geometry}\n\\setstretch{${format.lineSpacing}}\n\\setlength{\\parindent}{${format.firstLineIndent}cm}\n\\setlength{\\parskip}{${format.paragraphSpacing}pt}\n${format.firstLineIndent ? '\\usepackage{indentfirst}\n' : ''}${structure}${pageNumbers}\\usepackage[hidelinks]{hyperref}\n\\setlength{\\emergencystretch}{2em}\n\\title{${escapeTex(title)}}\n\\date{}\n\\begin{document}\n${nodeToLatex(content, numbers, formatted.citations, format, bibliography)}${anchored(content) ? '' : bibliography}\n\\end{document}\n`;
}
export const initialContent: DocNode = { type: 'doc', content: [
 { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'El lenguaje del universo' }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'Una exploración de la belleza matemática que conecta nuestras ideas con el mundo.', marks: [{ type: 'italic' }] }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'POR EL EQUIPO DE TEXLA  ·  LECTURA DE 3 MINUTOS' }] },
 { type: 'horizontalRule' },
 { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Donde las ideas toman forma' }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'Toda gran idea merece ser expresada con claridad. Desde una primera intuición hasta un descubrimiento que cambia nuestra perspectiva, la escritura nos permite darle forma a lo que imaginamos.' }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'Las matemáticas tienen su propio lenguaje. Con Texla, ese lenguaje se vuelve natural: escribe, inserta una ecuación y deja que la precisión de LaTeX se ocupe de los detalles.' }] },
 { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. La elegancia de lo esencial' }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'Pocas expresiones reúnen tanta belleza en tan poco espacio como la identidad de Euler:' }] },
 { type: 'blockMath', attrs: { latex: 'e^{i\\pi} + 1 = 0' } },
 { type: 'paragraph', content: [{ type: 'text', text: 'Cinco constantes fundamentales, una sola relación. Un pequeño recordatorio de que las ideas más profundas también pueden ser las más sencillas.' }] },
 { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'La simplicidad es la máxima sofisticación.', marks: [{ type: 'italic' }] }] }] },
 { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Tu siguiente descubrimiento' }] },
 { type: 'paragraph', content: [{ type: 'text', text: 'Este documento es tu punto de partida. Hazlo tuyo: edita estas palabras, prueba una fórmula o pega una respuesta de tu asistente de IA. Las grandes ideas empiezan con una página.' }] }
] };
