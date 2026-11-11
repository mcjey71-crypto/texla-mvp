import {validFigure,imageFilename} from './imageTypes';
import { resolveFormat, type DocumentFormat } from './formalDocument';
import { tableToLatex } from './tableLatex';
import { latexPage } from './pageFormats';
import { footerPositions } from './pageFurniture';
import { fontLatex, FONTS } from './fonts';
import {textAppearance,blockAppearance} from './richFormatting';
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
const greek:Record<string,string>={α:'alpha',β:'beta',γ:'gamma',δ:'delta',ε:'epsilon',ζ:'zeta',η:'eta',θ:'theta',ι:'iota',κ:'kappa',λ:'lambda',μ:'mu',µ:'mu',ν:'nu',ξ:'xi',π:'pi',ρ:'rho',σ:'sigma',τ:'tau',υ:'upsilon',φ:'phi',χ:'chi',ψ:'psi',ω:'omega',Γ:'Gamma',Δ:'Delta',Θ:'Theta',Λ:'Lambda',Ξ:'Xi',Π:'Pi',Σ:'Sigma',Υ:'Upsilon',Φ:'Phi',Ψ:'Psi',Ω:'Omega'};
const escapeTex = (s: string) => s.replace(/[\\{}$&#%_~^α-ωΓΔΘΛΞΠΣΥΦΨΩµ]/g, c => greek[c]?`\\ensuremath{\\${greek[c]}}`:({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' }[c]||c));
function styledText(text:string,value:unknown,format:DocumentFormat){
 const a=textAppearance(value);
 if(a.size)text=`{\\fontsize{${a.size}}{${a.size*1.2}}\\selectfont ${text}}`;
 if(a.font&&a.font!==format.fontFamily){const index=FONTS.findIndex(f=>f.id===a.font);text=`{\\texlafont${String.fromCharCode(97+index)} ${text}}`;}
 if(a.color)text=`\\textcolor[HTML]{${a.color}}{${text}}`;
 if(a.highlight)text=`{\\setlength{\\fboxsep}{0pt}\\colorbox[HTML]{${a.highlight}}{${text}}}`;
 if(a.vertical)text=`\\text${a.vertical==='super'?'superscript':'subscript'}{${text}}`;
 return text;
}
function importedParagraph(inner:string,node:DocNode,format:DocumentFormat){
 const a=blockAppearance(node.attrs?.layout);const align=({left:'\\raggedright',right:'\\raggedleft',center:'\\centering'} as Record<string,string>)[node.attrs?.textAlign||format.paragraphAlignment]||'';
 return `\\begingroup\n${align}\n\\setlength{\\parskip}{0pt}\n\\setlength{\\parindent}{${a.indent||0}pt}\n${a.left?`\\setlength{\\leftskip}{${a.left}pt}\n`:''}${a.right?`\\setlength{\\rightskip}{${a.right}pt}\n`:''}${a.line?`\\setstretch{${a.line}}\n`:''}${a.before?`\\vspace{${a.before}pt}\n`:''}${inner}\\par\n${a.after?`\\vspace{${a.after}pt}\n`:''}\\endgroup\n`;
}
export function nodeToLatex(node: DocNode, citationNumbers: Map<string, number> = new Map(), citationLabels?: Map<string, string>, format = resolveFormat(), bibliographyContent = ''): string {
  if(['importedHeader','commentThread','commentMessage'].includes(node.type))return '';
  if (node.type === 'text') {
    const isURL = node.marks?.some(mark => mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href || '') && node.text === mark.attrs?.href);
    let text = isURL ? `\\url{${(node.text || '').replace(/[{}%\\]/g, c => '\\' + c)}}` : escapeTex(node.text || '');
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') text = `\\textbf{${text}}`;
      if (mark.type === 'italic') text = `\\textit{${text}}`;
      // Underline boxes prevent xurl from breaking long DOI links across lines.
      if (mark.type === 'underline' && !isURL) text = `\\underline{${text}}`;
      if (mark.type === 'textAppearance') text = styledText(text, mark.attrs?.appearance, format);
    }
    return text;
  }
  if (node.type === 'citation') { const number = citationNumbers.get(node.attrs?.reference?.id); return number ? citationLabels ? `\\hyperlink{ref${number}}{${escapeTex(citationLabels.get(node.attrs?.reference?.id) || '[?]')}}` : `\\cite{ref${number}}` : '[referencia no disponible]'; }
  if (node.type === 'inlineMath') return `$${node.attrs?.latex || ''}$`;
  if (node.type === 'blockMath') return `\n\\begin{equation}\n${node.attrs?.latex || ''}\n\\end{equation}\n`;
  if (node.type === 'bibliographyAnchor') return bibliographyContent || `\\section*{Referencias bibliográficas}\n\\phantomsection\n\\addcontentsline{toc}{section}{Referencias bibliográficas}\n${format.bibliographyGroups ? '\\subsection*{Referencias primarias}\n\\subsection*{Referencias complementarias}\n' : ''}`;
  if (node.type === 'figure' && validFigure(node.attrs)) {const figure=node.attrs;const graphic=`\\includegraphics[width=${(figure.width/100).toFixed(2)}\\linewidth,height=0.75\\textheight,keepaspectratio]{${imageFilename(figure.asset)}}`;if(figure.captionMode==='none')return `\n\\begingroup${figure.align==='left'?'\\raggedright':figure.align==='right'?'\\raggedleft':'\\centering'}\n${graphic}\\par\\endgroup\n`;return `\n\\begin{figure}[htbp]\n${figure.align==='left'?'\\raggedright':figure.align==='right'?'\\raggedleft':'\\centering'}\n${graphic}\n\\caption{${escapeTex(figure.caption)}}\n${figure.source?`{\\small ${escapeTex('Fuente: '+figure.source)}\\par}\n`:''}\\end{figure}\n`; }
  if (node.type === 'table') return tableToLatex(node, child => nodeToLatex(child, citationNumbers, citationLabels, format, bibliographyContent));
  if (node.type === 'tableOfContents') return '\\tableofcontents\n';
  if (node.type === 'pageBreak') return format.pageSize === 'Continuo' ? '\n' : '\\clearpage\n';
  const inner = (node.content || []).map(child => nodeToLatex(child, citationNumbers, citationLabels, format, bibliographyContent)).join('');
  switch (node.type) {
    case 'heading': {
      if(node.attrs?.layout)return importedParagraph(inner,node,format);
      if (node.attrs?.level === 1 && format.headingStyle === 'cv') return `\n\\begin{center}\\Large\\bfseries ${inner}\\end{center}\n`;
      if (node.attrs?.level === 1) return `\n\\section*{${inner}}\n`;
      const command = node.attrs?.level === 2 ? 'section' : node.attrs?.level === 3 ? 'subsection' : 'subsubsection';
      const numbered = format.numberedSections && node.attrs?.numbered !== false;
      return `\n\\${command}${numbered ? '' : '*'}{${inner}}\n${numbered ? '' : `\\phantomsection\n\\addcontentsline{toc}{${command}}{${inner}}\n`}`;
    }
    case 'paragraph': {
      if(node.attrs?.layout)return importedParagraph(inner,node,format);
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
  const hasAppearance = (node:DocNode):boolean => !!node.marks?.some(m=>m.type==='textAppearance') || !!node.attrs?.layout || !!node.content?.some(hasAppearance);
  const importedStyles = hasAppearance(content) ? `\\usepackage[table]{xcolor}\n${FONTS.map((f,i)=>`\\newcommand{\\texlafont${String.fromCharCode(97+i)}}{\\ifPDFTeX${f.pdfPackage==='helvet'?'\\sffamily':'\\rmfamily'}\\else\\IfFontExistsTF{${f.id}}{\\fontspec{${f.id}}}{\\IfFontExistsTF{${f.latexFallback}}{\\fontspec{${f.latexFallback}}}{}}\\fi}\n`).join('')}` : '';
  const header=format.headerMode==='auto'?content.content?.find(n=>n.type==='importedHeader'):undefined;
  const headerImage=header?.content?.find(n=>n.type==='figure'&&validFigure(n.attrs));
  const headerText=header?.content?.filter(n=>n.type!=='figure').map(n=>nodeToLatex(n,numbers,formatted.citations,format)).join('')||'';
  const positions=footerPositions(format), side={left:'L',center:'C',right:'R'};
  const headerSetup=header ? `${headerImage?`\\fancyhead[L]{\\includegraphics[width=.22\\textwidth,height=34pt,keepaspectratio]{${imageFilename(headerImage.attrs!.asset)}}}\n`:''}\\fancyhead[${format.pageNumbers==='top-right'?'C':'R'}]{\\begin{minipage}[c]{${format.pageNumbers==='top-right'?'.5':'.7'}\\textwidth}${headerText}\\end{minipage}}\n` : format.headerMode==='custom'&&format.headerText ? `\\fancyhead[L]{\\begin{minipage}{.8\\textwidth}\\raggedright\\small ${escapeTex(format.headerText)}\\end{minipage}}\n` : '';
  const footerSetup=`${format.footerBrand?`\\fancyfoot[${side[positions.brand]}]{\\scriptsize\\textsc{Texla Docs}}\n`:''}${format.footerText?`\\fancyfoot[${side[positions.text]}]{\\begin{minipage}{.3\\textwidth}\\centering\\footnotesize ${escapeTex(format.footerText)}\\end{minipage}}\n`:''}`;
  const numberSetup=format.pageNumbers==='none'?'':`\\fancy${format.pageNumbers==='top-right'?'head[R]':`foot[${format.pageNumbers==='bottom-left'?'L':format.pageNumbers==='bottom-right'?'R':'C'}]`}{\\small ${escapeTex(format.pageNumberPrefix)}\\thepage{}${escapeTex(format.pageNumberSuffix)}}\n`;
  const baseFurniture=`\\fancyhf{}\n\\renewcommand{\\headrulewidth}{0pt}\n\\renewcommand{\\footrulewidth}{0pt}\n${headerSetup}${footerSetup}`;
  const pageNumbers=`\\usepackage{fancyhdr}\n\\setlength{\\headheight}{${header||headerSetup?'40':'15'}pt}\n\\fancypagestyle{texla}{${baseFurniture}${numberSetup}}\n\\fancypagestyle{texlafirst}{${baseFurniture}}\n\\pagestyle{texla}\n\\pagenumbering{${format.pageNumberStyle}}\n`;
  // Spanish Babel renders \roman as small capitals; preserve an explicit lowercase choice.
  const initialPage=`${format.pageNumberStyle==='roman'?'\\renewcommand{\\thepage}{\\romannumeral\\value{page}}\n':''}\\setcounter{page}{${format.pageNumberStart}}\n${format.numberFirstPage?'':'\\thispagestyle{texlafirst}\n'}`;
  return `\\documentclass[${format.fontSize}pt,${paper.classOption}]{article}\n${fontLatex(format.fontFamily)}${importedStyles}\\usepackage[spanish]{babel}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{xurl}\n\\urlstyle{same}\n\\usepackage{setspace}\n\\usepackage{longtable,array,booktabs,multirow}\n\\usepackage[${paper.geometry},margin=${format.margin}cm]{geometry}\n\\setstretch{${format.lineSpacing}}\n\\setlength{\\parindent}{${format.firstLineIndent}cm}\n\\setlength{\\parskip}{${format.paragraphSpacing}pt}\n${format.firstLineIndent ? '\\usepackage{indentfirst}\n' : ''}${structure}${pageNumbers}\\usepackage[hidelinks]{hyperref}\n\\setlength{\\emergencystretch}{2em}\n\\title{${escapeTex(title)}}\n\\date{}\n\\begin{document}\n${initialPage}${nodeToLatex(content, numbers, formatted.citations, format, bibliography)}${anchored(content) ? '' : bibliography}\n\\end{document}\n`;
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
