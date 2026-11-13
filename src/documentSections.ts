import {Node} from '@tiptap/core';
export type SectionLayout={columns:number;gap:number;breakBefore:boolean};
export function sectionLayout(value:unknown):SectionLayout{
 const a=(value||{}) as Partial<SectionLayout>;
 return {columns:Number.isInteger(a.columns)&&a.columns!>=1&&a.columns!<=4?a.columns!:1,gap:typeof a.gap==='number'&&Number.isFinite(a.gap)&&a.gap>=0&&a.gap<=144?a.gap:18,breakBefore:a.breakBefore===true};
}
export const DocumentSection=Node.create({
 name:'documentSection',group:'block',content:'block+',defining:true,
 addAttributes(){return {columns:{default:1},gap:{default:18},breakBefore:{default:false}};},
 parseHTML(){return [{tag:'section[data-texla-section]',getAttrs:el=>{try{return sectionLayout(JSON.parse(el.getAttribute('data-texla-section')||'{}'));}catch{return false;}}}];},
 renderHTML({node}){const a=sectionLayout(node.attrs);return ['section',{'data-texla-section':JSON.stringify(a),'data-columns':a.columns,class:'document-section',style:`column-count:${a.columns};column-gap:${a.gap}pt;${a.breakBefore?'break-before:page;':''}`},0];},
});
export const ColumnBreak=Node.create({
 name:'columnBreak',group:'block',atom:true,selectable:true,
 parseHTML(){return [{tag:'div[data-column-break]'}];},
 renderHTML(){return ['div',{'data-column-break':'true',class:'column-break','aria-label':'Salto de columna'}];},
});
