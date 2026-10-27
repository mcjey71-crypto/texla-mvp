import type { SavedDocument } from '../backup';
import type { DocNode } from '../document';
export type ImportedDocument = Omit<SavedDocument, 'id' | 'updated' | 'shared' | 'cloud'>;
export type ImportResult = { document: ImportedDocument; warnings: string[]; pages?: number };
export type ImportOptions = { signal: AbortSignal; ocr: boolean; onProgress: (message: string) => void };
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_TEXT = 1_000_000;
export const MAX_PDF_PAGES = 100;
export const IMPORT_ACCEPT = '.docx,.odt,.pdf,.md,.markdown,.txt,.html,.htm,.tex,.json';
export const textNode = (text: string): DocNode[] => text ? [{ type: 'text', text }] : [];
export const paragraph = (text: string): DocNode => ({ type: 'paragraph', content: textNode(text) });
export const escapeHTML = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function checkTextSize(text: string) { if (text.length > MAX_IMPORT_TEXT) throw new Error('El contenido es demasiado extenso. Divide el documento en archivos más pequeños (máximo un millón de caracteres).'); }
export function documentText(node: DocNode): string { return node.text || (node.type === 'inlineMath' || node.type === 'blockMath' ? node.attrs?.latex || '' : (node.content || []).map(documentText).join(node.type === 'doc' ? '\n\n' : '')); }
