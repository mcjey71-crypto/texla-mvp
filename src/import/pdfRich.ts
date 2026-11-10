import { OPS, Util, type PDFPageProxy } from 'pdfjs-dist';
import type { DocNode } from '../document';
import { prepareImage, cacheImage } from '../imageAssets';
import { MAX_FIGURES } from '../imageTypes';
import { textAppearance, type TextAppearance } from '../richFormatting';
import type { ImportOptions } from './common';
import type { PdfTextItem } from './pdfLayout';

type Item = PdfTextItem & {fontName?:string; id?:string; tag?:string; order?:number};
type Tree = {role?:string;type?:string;id?:string;children?:Tree[];attributes?:{name:string;value:unknown}[]};
export type PdfRichState = {images:number; font?:string; size?:number; header?:DocNode; tagged?:boolean};
type Positioned = {node:DocNode;top:number;bottom:number};
const rect=(items:Item[])=>({left:Math.min(...items.map(i=>i.transform[4])),right:Math.max(...items.map(i=>i.transform[4]+i.width)),top:Math.max(...items.map(i=>i.transform[5]+i.height)),bottom:Math.min(...items.map(i=>i.transform[5]))});

export async function richPdfPage(page:PDFPageProxy, raw:any, options:ImportOptions, state:PdfRichState, warnings:string[]):Promise<DocNode[]> {
 const viewport=page.getViewport({scale:1});
 const operators=await page.getOperatorList();
 const tree=await page.getStructTree().catch(()=>null) as Tree|null;
 const groups=new Map<string,Item[]>();const unmarked:Item[]=[];const items:Item[]=[];const stack:(string|undefined)[]=[];
 for(const value of raw.items){
  if(value.type==='beginMarkedContentProps'||value.type==='beginMarkedContent'){stack.push(value.id);continue;}
  if(value.type==='endMarkedContent'){stack.pop();continue;}
  if(!('str' in value)||!value.str.trim())continue;
  const item={...value,order:items.length} as Item;items.push(item);
  const id=[...stack].reverse().find(x=>!!x);if(id){const g=groups.get(id)||[];g.push(item);groups.set(id,g);}else unmarked.push(item);
 }
 const fontStyle=(item:Item):TextAppearance&{bold?:boolean;italic?:boolean}=>{
  let name='';try{name=(page.commonObjs.get(item.fontName!) as any).name||'';}catch{}
  const family=/calibri|carlito/i.test(name)?'Calibri':/times|tinos/i.test(name)?'Times New Roman':/cambria/i.test(name)?'Cambria':/garamond/i.test(name)?'EB Garamond':/arial|helvetica|arimo/i.test(name)||raw.styles[item.fontName!]?.fontFamily==='sans-serif'?'Arial':'Times New Roman';
  return {font:family,size:Math.round(Math.abs(item.height||item.transform[3])*10)/10,bold:/bold|black|demi/i.test(name),italic:/italic|oblique/i.test(name)};
 };
 const styles=items.map(fontStyle);const weighted=new Map<string,number>();
 for(let i=0;i<items.length;i++){const key=styles[i].font+'|'+styles[i].size;weighted.set(key,(weighted.get(key)||0)+items[i].str.length);}
 const dominant=[...weighted].sort((a,b)=>b[1]-a[1])[0]?.[0].split('|');
 if(!state.font&&dominant){state.font=dominant[0];state.size=Number(dominant[1]);}
 const consumed=new Set<Item>();
 function paragraph(list:Item[],role?:string):Positioned|undefined{
  if(!list.length)return;
  const box=rect(list),dominantSize=[...list].sort((a,b)=>b.str.length-a.str.length)[0].height||10;
  const lines:Item[][]=[];
  for(const item of list){const last=lines.at(-1);if(last&&Math.abs(last[0].transform[5]-item.transform[5])<=Math.max(2,dominantSize*.65)&&item.transform[4]>=last.at(-1)!.transform[4]-2)last.push(item);else lines.push([item]);}
  const content:DocNode[]=[];
  for(const line of lines){
    const baseline=line.find(i=>i.height>=dominantSize*.9)?.transform[5]||line[0].transform[5];let previous:Item|undefined;
    for(const item of line){consumed.add(item);const style=fontStyle(item);const dy=item.transform[5]-baseline;
      if(item.height<dominantSize*.85&&Math.abs(dy)>1)style.vertical=dy>0?'super':'sub';
      const gap=previous?item.transform[4]-previous.transform[4]-previous.width:0;
      if(content.length&&((!previous&&lines.indexOf(line)>0)||(previous&&gap>dominantSize*.12&&!style.vertical))&&!/\s$/.test(content.at(-1)?.text||''))content.push({type:'text',text:' '});
      const marks:NonNullable<DocNode['marks']>=[{type:'textAppearance',attrs:{appearance:textAppearance(style)}}];if(style.bold)marks.push({type:'bold'});if(style.italic)marks.push({type:'italic'});
      content.push({type:'text',text:item.str,marks});previous=item;
    }
  }
  const text=list.map(i=>i.str).join(' ');const bold=list.every(i=>fontStyle(i).bold);
  const heading=/^H[1-6]$/.test(role||'')?Math.min(3,Number(role![1])):text.length<200&&bold&&(/^(?:\d+(?:\.\d+)*\.?\s|[IVX]+[.)]\s)/.test(text)||text===text.toUpperCase())?(text.match(/^\d+\.\d/)?3:2):undefined;
  const center=Math.abs((box.left+box.right)/2-viewport.width/2)<12;
  const alignment=center&&lines.length<=3?'center':lines.length>1&&box.right-box.left>viewport.width*.6?'justify':'left';
  const gaps=lines.slice(1).map((l,i)=>lines[i][0].transform[5]-l[0].transform[5]).filter(n=>n>0&&n<dominantSize*3);
  const line=gaps.length?Math.min(2,Math.max(1,gaps.reduce((a,b)=>a+b,0)/gaps.length/dominantSize)):1.15;
  return {node:{type:heading?'heading':'paragraph',attrs:{...(heading?{level:heading,numbered:false}:{}),textAlign:alignment,layout:{before:0,after:5,line}},content},top:box.top,bottom:box.bottom};
 }
 function gathered(t:Tree,depth=0):Item[]{if(depth>100)throw new Error('La estructura del PDF es demasiado profunda. Simplifícalo antes de importar.');return t.type==='content'?(groups.get(t.id||'')||[]):(t.children||[]).flatMap(c=>gathered(c,depth+1));}
 function tables(t:Tree):Positioned|undefined{
  const trs:Tree[]=[];const collect=(n:Tree,depth=0)=>{if(depth>100)throw new Error('La estructura del PDF es demasiado profunda.');if(n.role==='TR')trs.push(n);else for(const c of n.children||[])collect(c,depth+1);};collect(t);
  const rowIndices:number[]=[];const rows:DocNode[]=[];const positions:Item[]=[];let columnWidths:number[]=[];
  trs.forEach((tr,index)=>{
    const cells=(tr.children||[]).filter(c=>c.role==='TD'||c.role==='TH');const contents=cells.map(c=>gathered(c));
    if(!contents.some(c=>c.length))return;
    rowIndices.push(index);positions.push(...contents.flat());
    // Use repeated column text positions to retain unequal columns; equal widths remain a safe fallback.
    const starts=contents.map(c=>c.length?rect(c).left:NaN);
    if(starts.every(Number.isFinite)&&starts.every((x,i)=>!i||x>starts[i-1])){
      const right=Math.max(...contents.flat().map(i=>i.transform[4]+i.width));
      const proposed=starts.map((x,i)=>(i+1<starts.length?starts[i+1]-x:right-x+6)/.75);
      if(!columnWidths.length)columnWidths=proposed;
    }
    rows.push({type:'tableRow',content:cells.map((c,i)=>({type:c.role==='TH'?'tableHeader':'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null,layout:{}},content:[paragraph(contents[i])?.node||{type:'paragraph'}]}))});
  });
  if(!positions.length)return;
  for(const row of rows)for(let i=0;i<row.content!.length;i++)if(columnWidths.length===row.content!.length)row.content![i].attrs!.colwidth=[Math.max(1,Math.round(columnWidths[i]))];
  const box=rect(positions);
  return {node:{type:'table',attrs:{layout:{},_pdfRows:trs.length,_pdfIndices:rowIndices},content:rows},top:box.top,bottom:box.bottom};
 }
 const positioned:Positioned[]=[];
 function walk(t:Tree,depth=0){
  if(depth>100)throw new Error('La estructura del PDF es demasiado profunda.');
  if(t.role==='Table'){const node=tables(t);if(node)positioned.push(node);return;}
  if(t.role==='Figure')return;
  if(['P','LI','H1','H2','H3','H4','H5','H6'].includes(t.role||'')){const p=paragraph(gathered(t),t.role);if(p)positioned.push(p);return;}
  for(const child of t.children||[])walk(child,depth+1);
 }
 if(tree)walk(tree);state.tagged=!!tree&&consumed.size>0;
 const remaining=items.filter(i=>!consumed.has(i));
 // Group untagged text by baseline and paragraph gaps, allowing small superscripts to stay in the line.
 let group:Item[]=[];
 const flush=()=>{const p=paragraph(group);if(p)positioned.push(p);group=[];};
 for(const item of remaining){const prev=group.at(-1);if(prev&&(prev.transform[5]-item.transform[5]>Math.max(prev.height,item.height)*1.8||item.transform[5]>prev.transform[5]+Math.max(prev.height,item.height)*.7))flush();group.push(item);}flush();
 let transform=[1,0,0,1,0,0];const transforms:number[][]=[];const imageBoxes:{x:number;y:number;width:number;height:number;top:number}[]=[];
 for(let i=0;i<operators.fnArray.length;i++){
  const op=operators.fnArray[i],a=operators.argsArray[i];
  if(op===OPS.save)transforms.push([...transform]);else if(op===OPS.restore)transform=transforms.pop()||[1,0,0,1,0,0];
  else if(op===OPS.transform)transform=Util.transform(transform,a);
  else if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject){
    const points=[[0,0],[0,1],[1,0],[1,1]].map(p=>{Util.applyTransform(p,transform);return p;});
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
    if(width>8&&height>8&&width<viewport.width*.98&&height<viewport.height*.98)imageBoxes.push({x,y,width,height,top:y+height});
  }
 }
 let canvas:HTMLCanvasElement|undefined;
 try{
  for(const box of imageBoxes){
    options.signal.throwIfAborted();const inHeader=box.top>viewport.height-60;
    if(inHeader&&page.pageNumber>1)continue;
    if(state.images>=MAX_FIGURES)throw new Error('El PDF supera las 20 imágenes admitidas. Divídelo antes de importar.');
    if(!canvas){canvas=document.createElement('canvas');const v=page.getViewport({scale:Math.min(2,Math.sqrt(6_000_000/(viewport.width*viewport.height)))});canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await page.render({canvas,viewport:v}).promise;}
    const scale=canvas.width/viewport.width;const crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(box.width*scale));crop.height=Math.max(1,Math.ceil(box.height*scale));
    crop.getContext('2d')!.drawImage(canvas,box.x*scale,(viewport.height-box.top)*scale,crop.width,crop.height,0,0,crop.width,crop.height);
    const blob=await new Promise<Blob>((resolve,reject)=>crop.toBlob(b=>b?resolve(b):reject(new Error('No se pudo recuperar una imagen del PDF.')),'image/png'));
    const prepared=await prepareImage(new File([blob],'pdf-image.png',{type:'image/png'}),options.signal);await cacheImage(prepared.asset,prepared.blob);state.images++;
    const node:DocNode={type:'figure',attrs:{id:crypto.randomUUID(),asset:prepared.asset,caption:'',source:'',alt:'Imagen recuperada del PDF',width:Math.max(1,Math.min(100,Math.round(box.width/(viewport.width-144)*100))),align:'center',captionMode:'none'}};
    positioned.push({node,top:box.top,bottom:box.y});crop.width=0;crop.height=0;
  }
 }finally{if(canvas){canvas.width=0;canvas.height=0;}}
 positioned.sort((a,b)=>b.top-a.top);
 const header=positioned.filter(p=>p.bottom>viewport.height-65);
 if(header.length&&page.pageNumber===1){const nodes=header.map(p=>p.node).filter(n=>n.type==='paragraph'||n.type==='figure');if(nodes.length<=3&&nodes.length===header.length){nodes.sort((a,b)=>(a.type==='figure'?0:1)-(b.type==='figure'?0:1));for(const n of nodes)if(n.type==='paragraph')n.attrs={...n.attrs,textAlign:'right'};state.header={type:'importedHeader',content:nodes};}}
 const result=positioned.filter(p=>!state.header||p.bottom<=viewport.height-65).map(p=>p.node);
 if(positioned.some(p=>p.node.type==='table'))warnings.push('Se recuperaron tablas usando las etiquetas estructurales del PDF. Revisa las celdas combinadas y los cortes entre páginas.');
 return result;
}

export function mergePdfTables(previous:DocNode|undefined,next:DocNode|undefined):boolean{
 if(previous?.type!=='table'||next?.type!=='table')return false;
 const a=previous.attrs?._pdfIndices as number[]|undefined,b=next.attrs?._pdfIndices as number[]|undefined;
 if(!a?.length||!b?.length||previous.attrs?._pdfRows!==next.attrs?._pdfRows||a.at(-1)!>=previous.attrs!._pdfRows-1||b[0]<a.at(-1)!||b[0]>a.at(-1)!+1)return false;
 if(previous.content?.[0].content?.length!==next.content?.[0].content?.length)return false;
 for(let i=0;i<b.length;i++){
  const existing=a.indexOf(b[i]);if(existing<0){previous.content!.push(next.content![i]);a.push(b[i]);}
  else for(let c=0;c<next.content![i].content!.length;c++){
    const dest=previous.content![existing].content![c],source=next.content![i].content![c];
    const filled=(node:DocNode):boolean=>!!node.text?.trim()||!!node.content?.some(filled);
    if(!filled(dest)&&filled(source))previous.content![existing].content![c]=source;
    else if(filled(source))dest.content!.push(...source.content!);
  }
 }
 return true;
}
