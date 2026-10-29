import type { DocNode } from './document';
import type { Reference } from './references';
import { validReference } from './references';
import { resolveStyle, type CitationStyle } from './citationStyles';
import { resolveFormat, type DocumentFormat } from './formalDocument';
import type { SharedAccess } from '../shared/collaboration';
export type SavedDocument = { id: string; title: string; content: DocNode; references?: Reference[]; citationStyle?: CitationStyle; format?: DocumentFormat; updated: number; shared?: SharedAccess; cloud?: { ownerId: string; revision: number; dirty: boolean; stoppedSharing?: SharedAccess } };
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export function makeBackup(doc: SavedDocument): string {
  return JSON.stringify({application:'texla-docs',version:1,document:{title:doc.title,content:doc.content,references:doc.references||[],citationStyle:resolveStyle(doc.citationStyle),format:resolveFormat(doc.format)}},null,2);
}
export function readBackup(raw: string): Omit<SavedDocument,'id'|'updated'> {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('La copia supera el límite de 5 MB.');
  let data;try {data=JSON.parse(raw)} catch {throw new Error('No se pudo leer el archivo. Selecciona una copia .texla.json.');}
  const doc=data?.document;
  if (data?.application!=='texla-docs'||data.version!==1||!doc||typeof doc.title!=='string'||doc.title.length>500||doc.content?.type!=='doc'||!Array.isArray(doc.content.content)||!Array.isArray(doc.references)||!doc.references.every(validReference)) throw new Error('El archivo no es una copia compatible de Texla Docs.');
  let count=0;
  function check(node:DocNode,depth:number) {
    if(!node||typeof node.type!=='string'||depth>30||++count>50000)throw new Error('La estructura del documento no es válida.');
    if(node.attrs?.textAlign != null && !['left','center','right','justify'].includes(node.attrs.textAlign))throw new Error('La copia contiene una alineación no válida.');
    if(node.type==='tableCell'||node.type==='tableHeader') {
      for(const key of ['colspan','rowspan']) if(node.attrs?.[key] != null && (!Number.isInteger(node.attrs[key]) || node.attrs[key]<1 || node.attrs[key]>1000))throw new Error('La copia contiene una tabla no válida.');
      if(node.attrs?.colwidth != null && (!Array.isArray(node.attrs.colwidth) || !node.attrs.colwidth.every((n:unknown)=>typeof n==='number' && Number.isFinite(n) && n>=0 && n<=10000)))throw new Error('La copia contiene anchos de tabla no válidos.');
    }
    if(node.type==='citation'&&!validReference(node.attrs?.reference))throw new Error('La copia contiene una referencia no válida.');
    if(node.type==='inlineMath'||node.type==='blockMath')if(typeof node.attrs?.latex!=='string')throw new Error('La copia contiene una ecuación no válida.');
    for(const mark of node.marks||[]) if(mark.type==='link' && !/^(https?:\/\/|mailto:)/i.test(mark.attrs?.href||''))throw new Error('La copia contiene un enlace no compatible.');
    for(const child of node.content||[])check(child,depth+1);
  }
  check(doc.content,0);
  return {title:doc.title,content:doc.content,references:doc.references,citationStyle:resolveStyle(doc.citationStyle),format:resolveFormat(doc.format)};
}
