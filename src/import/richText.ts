import DOMPurify from 'dompurify';
import { DOMParser as ProseMirrorParser, type Schema } from '@tiptap/pm/model';
import type { DocNode } from '../document';
import { parseMathText } from '../document';
import { escapeHTML } from './common';

export function mathInDocument(node: DocNode): DocNode[] {
  if (node.type === 'paragraph' || node.type === 'heading') {
    const blocks: DocNode[] = []; let inline: DocNode[] = [];
    const flush = () => { if (inline.length) { blocks.push({ ...node, content: inline }); inline = []; } };
    for (const child of node.content || []) {
      if (child.type !== 'text' || !child.text || !/\$|\\\[|\\\(/.test(child.text)) { inline.push(child); continue; }
      for (const part of parseMathText(child.text)) {
        if (part.type === 'blockMath') { flush(); blocks.push(part); }
        else inline.push(...(part.content || []).map(n => n.type === 'text' ? { ...n, marks: child.marks } : n));
      }
    }
    flush(); return blocks.length ? blocks : [{ ...node, content: [] }];
  }
  const children = node.content?.flatMap(mathInDocument);
  // List items require a paragraph first, including when they start with an equation.
  if (node.type === 'listItem' && children?.[0]?.type !== 'paragraph') children?.unshift({ type: 'paragraph' });
  return [{ ...node, ...(children ? { content: children } : {}) }];
}

export function richText(html: string, schema: Schema, warnings: string[]): DocNode {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','del','code','pre','blockquote','ul','ol','li','table','thead','tbody','tfoot','tr','td','th','a','hr','img','sup','sub'],
    ALLOWED_ATTR: ['href','alt','colspan','rowspan','start','style','data-type','data-latex'],
    ALLOW_DATA_ATTR: false,
  });
  const dom = new DOMParser().parseFromString(clean, 'text/html');
  if (dom.querySelector('img')) warnings.push('Las imágenes se sustituyeron por una indicación de su ubicación; no se incluyen en esta conversión.');
  dom.querySelectorAll('img').forEach(img => img.replaceWith(dom.createTextNode(`[Imagen${img.getAttribute('alt') ? `: ${img.getAttribute('alt')}` : ''}]`)));
  dom.querySelectorAll('*').forEach(element => {
    if (element.hasAttribute('style')) { const align = (element as HTMLElement).style.textAlign; element.removeAttribute('style'); if (['left','right','center','justify'].includes(align)) element.setAttribute('style', `text-align: ${align}`); }
    if (element.hasAttribute('data-type') && !['inline-math','block-math'].includes(element.getAttribute('data-type')!)) element.removeAttribute('data-type');
    if (element.tagName === 'A' && !/^(https?:\/\/|mailto:)/i.test(element.getAttribute('href') || '')) element.removeAttribute('href');
    for (const name of ['colspan','rowspan']) if (element.hasAttribute(name)) element.setAttribute(name, String(Math.min(100, Math.max(1, Number(element.getAttribute(name)) || 1))));
  });
  dom.querySelectorAll('h4,h5,h6').forEach(element => { const replacement = dom.createElement('h3'); replacement.append(...element.childNodes); element.replaceWith(replacement); });
  if (dom.querySelector('sup,sub')) warnings.push('Revisa los superíndices y subíndices de texto: se conservaron con marcas ^ y _.');
  dom.querySelectorAll('sup,sub').forEach(element => element.replaceWith(dom.createTextNode(`${element.tagName === 'SUP' ? '^' : '_'}{${element.textContent}}`)));
  const parsed = ProseMirrorParser.fromSchema(schema).parse(dom.body).toJSON() as DocNode;
  return mathInDocument(parsed)[0];
}

// Protect math before Markdown interprets backslashes, underscores and asterisks.
export function protectMarkdownMath(source: string): { text: string; restore: (html: string) => string } {
  const values: string[] = []; const prefix = `TEXLAMATH${crypto.randomUUID().replaceAll('-', '')}`;
  const text = source.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)|(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$\n]+?)(?<!\\)\$)/g,
    (match, code, _math, dollarBlock, bracketBlock, parenInline, dollarInline) => {
      if (code) return match;
      const block = dollarBlock !== undefined || bracketBlock !== undefined;
      const latex = dollarBlock ?? bracketBlock ?? parenInline ?? dollarInline;
      const tag = block ? 'div' : 'span';
      const index = values.push(`<${tag} data-type="${block ? 'block' : 'inline'}-math" data-latex="${escapeHTML(latex.trim())}"></${tag}>`) - 1;
      return `${block ? '\n\n' : ''}${prefix}${index}END${block ? '\n\n' : ''}`;
    });
  return { text, restore: html => html.replace(new RegExp(`${prefix}(\\d+)END`, 'g'), (_, index) => values[Number(index)]) };
}
