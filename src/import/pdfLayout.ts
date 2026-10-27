import type { DocNode } from '../document';
import { paragraph } from './common';
export type PdfTextItem = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };
// Keep the PDF's reading order; join adjacent runs and wrapped lines conservatively.
// Multi-column layouts and mathematical glyph placement cannot be reconstructed reliably.
export function pdfParagraphs(items: PdfTextItem[]): DocNode[] {
  const lines: { text: string; y: number; height: number; end: number }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4], y = item.transform[5], height = Math.abs(item.height) || Math.abs(item.transform[3]) || 12;
    const last = lines.at(-1);
    if (last && Math.abs(last.y - y) < Math.max(2, height * .35) && x >= last.end - 3) {
      const gap = x - last.end;
      last.text += (gap > height * .12 && !/\s$/.test(last.text) && !/^\s/.test(item.str) ? ' ' : '') + item.str;
      last.end = x + item.width;
    } else lines.push({ text: item.str, y, height, end: x + item.width });
  }
  const blocks: DocNode[] = []; let current = ''; let previous: typeof lines[number] | undefined;
  for (const line of lines) {
    const newParagraph = previous && (previous.y - line.y > Math.max(previous.height, line.height) * 1.65 || line.y > previous.y + 3 || Math.abs(line.height - previous.height) > 2);
    if (newParagraph && current) { blocks.push(paragraph(current)); current = ''; }
    current += (current ? ' ' : '') + line.text.trim(); previous = line;
  }
  if (current) blocks.push(paragraph(current));
  return blocks;
}
