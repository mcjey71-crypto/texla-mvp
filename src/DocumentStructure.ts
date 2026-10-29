import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { nextSectionNumber } from './formalDocument';
import DOMPurify from 'dompurify';
import { formatReferences, referenceGroups, type CitationStyle } from './citationStyles';
import { citedReferences, type Reference } from './references';
import type { DocNode } from './document';

export function documentHeadings(doc: PMNode) {
  const headings: { text: string; pos: number; level: number; number: string }[] = [];
  const counters = [0, 0, 0];
  doc.descendants((node, pos) => {
    if (node.type.name === 'bibliographyAnchor') headings.push({text:'Referencias bibliográficas',pos,level:2,number:''});
    if (node.type.name === 'heading') headings.push({ text: node.textContent, pos, level: node.attrs.level, number: node.attrs.numbered === false ? '' : nextSectionNumber(node.attrs.level, counters) });
  });
  return headings;
}
export const SectionNumbering = Extension.create<{ isNumbered: () => boolean; isChapter: () => boolean }>({
  name: 'sectionNumbering', addOptions() { return { isNumbered: () => false, isChapter: () => false }; },
  addGlobalAttributes() { return [{types:['heading'],attributes:{numbered:{default:true,parseHTML:element=>element.getAttribute('data-numbered') !== 'false',renderHTML:attributes=>attributes.numbered === false ? {'data-numbered':'false'} : {}}}}]; },
  addProseMirrorPlugins() {
    const options = this.options;
    return [new Plugin({ key: new PluginKey('sectionNumbering'), props: { decorations(state) {
      return DecorationSet.create(state.doc, documentHeadings(state.doc).map(h => Decoration.node(h.pos, h.pos + state.doc.nodeAt(h.pos)!.nodeSize, {
        id: `texla-section-${h.pos}`, ...(options.isNumbered() && h.number ? { 'data-section-number': h.number, ...(options.isChapter() && h.level===2 ? {'data-chapter-label': `CAPÍTULO ${roman(Number(h.number))}`} : {}) } : {}),
      })));
    } } })];
  },
});
export const TableOfContents = Node.create<{ isNumbered: () => boolean }>({
  name: 'tableOfContents', group: 'block', atom: true, selectable: true,
  addOptions() { return { isNumbered: () => false }; },
  parseHTML() { return [{ tag: 'nav[data-type="table-of-contents"]' }]; },
  renderHTML() { return ['nav', { 'data-type': 'table-of-contents' }, 'Índice']; },
  renderText() { return '\nÍndice\n'; },
  addNodeView() {
    const numbered = this.options.isNumbered;
    return ({ editor }) => {
      const dom = document.createElement('nav'); dom.className = 'document-contents'; dom.dataset.type = 'table-of-contents'; dom.contentEditable = 'false'; dom.setAttribute('aria-label', 'Índice del documento');
      let last = '';
      const render = () => {
        const headings = documentHeadings(editor.state.doc).filter(h => h.level >= 2);
        const key = JSON.stringify([headings, numbered()]); if (key === last) return; last = key;
        dom.replaceChildren(); const title = document.createElement('h2'); title.textContent = 'Índice'; dom.append(title);
        if (!headings.length) { const hint = document.createElement('p'); hint.textContent = 'Aplica Sección o Subsección a tus encabezados para completar el índice.'; dom.append(hint); }
        for (const h of headings) {
          const link = document.createElement('a'); link.href = `#texla-section-${h.pos}`; link.className = h.level >= 3 ? 'contents-child' : '';
          link.textContent = `${numbered() && h.number ? `${h.number}. ` : ''}${h.text || 'Sección sin título'}`;
          link.addEventListener('click', e => { e.preventDefault(); editor.chain().setTextSelection(h.pos + 1).scrollIntoView().run(); }); dom.append(link);
        }
      };
      render(); editor.on('transaction', render);
      return { dom, ignoreMutation: () => true, stopEvent: event => event.type === 'click', destroy() { editor.off('transaction', render); } };
    };
  },
});
export const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-type="page-break"]' }]; },
  renderHTML() { return ['div', { 'data-type': 'page-break', class: 'page-break', contenteditable: 'false' }, 'Salto de página']; },
  renderText() { return '\n'; },
});

function roman(number: number) { let result=''; for(const [value,letter] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const) while(number>=value){result+=letter;number-=value;} return result; }
export function hasBibliographyAnchor(node: DocNode): boolean { return node.type === 'bibliographyAnchor' || !!node.content?.some(hasBibliographyAnchor); }
export const BibliographyAnchor = Node.create<{ getLibrary: () => Reference[]; getStyle: () => CitationStyle; getGrouped: () => boolean }>({
  name:'bibliographyAnchor',group:'block',atom:true,selectable:true,
  addOptions(){return {getLibrary:()=>[],getStyle:()=> 'ieee',getGrouped:()=>false};},
  parseHTML(){return [{tag:'section[data-type="bibliography-anchor"]'}];},
  renderHTML(){return ['section',{'data-type':'bibliography-anchor'},'Referencias bibliográficas'];},
  renderText(){return '\nReferencias bibliográficas\n';},
  addNodeView(){ const options=this.options;return ({editor})=>{
    const dom=document.createElement('section');dom.dataset.type='bibliography-anchor';dom.contentEditable='false';dom.setAttribute('aria-label','Bibliografía');let last='';
    const render=()=>{
      const references=citedReferences(editor.getJSON() as DocNode,options.getLibrary());const style=options.getStyle();const key=JSON.stringify([references,style,options.getGrouped()]);if(key===last)return;last=key;
      dom.replaceChildren();const title=document.createElement('h2');title.textContent='Referencias bibliográficas';dom.append(title);dom.className=`bibliography csl-bibliography embedded-bibliography style-${style}`;
      if(!references.length){const hint=document.createElement('p');hint.className='bibliography-hint';hint.textContent=options.getGrouped() ? 'Guía UTEC: máximo 30 fuentes citadas, agrupadas en Referencias primarias y Referencias complementarias. Clasifica cada fuente desde Referencias.' : 'Las referencias aparecerán aquí al insertar citas desde Referencias.';dom.append(hint);return;}
      const formatted=formatReferences(references,style);dom.classList.toggle('hanging-indent',formatted.hangingIndent);dom.style.setProperty('--bib-line-spacing',String(formatted.lineSpacing));
      const entries=document.createElement('div');entries.className='csl-entries';const html = options.getGrouped() ? referenceGroups(references,formatted).map(group=>`<h3>${group.title}</h3>${group.indices.map(index=>formatted.htmlEntries[index]).join('')}`).join('') : formatted.html;
      if(options.getGrouped() && (references.length>30 || references.some(reference=>!reference.group))){const warning=document.createElement('p');warning.className='bibliography-hint bibliography-review';warning.textContent=references.length>30 ? 'Revisa las fuentes: la guía UTEC establece un máximo de 30 referencias.' : 'Clasifica las referencias pendientes como primarias o complementarias desde Referencias.';dom.append(warning);}
      entries.innerHTML=DOMPurify.sanitize(html,{ALLOWED_TAGS:['h3','div','span','i','b','em','strong','a','sup','sub'],ALLOWED_ATTR:['class','href','style']});dom.append(entries);
    };
    render();editor.on('transaction',render);return {dom,ignoreMutation:()=>true,destroy(){editor.off('transaction',render);}};
  };},
});
