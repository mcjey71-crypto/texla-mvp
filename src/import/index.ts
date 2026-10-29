import type { Schema } from '@tiptap/pm/model';
import {restoreImageBackup} from '../imageExport';
import { makeBackup, readBackup, MAX_BACKUP_BYTES } from '../backup';
import { parseMathText } from '../document';
import { resolveFormat } from '../formalDocument';
import { checkTextSize, MAX_IMPORT_BYTES, type ImportOptions, type ImportResult } from './common';
import { richText, protectMarkdownMath } from './richText';
export async function importDocument(file: File, schema: Schema, options: ImportOptions): Promise<ImportResult> {
  options.signal.throwIfAborted();
  if (!file.size) throw new Error('El archivo está vacío.');
  if (file.size > (/\.json$/i.test(file.name)?MAX_BACKUP_BYTES:MAX_IMPORT_BYTES)) throw new Error(`El archivo supera ${/\.json$/i.test(file.name)?32:20} MB. Divide el documento antes de importarlo.`);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['docx','odt','pdf','md','markdown','txt','html','htm','tex','json'].includes(extension || '')) throw new Error('Formato no compatible. Usa DOCX, ODT, PDF, Markdown, TXT, HTML, TEX o una copia de Texla. Para un archivo .doc antiguo, guárdalo primero como .docx.');
  options.onProgress('Leyendo el archivo…');
  const title = file.name.replace(/(?:\.texla)?\.[^.]+$/i,'').slice(0,500) || 'Documento importado';
  let result: ImportResult = { document: { title, content: { type: 'doc', content: [] }, references: [], format: resolveFormat() }, warnings: [] };
  if (extension === 'pdf') {
    const { readPdf } = await import('./pdf'); options.signal.throwIfAborted();
    const pdf = await readPdf(new Uint8Array(await file.arrayBuffer()), options);
    result.document.content = pdf.content; result.pages = pdf.pages; result.warnings.push(...pdf.warnings);
  } else if (extension === 'docx' || extension === 'odt') {
    const { readDocx, readOdt } = await import('./office'); options.signal.throwIfAborted();
    const bytes = new Uint8Array(await file.arrayBuffer()); options.onProgress('Convirtiendo la estructura del documento…');
    const office = extension === 'docx' ? await readDocx(bytes) : readOdt(bytes);
    checkTextSize(office.html); result.warnings.push(...office.warnings);
    result.document.content = richText(office.html, schema, result.warnings);
  } else {
    const text = await file.text(); if(extension!=='json')checkTextSize(text);
    if (text.includes('\u0000')) throw new Error('El archivo no parece texto UTF-8. Guárdalo como UTF-8 e inténtalo de nuevo.');
    if (extension === 'json') result.document = await restoreImageBackup(text);
    else if (extension === 'txt') result.document.content = { type: 'doc', content: parseMathText(text.replace(/\r\n?/g,'\n')) };
    else if (extension === 'tex') {
      const { readTex } = await import('./tex'); const tex = readTex(text);
      result.warnings.push(...tex.warnings); result.document.title = tex.title?.slice(0,500) || title;
      result.document.content = richText(tex.html, schema, result.warnings);
    } else if (extension === 'md' || extension === 'markdown') {
      const { marked } = await import('marked'); const protectedMath = protectMarkdownMath(text);
      const html = protectedMath.restore(await marked.parse(protectedMath.text, { async: false }));
      result.document.content = richText(html, schema, result.warnings);
    } else result.document.content = richText(text, schema, result.warnings);
  }
  options.signal.throwIfAborted();
  // Use the same structural limits as editable backups, then validate against the active editor schema.
  result.document = readBackup(makeBackup({ ...result.document, id: 'import', updated: 0 }));
  const node = schema.nodeFromJSON(result.document.content); node.check();
  if (!node.textContent.trim() && !JSON.stringify(result.document.content).includes('Math') && !JSON.stringify(result.document.content).includes('\"type\":\"figure\"')) throw new Error('No se encontró contenido editable en este archivo.');
  result.document.content = node.toJSON();
  result.warnings = [...new Set(result.warnings)];
  return result;
}
