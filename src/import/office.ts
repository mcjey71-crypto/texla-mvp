import { strToU8, zipSync } from 'fflate';
import { readArchive, readXML } from './archive';
import { escapeHTML } from './common';
const MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const children = (el: Element, name: string) => Array.from(el.children).filter(child => child.localName === name);
const first = (el: Element, name: string) => children(el, name)[0];
const mathSymbols: Record<string, string> = {
  'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta','θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu','ξ':'xi','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','υ':'upsilon','φ':'phi','χ':'chi','ψ':'psi','ω':'omega',
  'Γ':'Gamma','Δ':'Delta','Θ':'Theta','Λ':'Lambda','Ξ':'Xi','Π':'Pi','Σ':'Sigma','Υ':'Upsilon','Φ':'Phi','Ψ':'Psi','Ω':'Omega','∞':'infty','≤':'leq','≥':'geq','≠':'neq','≈':'approx','±':'pm','×':'times','·':'cdot','∂':'partial','∇':'nabla','∈':'in','∉':'notin','→':'to','∅':'emptyset',
};
const mathEscape = (s: string) => s.replace(/[{}%&#_$]/g, '\\$&').replace(/[α-ωΓΔΘΛΞΠΣΥΦΨΩ∞≤≥≠≈±×·∂∇∈∉→∅−]/g, symbol => symbol === '−' ? '-' : mathSymbols[symbol] ? `\\${mathSymbols[symbol]} ` : symbol);
function wordMath(el: Element | undefined, warnings: Set<string>, depth = 0): string {
  if (!el) return '';
  if (depth > 40) throw new Error('La ecuación de Word es demasiado compleja.');
  const child = (name: string) => wordMath(first(el, name), warnings, depth + 1);
  const all = () => Array.from(el.children).map(node => wordMath(node, warnings, depth + 1)).join('');
  const property = (container: string, name: string) => first(first(el, container) || el, name)?.getAttributeNS(MATH, 'val');
  switch (el.localName) {
    case 't': return mathEscape(el.textContent || '');
    case 'r': return all();
    case 'f': return `\\frac{${child('num')}}{${child('den')}}`;
    case 'sSup': return `{${child('e')}}^{${child('sup')}}`;
    case 'sSub': return `{${child('e')}}_{${child('sub')}}`;
    case 'sSubSup': return `{${child('e')}}_{${child('sub')}}^{${child('sup')}}`;
    case 'rad': return `\\sqrt${child('deg') ? `[${child('deg')}]` : ''}{${child('e')}}`;
    case 'd': { const begin = property('dPr', 'begChr') ?? '('; const end = property('dPr', 'endChr') ?? ')'; const delimiter = (s: string) => s === '{' || s === '}' ? `\\${s}` : s || '.'; return `\\left${delimiter(begin)}${children(el, 'e').map(node => wordMath(node, warnings, depth + 1)).join('\\mid ')}\\right${delimiter(end)}`; }
    case 'nary': { const operator = property('naryPr', 'chr') || '∫'; const operators: Record<string,string> = { '∫': '\\int', '∑': '\\sum', '∏': '\\prod', '∬': '\\iint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' }; return `${operators[operator] || operator}${child('sub') ? `_{${child('sub')}}` : ''}${child('sup') ? `^{${child('sup')}}` : ''} ${child('e')}`; }
    case 'func': return `\\operatorname{${child('fName')}} ${child('e')}`;
    case 'acc': { const accents: Record<string,string> = { '̂': 'hat', '̅': 'bar', '⃗': 'vec', '̇': 'dot', '̈': 'ddot', '̃': 'tilde' }; const command = accents[property('accPr', 'chr') || '̂']; if (command) return `\\${command}{${child('e')}}`; break; }
    case 'bar': return `\\${property('barPr','pos') === 'bot' ? 'underline' : 'overline'}{${child('e')}}`;
    case 'm': return `\\begin{matrix}${children(el,'mr').map(row => children(row,'e').map(cell => wordMath(cell,warnings,depth+1)).join(' & ')).join(' \\\\ ')}\\end{matrix}`;
    case 'eqArr': return `\\begin{gathered}${children(el,'e').map(node => wordMath(node,warnings,depth+1)).join(' \\\\ ')}\\end{gathered}`;
    case 'oMath': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'fName': return all();
    default: if (el.localName.endsWith('Pr') || el.namespaceURI !== MATH) return '';
  }
  warnings.add('Algunas estructuras matemáticas de Word se conservaron como texto. Revisa las ecuaciones.');
  return all();
}
export async function readDocx(bytes: Uint8Array): Promise<{ html: string; warnings: string[] }> {
  const files = readArchive(bytes); const warnings = new Set<string>();
  readXML(files['word/document.xml']);
  let equations = 0;
  for (const name of Object.keys(files).filter(name => /^word\/(document|footnotes|endnotes)\.xml$/.test(name))) {
    const xml = readXML(files[name]);
    for (const math of Array.from(xml.getElementsByTagNameNS(MATH, 'oMath'))) {
      const display = math.parentElement?.localName === 'oMathPara';
      const latex = wordMath(math, warnings); const run = xml.createElementNS(WORD, 'w:r'); const text = xml.createElementNS(WORD, 'w:t');
      text.setAttribute('xml:space', 'preserve'); text.textContent = display ? ` $$${latex}$$ ` : ` \\(${latex}\\) `; run.append(text); math.replaceWith(run); equations++;
    }
    for (const block of Array.from(xml.getElementsByTagNameNS(MATH, 'oMathPara'))) block.replaceWith(...block.childNodes);
    files[name] = strToU8(new XMLSerializer().serializeToString(xml));
  }
  const mammoth = (await import('mammoth')).default;
  const packed = zipSync(files);
  const result = await mammoth.convertToHtml({ arrayBuffer: packed.buffer as ArrayBuffer }, { externalFileAccess: false, includeEmbeddedStyleMap: false,
    convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    styleMap: ["p[style-name='Título'] => h1:fresh", "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh", "p[style-name='Título 3'] => h3:fresh"],
  });
  if (result.messages.length) warnings.add('Word contiene estilos o elementos que no tienen equivalente directo. Revisa la conversión.');
  if (equations) warnings.add(`Se convirtieron ${equations} ecuación(es) de Word a LaTeX editable. Revisa sus símbolos y agrupaciones.`);
  warnings.add('Word: se importan títulos, listas, tablas y formato básico. Las citas quedan como texto; revisa notas, encabezados y elementos de diseño.');
  return { html: result.value, warnings: [...warnings] };
}

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
