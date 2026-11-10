const MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const children = (el: Element, name: string) => Array.from(el.children).filter(child => child.localName === name);
const first = (el: Element, name: string) => children(el, name)[0];
const mathSymbols: Record<string, string> = {
  'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta','θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu','ξ':'xi','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','υ':'upsilon','φ':'phi','χ':'chi','ψ':'psi','ω':'omega',
  'Γ':'Gamma','Δ':'Delta','Θ':'Theta','Λ':'Lambda','Ξ':'Xi','Π':'Pi','Σ':'Sigma','Υ':'Upsilon','Φ':'Phi','Ψ':'Psi','Ω':'Omega','∞':'infty','≤':'leq','≥':'geq','≠':'neq','≈':'approx','±':'pm','×':'times','·':'cdot','∂':'partial','∇':'nabla','∈':'in','∉':'notin','→':'to','∅':'emptyset',
};
const mathEscape = (s: string) => s.replace(/[{}%&#_$]/g, '\\$&').replace(/[α-ωΓΔΘΛΞΠΣΥΦΨΩ∞≤≥≠≈±×·∂∇∈∉→∅−]/g, symbol => symbol === '−' ? '-' : mathSymbols[symbol] ? `\\${mathSymbols[symbol]} ` : symbol);
export function wordMath(el: Element | undefined, warnings: Set<string>, depth = 0): string {
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
