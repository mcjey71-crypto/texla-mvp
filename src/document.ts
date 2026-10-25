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
export function nodeToLatex(node: DocNode): string {
  if (node.type === 'text') { let text = escapeTex(node.text || ''); for (const mark of node.marks || []) { if (mark.type === 'bold') text = `\\textbf{${text}}`; if (mark.type === 'italic') text = `\\textit{${text}}`; if (mark.type === 'underline') text = `\\underline{${text}}`; } return text; }
  if (node.type === 'inlineMath') return `$${node.attrs?.latex || ''}$`;
  if (node.type === 'blockMath') return `\n\\begin{equation}\n${node.attrs?.latex || ''}\n\\end{equation}\n`;
  const inner = (node.content || []).map(nodeToLatex).join('');
  switch (node.type) {
    case 'heading': return `\n\\${node.attrs?.level === 1 ? 'section*' : node.attrs?.level === 2 ? 'subsection*' : 'subsubsection*'}{${inner}}\n`;
    case 'paragraph': return `${inner}\n\n`;
    case 'bulletList': return `\\begin{itemize}\n${inner}\\end{itemize}\n`;
    case 'orderedList': return `\\begin{enumerate}\n${inner}\\end{enumerate}\n`;
    case 'listItem': return `\\item ${inner}`;
    case 'blockquote': return `\\begin{quote}\n${inner}\\end{quote}\n`;
    case 'hardBreak': return '\\\\\n';
    case 'horizontalRule': return '\\medskip\\hrule\\medskip\n';
    default: return inner;
  }
}
export function exportLatex(title: string, content: DocNode): string {
  return `\\documentclass[11pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage[spanish]{babel}\n\\usepackage{amsmath,amssymb}\n\\usepackage[margin=2.5cm]{geometry}\n\\title{${escapeTex(title)}}\n\\date{}\n\\begin{document}\n${nodeToLatex(content)}\n\\end{document}\n`;
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
