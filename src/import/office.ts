import { readArchive, readXML } from './archive';
import { escapeHTML } from './common';
export function readOdt(bytes: Uint8Array): { html: string; warnings: string[] } {
  const files = readArchive(bytes), xml = readXML(files['content.xml']);
  const ns = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const warnings = ['OpenDocument: se recupera la estructura básica. Revisa estilos, referencias, imágenes y ecuaciones; los objetos incrustados no se convierten.'];
  function render(node: Node, depth = 0): string {
    if (depth > 40) throw new Error('El documento tiene demasiados niveles de estructura.');
    if (node.nodeType === Node.TEXT_NODE) return escapeHTML(node.textContent || '');
    if (!(node instanceof Element)) return '';
    const inside = () => Array.from(node.childNodes).map(child => render(child, depth + 1)).join('');
    switch (node.localName) {
      case 'p': return `<p>${inside()}</p>`;
      case 'h': { const level = Math.min(3,Math.max(1, Number(node.getAttributeNS(ns,'outline-level')) || 1)); return `<h${level}>${inside()}</h${level}>`; }
      case 'list': return `<ul>${inside()}</ul>`;
      case 'list-item': return `<li>${inside()}</li>`;
      case 'table': return `<table>${inside()}</table>`;
      case 'table-row': return `<tr>${inside()}</tr>`;
      case 'table-cell': return `<td>${inside()}</td>`;
      case 'covered-table-cell': return '';
      case 'line-break': return '<br>';
      case 's': return ' '.repeat(Math.min(100,Math.max(1,Number(node.getAttributeNS(ns,'c')) || 1)));
      case 'tab': return ' ';
      case 'image': case 'object': return '[Imagen u objeto incrustado]';
      case 'binary-data': return '';
      default: return inside();
    }
  }
  const body = xml.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0','text')[0];
  if (!body) throw new Error('El archivo no contiene un documento de texto OpenDocument.');
  return { html: render(body), warnings };
}
