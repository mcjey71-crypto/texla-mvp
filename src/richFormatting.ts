import { Extension, Mark, Node } from '@tiptap/core';
import { FONTS, fontDefinition } from './fonts';

export type TextAppearance = { font?: string; size?: number; color?: string; highlight?: string; vertical?: 'super' | 'sub' };
export type BlockAppearance = { before?: number; after?: number; line?: number; exactLine?: number; left?: number; right?: number; indent?: number; background?: string; border?: boolean; keep?: boolean };
const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
export const hexColor = (n: unknown): n is string => typeof n === 'string' && /^[a-f\d]{6}$/i.test(n);
export function textAppearance(value: unknown): TextAppearance {
  const a = (value || {}) as TextAppearance, out: TextAppearance = {};
  if (FONTS.some(f => f.id === a.font)) out.font = a.font;
  if (finite(a.size, 5, 96)) out.size = a.size;
  if (hexColor(a.color)) out.color = a.color;
  if (hexColor(a.highlight)) out.highlight = a.highlight;
  if (a.vertical === 'super' || a.vertical === 'sub') out.vertical = a.vertical;
  return out;
}
export function blockAppearance(value: unknown): BlockAppearance {
  const a = (value || {}) as BlockAppearance, out: BlockAppearance = {};
  for (const k of ['before', 'after', 'left', 'right'] as const) if (finite(a[k], 0, 144)) out[k] = a[k];
  if (finite(a.indent, -144, 144)) out.indent = a.indent;
  if (finite(a.line, .8, 4)) out.line = a.line;
  if (finite(a.exactLine, 5, 144)) out.exactLine = a.exactLine;
  if (hexColor(a.background)) out.background = a.background;
  if (typeof a.border === 'boolean') out.border = a.border;
  if (a.keep === true) out.keep = true;
  return out;
}
export function appearanceCSS(value: unknown) {
  const a = textAppearance(value);
  return [a.font && `font-family:${fontDefinition(a.font).css}`, a.size && `font-size:${a.size}pt`, a.color && `color:#${a.color}`, a.highlight && `background-color:#${a.highlight}`, a.vertical && `vertical-align:${a.vertical};font-size:75%`].filter(Boolean).join(';');
}
export function layoutCSS(value: unknown) {
  const a = blockAppearance(value);
  return [a.before !== undefined && `margin-top:${a.before}pt`, a.after !== undefined && `margin-bottom:${a.after}pt`, a.left !== undefined && `margin-left:${a.left}pt`, a.right !== undefined && `margin-right:${a.right}pt`, a.indent !== undefined && `text-indent:${a.indent}pt`, a.exactLine ? `line-height:${a.exactLine}pt` : a.line && `line-height:${a.line}`, a.background && `background-color:#${a.background}`, a.border === false && 'border:0', a.keep && 'break-after:avoid'].filter(Boolean).join(';');
}
export function readAppearance(element: HTMLElement): TextAppearance {
  const s = element.style;
  const color = (v: string) => { const m = v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); return m ? m.slice(1).map(x => Number(x).toString(16).padStart(2, '0')).join('') : v.replace('#', ''); };
  const font = s.fontFamily.split(',')[0]?.replace(/["']/g, '').trim();
  return textAppearance({ font, size: s.fontSize.endsWith('pt') ? parseFloat(s.fontSize) : s.fontSize.endsWith('px') ? parseFloat(s.fontSize) * .75 : undefined, color: color(s.color), highlight: color(s.backgroundColor), vertical: element.tagName === 'SUP' ? 'super' : element.tagName === 'SUB' ? 'sub' : s.verticalAlign });
}
export const RichTextAppearance = Mark.create({
  name: 'textAppearance',
  addAttributes() { return { appearance: { default: {}, parseHTML: element => readAppearance(element), renderHTML: () => ({}) } }; },
  parseHTML() { return [{ tag: 'span[style]' }, { tag: 'sup' }, { tag: 'sub' }]; },
  renderHTML({ mark }) { return ['span', { style: appearanceCSS(mark.attrs.appearance) }, 0]; },
});
export const ImportedLayout = Extension.create({
  name: 'importedLayout',
  addGlobalAttributes() { return [{ types: ['paragraph', 'heading', 'tableCell', 'tableHeader', 'table'], attributes: {
    layout: { default: null, parseHTML: el => { try { return blockAppearance(JSON.parse(el.getAttribute('data-texla-layout') || '{}')); } catch { return null; } }, renderHTML: attrs => attrs.layout ? { style: layoutCSS(attrs.layout), 'data-texla-layout': JSON.stringify(blockAppearance(attrs.layout)) } : {} },
  } }]; },
});
export const ImportedHeader = Node.create({
  name:'importedHeader', group:'block', content:'(paragraph|figure)+', defining:true,
  parseHTML(){return [{tag:'header[data-texla-header]'}];},
  renderHTML(){return ['header',{'data-texla-header':'true',class:'imported-header'},0];},
});
