import DOMPurify from 'dompurify';
import katex from 'katex';
import type { Schema } from '@tiptap/pm/model';
import { parseMathText, type DocNode } from './document';
import { richText } from './import/richText';

const symbols: Record<string,string> = {
  'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','θ':'theta','λ':'lambda','μ':'mu','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','φ':'phi','ψ':'psi','ω':'omega',
  'Γ':'Gamma','Δ':'Delta','Θ':'Theta','Λ':'Lambda','Π':'Pi','Σ':'Sigma','Φ':'Phi','Ψ':'Psi','Ω':'Omega',
  '∞':'infty','≤':'leq','≥':'geq','≠':'neq','≈':'approx','±':'pm','×':'times','÷':'div','·':'cdot','∂':'partial','∇':'nabla','∈':'in','∉':'notin','→':'to','∅':'emptyset','∫':'int','∑':'sum','∏':'prod','∪':'cup','∩':'cap',
};
const mathText = (text:string) => [...text].map(char=>symbols[char] ? `\\${symbols[char]} ` : char === '−' ? '-' : /[{}%&#_$\\]/.test(char) ? `\\${char}` : /[\u2061-\u2064]/.test(char) ? '' : char).join('');
const unwrap = (text:string) => text.trim().replace(/^(?:\$\$([\s\S]*)\$\$|\\\[([\s\S]*)\\\]|\\\(([\s\S]*)\\\)|\$([\s\S]*)\$)$/,(_,a,b,c,d)=>a??b??c??d).trim();
const validLatex = (latex:string) => {
  if (!latex || latex.length > 20000) return false;
  try { katex.renderToString(latex,{throwOnError:true,trust:false,strict:'ignore',maxExpand:500,maxSize:20}); return true; } catch { return false; }
};

// Presentation MathML only. Unsupported structures must not silently lose meaning.
export function mathMLToLatex(element:Element, depth=0):string {
  if(depth>40) throw new Error('Ecuación demasiado anidada');
  const children=Array.from(element.children);
  const child=(i:number)=>{if(!children[i])throw new Error('Ecuación incompleta');return mathMLToLatex(children[i],depth+1);};
  const all=()=>children.map(node=>mathMLToLatex(node,depth+1)).join('');
  const variant=(value:string)=>{
    const kind=element.getAttribute('mathvariant');if(!kind||kind==='italic')return value;
    const command:Record<string,string>={normal:'mathrm',bold:'boldsymbol','bold-italic':'boldsymbol','double-struck':'mathbb',script:'mathcal',fraktur:'mathfrak','sans-serif':'mathsf',monospace:'mathtt'};
    if(!command[kind])throw new Error('Variante matemática no compatible');
    return `\\${command[kind]}{${value}}`;
  };
  switch(element.localName.toLowerCase()) {
    case 'math': case 'mrow': case 'mstyle': case 'mpadded': return variant(all());
    case 'semantics': {
      const tex=children.find(node=>node.localName==='annotation'&&/^(application\/(x-)?tex|text\/(x-)?latex)$/i.test(node.getAttribute('encoding')||''));
      return tex ? unwrap(tex.textContent||'') : child(0);
    }
    case 'mi': case 'mn': case 'mo': return variant(mathText(element.textContent||''));
    case 'mtext': return `\\text{${mathText(element.textContent||'')}}`;
    case 'mspace': return '\\, ';
    case 'mfrac': if(element.getAttribute('linethickness')==='0') throw new Error('Fracción sin barra'); return `\\frac{${child(0)}}{${child(1)}}`;
    case 'msqrt': return `\\sqrt{${all()}}`;
    case 'mroot': return `\\sqrt[${child(1)}]{${child(0)}}`;
    case 'msup': return `{${child(0)}}^{${child(1)}}`;
    case 'msub': return `{${child(0)}}_{${child(1)}}`;
    case 'msubsup': return `{${child(0)}}_{${child(1)}}^{${child(2)}}`;
    case 'munder': return `\\underset{${child(1)}}{${child(0)}}`;
    case 'munderover': return `\\overset{${child(2)}}{\\underset{${child(1)}}{${child(0)}}}`;
    case 'mover': {
      const accent:Record<string,string>={'^':'hat','ˆ':'hat','¯':'overline','‾':'overline','→':'vec','~':'tilde','˜':'tilde','˙':'dot'};
      const command=accent[children[1]?.textContent||''];
      return command ? `\\${command}{${child(0)}}` : `\\overset{${child(1)}}{${child(0)}}`;
    }
    case 'mfenced': {
      const delimiter=(value:string)=>['(',')','[',']','|','.'].includes(value) ? value : value==='{'||value==='}' ? `\\${value}` : value==='' ? '.' : (()=>{throw new Error('Delimitador no compatible');})();
      const separators=(element.getAttribute('separators')??',').replace(/\s/g,'');
      return `\\left${delimiter(element.getAttribute('open')??'(')}${children.map((node,i)=>(i&&separators ? mathText(separators[Math.min(i-1,separators.length-1)]) : '')+mathMLToLatex(node,depth+1)).join('')}\\right${delimiter(element.getAttribute('close')??')')}`;
    }
    case 'mtable': return `\\begin{matrix}${children.map(node=>mathMLToLatex(node,depth+1)).join(' \\\\ ')}\\end{matrix}`;
    case 'mtr': return children.map(node=>mathMLToLatex(node,depth+1)).join(' & ');
    case 'mtd': return all();
    default: throw new Error(`MathML no compatible: ${element.localName}`);
  }
}

function imageLatex(element:Element):string|undefined {
  const alt=element.getAttribute('alt')?.trim()||'';
  if(/^(?:\$|\\\[|\\\(|\\(?:frac|sqrt|begin)\b)/.test(alt)) return unwrap(alt);
  try {
    const url=new URL(element.getAttribute('src')||'');
    // Legacy Google Charts equations contain the TeX itself in chl; no image fetch.
    if(['chart.googleapis.com','chart.apis.google.com'].includes(url.hostname)&&url.searchParams.get('cht')==='tx') return unwrap(url.searchParams.get('chl')||'');
  } catch { /* Images without mathematical metadata cannot be reconstructed. */ }
}
export type MathPaste = {document:DocNode; warnings:string[]};
export function readMathClipboard(data:Pick<DataTransfer,'getData'|'files'>,schema:Schema):MathPaste|null {
  let html=data.getData('text/html');
  const text=data.getData('text/plain');
  const mathml=data.getData('application/mathml+xml')||data.getData('text/mathml');
  const latex=data.getData('application/x-latex')||data.getData('text/x-latex');
  if(Math.max(html.length,text.length,mathml.length,latex.length)>1_000_000) throw new Error('El contenido copiado es demasiado grande. Pégalo por partes.');
  if(/data-texla-figure=/.test(html))return null;
  // Let Tiptap preserve its own citations and native mathematical node selections.
  if(/data-type=["']citation["']/.test(html) || /data-pm-slice=/.test(html)&&/data-type=["'](?:inline|block)-math["']/.test(html)) return null;
  if(!html && mathml) html=mathml;
  if(!html && /^\s*<math[\s>]/i.test(text)) html=text;
  const warnings:string[]=[];
  if(html) {
    const fragment=DOMPurify.sanitize(html,{RETURN_DOM_FRAGMENT:true,USE_PROFILES:{html:true,mathMl:true},ADD_TAGS:['semantics','annotation','maction','maligngroup','malignmark','mlongdiv','mscarries','mscarry','msgroup','mstack','msline','msrow','mprescripts','none'],ADD_ATTR:['encoding','display','data-latex','data-equation','data-type'],FORBID_TAGS:['style','script','iframe','object','embed']});
    if(fragment.querySelectorAll('*').length>20000) throw new Error('El contenido copiado tiene demasiados elementos. Pégalo por partes.');
    let found=false;
    const candidates=Array.from(fragment.querySelectorAll('.katex-display,.katex,math,[data-latex],[data-equation],img'));
    for(const element of candidates) {
      if(!fragment.contains(element)) continue;
      let formula:string|undefined;
      const block=element.getAttribute('display')==='block'||element.getAttribute('data-type')==='block-math'||element.classList.contains('katex-display');
      const math=element.localName==='math'?element:element.querySelector('math');
      try {
        formula=element.getAttribute('data-latex')||element.getAttribute('data-equation')||undefined;
        if(!formula && math) formula=mathMLToLatex(math);
        if(!formula && element.localName==='img') formula=imageLatex(element);
        formula=formula===undefined?undefined:unwrap(formula);
        if(formula&&!validLatex(formula)) formula=undefined;
      } catch { formula=undefined; }
      if(formula) {
        const replacement=document.createElement(block?'div':'span');replacement.dataset.type=block?'block-math':'inline-math';replacement.dataset.latex=formula;
        element.replaceWith(replacement);found=true;
      } else {
        const image=element.localName==='img';
        const detail=(element.getAttribute('alt')||element.textContent||'').trim().slice(0,160);
        element.replaceWith(document.createTextNode(`[${image?'Imagen':'Ecuación'} pendiente de convertir${detail?`: ${detail}`:''}]`));found=true;
        warnings.push('El portapapeles contiene una imagen o una ecuación sin información compatible. No se convirtió automáticamente. Desde Google Docs, descarga como Word (.docx) e impórtalo, o usa el editor de ecuaciones.');
      }
    }
    if(found || /\$\$|\\\[|\\\(|(?<!\\)\$[^$\n]+\$/.test(fragment.textContent||'')) {
      // Preserve common Google Docs inline styling before the rich text sanitizer.
      fragment.querySelectorAll('[style]').forEach(element=>{
        const style=(element as HTMLElement).style;
        for(const [condition,tag] of [[Number(style.fontWeight)>=600||style.fontWeight==='bold','strong'],[style.fontStyle==='italic','em'],[style.textDecoration.includes('underline'),'u']] as const) if(condition){const wrapper=document.createElement(tag);wrapper.append(...element.childNodes);element.append(wrapper);}
      });
      const container=document.createElement('div');container.append(fragment);
      return {document:richText(container.innerHTML,schema,warnings),warnings:[...new Set(warnings)]};
    }
  }
  if(latex && validLatex(unwrap(latex))) return {document:{type:'doc',content:[{type:'blockMath',attrs:{latex:unwrap(latex)}}]},warnings};
  if(/\$\$|\\\[|\\\(|(?<!\\)\$[^$\n]+\$/.test(text)) return {document:{type:'doc',content:parseMathText(text)},warnings};
  if(Array.from(data.files).some(file=>file.type.startsWith('image/'))) return {document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'[Imagen de ecuación pendiente de convertir]'}]}]},warnings:['Se copió una imagen, sin fórmula editable. Importa el documento Word (.docx) desde Google Docs o usa el editor de ecuaciones.']};
  if(!text.trim() && data.getData('application/x-vnd.google-docs-document-slice-clip')) return {document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'[Contenido de Google Docs pendiente de importar]'}]}]},warnings:['Google Docs proporcionó solo su formato interno de portapapeles. Descarga el documento como Word (.docx) e impórtalo en Texla.']};
  return null;
}

export function mathPasteText(node:DocNode):string {
  if(node.type==='text')return node.text||'';
  if(node.type==='inlineMath')return `\\(${node.attrs?.latex}\\)`;
  if(node.type==='blockMath')return `\n\\[${node.attrs?.latex}\\]\n`;
  return (node.content||[]).map(mathPasteText).join(node.type==='doc'?'\n':'');
}
