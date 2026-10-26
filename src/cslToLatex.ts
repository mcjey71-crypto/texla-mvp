import { parseDocument } from 'htmlparser2';
import type { AnyNode } from 'domhandler';
const escape = (s: string) => s.replace(/[\\{}$&#%_~^]/g, c => ({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' }[c]!));
/** Preserve CSL-generated typography while treating all metadata as text. */
export function cslHtmlToLatex(html: string): string {
  // URL commands allow line wrapping in narrow pages without changing the DOI.
  function renderText(value: string): string {
    let result = ''; let end = 0;
    for (const match of value.matchAll(/https?:\/\/[^\s<>"{}\\]+|\b10\.\d{4,9}\/[^\s<>"{}\\]+/g)) {
      const url = match[0].replace(/[.,;:]+$/, '');
      result += escape(value.slice(end, match.index)) + `\\${url.startsWith('http') ? 'url' : 'nolinkurl'}{${url}}`;
      end = match.index! + url.length;
    }
    return result + escape(value.slice(end));
  }
  function render(node: AnyNode): string {
    if (node.type === 'text') return renderText(node.data);
    if (node.type !== 'tag') return '';
    const inner = node.children.map(render).join('');
    if (['i', 'em'].includes(node.name)) return `\\textit{${inner}}`;
    if (['b', 'strong'].includes(node.name)) return `\\textbf{${inner}}`;
    if (node.name === 'sup') return `\\textsuperscript{${inner}}`;
    if (node.name === 'sub') return `\\textsubscript{${inner}}`;
    if (node.attribs.style?.includes('small-caps')) return `\\textsc{${inner}}`;
    if (node.attribs.class === 'csl-left-margin') return `${inner}\\hspace{0.5em}`;
    return inner;
  }
  return parseDocument(html).children.map(render).join('').trim();
}
