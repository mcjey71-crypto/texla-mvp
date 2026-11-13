import type { DocNode } from '../document';
import { resolveFormat, type DocumentFormat } from '../formalDocument';
import { FONTS, type DocumentFont } from '../fonts';
import { PAGE_FORMATS } from '../pageFormats';
import { prepareImage, cacheImage } from '../imageAssets';
import { MAX_FIGURES } from '../imageTypes';
import { textAppearance, blockAppearance, type TextAppearance, type BlockAppearance } from '../richFormatting';
import { readArchive, readXML } from './archive';
import { wordMath } from './wordMath';
import type { ImportOptions } from './common';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const all = (el: Element | undefined, name: string) => Array.from(el?.children || []).filter(x => x.localName === name);
const one = (el: Element | undefined, name: string) => all(el, name)[0];
const value = (el: Element | undefined, key = 'val') => el?.getAttributeNS(W, key) ?? undefined;
const enabled = (el: Element | undefined) => !!el && !['0', 'false', 'off'].includes(value(el) || '');
const num = (n: string | undefined) => n === undefined ? undefined : Number.isFinite(Number(n)) ? Number(n) : undefined;
type RunStyle = TextAppearance & { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
type ParagraphStyle = { run: RunStyle; layout: BlockAppearance; align?: string; level?: number; numId?: string; listLevel?: number; breakBefore?: boolean };

export async function readDocx(bytes: Uint8Array, options: ImportOptions): Promise<{ content: DocNode; format: DocumentFormat; warnings: string[] }> {
  const files = readArchive(bytes), xml = readXML(files['word/document.xml']);
  const warnings = new Set<string>(); const styleMap = new Map<string, Element>();
  const styles = files['word/styles.xml'] ? readXML(files['word/styles.xml']) : undefined;
  for (const s of Array.from(styles?.getElementsByTagNameNS(W, 'style') || [])) styleMap.set(value(s, 'styleId')!, s);
  const defaults = styles?.getElementsByTagNameNS(W, 'docDefaults')[0];
  const defaultParagraph = Array.from(styleMap.values()).find(s => value(s, 'type') === 'paragraph' && value(s, 'default') === '1');
  const fonts = new Map<string, number>(); const sizes = new Map<number, number>();
  const font = (name?: string): DocumentFont | undefined => {
    if (!name) return;
    const aliases: Record<string, DocumentFont> = { 'arial unicode ms': 'Arial', 'arial narrow': 'Arial', 'times': 'Times New Roman', 'calibri light': 'Calibri', 'carlito': 'Calibri', 'tinos': 'Times New Roman', 'arimo': 'Arial' };
    const result = FONTS.find(f => f.id.toLowerCase() === name.toLowerCase())?.id || aliases[name.toLowerCase()];
    if (!result) warnings.add(`La fuente «${name.slice(0,80)}» se sustituyó por una fuente compatible. Revisa sus medidas.`);
    return result || 'Arial';
  };
  function runProperties(p?: Element): RunStyle {
    const result: RunStyle = {};
    for (const [tag, key] of [['b','bold'],['i','italic'],['u','underline'],['strike','strike']] as const) {
      const el = one(p, tag); if (el) result[key] = enabled(el) && value(el) !== 'none';
    }
    const f = one(p, 'rFonts'); if (f && (value(f,'ascii') || value(f,'hAnsi'))) result.font = font(value(f,'ascii') || value(f,'hAnsi'));
    const size = num(value(one(p,'sz'))); if (size !== undefined) result.size = size / 2;
    const color = value(one(p,'color')); if (color) result.color = color === 'auto' ? '000000' : color;
    const colors: Record<string,string> = { yellow:'FFFF00',green:'00FF00',cyan:'00FFFF',magenta:'FF00FF',blue:'0000FF',red:'FF0000',darkBlue:'000080',darkCyan:'008080',darkGreen:'008000',darkMagenta:'800080',darkRed:'800000',darkYellow:'808000',darkGray:'808080',lightGray:'C0C0C0',black:'000000',white:'FFFFFF' };
    const highlight = value(one(p,'highlight')); if (highlight) result.highlight = colors[highlight];
    const fill = value(one(p,'shd'),'fill'); if (fill && fill !== 'auto') result.highlight = fill;
    const vert = value(one(p,'vertAlign')); if (vert) result.vertical = vert === 'superscript' ? 'super' : vert === 'subscript' ? 'sub' : undefined;
    return result;
  }
  function paragraphProperties(p?: Element): Partial<ParagraphStyle> {
    const result: Partial<ParagraphStyle> = { run: runProperties(one(p,'rPr')), layout: {} };
    const spacing = one(p,'spacing'); const indent = one(p,'ind');
    for (const key of ['before','after'] as const) { const n = num(value(spacing,key)); if (n !== undefined) result.layout![key] = n / 20; }
    const line = num(value(spacing,'line')); if (line !== undefined) {
      if (value(spacing,'lineRule') === 'exact') result.layout!.exactLine = line / 20;
      else result.layout!.line = value(spacing,'lineRule') === 'atLeast' ? 1 : line / 240;
    }
    for (const key of ['left','right'] as const) { const n = num(value(indent,key)); if (n !== undefined) result.layout![key] = n / 20; }
    const first = num(value(indent,'firstLine')), hanging = num(value(indent,'hanging'));
    if (first !== undefined || hanging !== undefined) result.layout!.indent = (first || -(hanging || 0)) / 20;
    if (one(p,'keepNext')) result.layout!.keep = enabled(one(p,'keepNext'));
    const align = value(one(p,'jc')); if (align) result.align = align === 'both' || align === 'distribute' ? 'justify' : align === 'end' ? 'right' : align === 'start' ? 'left' : align;
    const level = num(value(one(p,'outlineLvl'))); if (level !== undefined && level < 9) result.level = Math.min(3, level + 1);
    const numbering = one(p,'numPr'); if (numbering) { result.numId = value(one(numbering,'numId')); result.listLevel = num(value(one(numbering,'ilvl'))) || 0; }
    if (one(p,'pageBreakBefore')) result.breakBefore = enabled(one(p,'pageBreakBefore'));
    return result;
  }
  function merge(a: ParagraphStyle, b: Partial<ParagraphStyle>): ParagraphStyle { return {...a,...b,run:{...a.run,...b.run},layout:{...a.layout,...b.layout}}; }
  const base: ParagraphStyle = { run: { font:'Arial',size:11,...runProperties(one(one(defaults,'rPrDefault'),'rPr')) }, layout: {before:0,after:0,line:1}, align:'left' };
  const baseWithParagraph = merge(base, paragraphProperties(one(one(defaults,'pPrDefault'),'pPr')));
  function style(id: string | undefined, inherited: ParagraphStyle, seen = new Set<string>()): ParagraphStyle {
    if (!id || seen.has(id) || seen.size > 30) return inherited;
    const s = styleMap.get(id); if (!s) return inherited; seen.add(id);
    const parent = style(value(one(s,'basedOn')), inherited, seen);
    const result = merge(parent, paragraphProperties(one(s,'pPr'))); result.run = {...result.run,...runProperties(one(s,'rPr'))};
    const name = value(one(s,'name')) || id;
    const heading = /^(?:heading|título|titulo)\s*([1-6])$/i.exec(name);
    if (heading) result.level = Math.min(3, Number(heading[1]));
    if (/^(title|título|titulo)$/i.test(name)) result.level = 1;
    return result;
  }
  const normal = style(value(defaultParagraph,'styleId'), baseWithParagraph);
  const sect = xml.getElementsByTagNameNS(W,'sectPr')[0];
  const pageWidth = (num(value(one(sect,'pgSz'),'w')) || 11906) / 20;
  const pageHeight = (num(value(one(sect,'pgSz'),'h')) || 16838) / 20;
  const margins = one(sect,'pgMar'); const leftMargin = (num(value(margins,'left')) || 1440) / 20; const rightMargin = (num(value(margins,'right')) || 1440) / 20;
  const contentWidth = Math.max(72, pageWidth-leftMargin-rightMargin);
  const pageSize = [...PAGE_FORMATS].filter(p=>p.id!=='Continuo').sort((a,b)=>Math.abs(a.width*72/25.4-pageWidth)+Math.abs(a.height*72/25.4-pageHeight)-Math.abs(b.width*72/25.4-pageWidth)-Math.abs(b.height*72/25.4-pageHeight))[0].id;
  if (xml.getElementsByTagNameNS(W,'sectPr').length > 1) warnings.add('El documento contiene varias secciones. Se usa un formato de página común; revisa sus cambios de orientación y márgenes.');
  const rels = (part: string) => {
    const slash = part.lastIndexOf('/'); const key = part.slice(0,slash+1)+'_rels/'+part.slice(slash+1)+'.rels';
    const map = new Map<string,{target:string;external:boolean}>();
    if (files[key]) for (const r of Array.from(readXML(files[key]).documentElement.children)) {
      const external = r.getAttribute('TargetMode') === 'External', target = r.getAttribute('Target') || '';
      map.set(r.getAttribute('Id') || '', { external, target: external ? target : new URL(target,'https://archive.local/'+part).pathname.slice(1) });
    }
    return map;
  };
  const numbering = files['word/numbering.xml'] ? readXML(files['word/numbering.xml']) : undefined;
  const counters = new Map<string,number[]>();
  const roman = (n:number) => { if(!Number.isSafeInteger(n)||n<1||n>9999)return String(n);let out='';for(const [v,s] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const)while(n>=v){out+=s;n-=v;}return out; };
  function numberLabel(id?: string, depth=0) {
    if (!id || id === '0' || !numbering || !Number.isInteger(depth) || depth<0 || depth>8) return '';
    const n = Array.from(numbering.getElementsByTagNameNS(W,'num')).find(x=>value(x,'numId')===id);
    const abstractId = value(one(n,'abstractNumId')); const a = Array.from(numbering.getElementsByTagNameNS(W,'abstractNum')).find(x=>value(x,'abstractNumId')===abstractId);
    const level = all(a,'lvl').find(x=>Number(value(x,'ilvl'))===depth); if (!level) return '';
    const counts = counters.get(id) || []; const override = all(n,'lvlOverride').find(x=>Number(value(x,'ilvl'))===depth);
    const start=num(value(one(override,'startOverride')) || value(one(level,'start')));
    counts[depth] = counts[depth] === undefined ? (start!==undefined&&Number.isSafeInteger(start)&&start>=0&&start<=1_000_000?start:1) : counts[depth]+1; counts.length=depth+1;counters.set(id,counts);
    const fmt = value(one(level,'numFmt'));
    if (fmt === 'bullet') return '• ';
    return (value(one(level,'lvlText')) || `%${depth+1}.`).replace(/%(\d+)/g,(_,d)=>{
      const index=Number(d)-1, count=counts[index]||1, f=value(one(all(a,'lvl').find(x=>Number(value(x,'ilvl'))===index),'numFmt'));
      return f==='upperRoman'?roman(count):f==='lowerRoman'?roman(count).toLowerCase():f==='lowerLetter'||f==='upperLetter'?String.fromCharCode((f==='lowerLetter'?97:65)+(count-1)%26):String(count);
    })+' ';
  }
  let figureCount=0,equations=0; const assets = new Map<string,Awaited<ReturnType<typeof prepareImage>>>();
  async function image(el: Element, part: string, width: number): Promise<DocNode[]> {
    const blip = Array.from(el.getElementsByTagName('*')).find(x=>x.localName==='blip');
    const id = blip?.getAttributeNS(R,'embed'); const relation=rels(part).get(id || '');
    if (!relation || relation.external || !files[relation.target]) { warnings.add('Una imagen enlazada o un dibujo no compatible necesita revisión manual.');return [{type:'paragraph',content:[{type:'text',text:'[Imagen no disponible]'}]}]; }
    if(figureCount>=MAX_FIGURES)throw new Error('El documento supera las 20 imágenes admitidas. Divídelo antes de importar para conservarlas todas.');
    options.signal.throwIfAborted();
    let prepared=assets.get(relation.target);
    if(!prepared){const ext=relation.target.split('.').pop()?.toLowerCase();const mime=ext==='png'?'image/png':ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':undefined;
      if(!mime){warnings.add(`Una imagen ${ext || ''} no se pudo convertir. Guárdala como PNG o JPG.`);return [{type:'paragraph',content:[{type:'text',text:'[Imagen no compatible]'}]}];}
      prepared=await prepareImage(new File([files[relation.target].slice().buffer],relation.target,{type:mime}),options.signal);await cacheImage(prepared.asset,prepared.blob);assets.set(relation.target,prepared);
    }
    figureCount++;const extent=Array.from(el.getElementsByTagName('*')).find(x=>x.localName==='extent');const cx=Number(extent?.getAttribute('cx'))/12700;
    const docPr=Array.from(el.getElementsByTagName('*')).find(x=>x.localName==='docPr');
    return [{type:'figure',attrs:{id:crypto.randomUUID(),asset:prepared.asset,caption:'',source:'',alt:(docPr?.getAttribute('descr')||'Imagen importada').slice(0,300),width:Math.max(1,Math.min(100,Math.round((cx||width)/width*100))),align:'center',captionMode:'none'}}];
  }
  function marks(s: RunStyle) {
    const result: NonNullable<DocNode['marks']> = [];
    for(const key of ['bold','italic','underline','strike'] as const)if(s[key])result.push({type:key});
    const appearance=textAppearance(s);if(Object.keys(appearance).length)result.push({type:'textAppearance',attrs:{appearance}});
    return result;
  }
  // Bibliography text is often directly formatted, while Word hyperlinks retain an
  // unrelated character style. Use the surrounding reference's typography only here.
  function bibliographyStyle(id?: string, seen = new Set<string>()): boolean {
    if (!id || seen.has(id)) return false;
    seen.add(id);const s=styleMap.get(id);if(!s)return false;
    const name=(value(one(s,'name'))||id).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return /bibliograph|bibliograf|^references$|^referencias$/i.test(name) || bibliographyStyle(value(one(s,'basedOn')),seen);
  }
  function proseTypography(nodes: DocNode[]) {
    const fonts=new Map<string,number>(), sizes=new Map<number,number>();
    const visit=(n:DocNode)=>{
      if(n.type==='text'&&!n.marks?.some(m=>m.type==='link')){
        const a=textAppearance(n.marks?.find(m=>m.type==='textAppearance')?.attrs?.appearance), weight=n.text?.trim().length||0;
        if(a.vertical)return;
        if(a.font)fonts.set(a.font,(fonts.get(a.font)||0)+weight);
        if(a.size)sizes.set(a.size,(sizes.get(a.size)||0)+weight);
      }
      n.content?.forEach(visit);
    };nodes.forEach(visit);
    return textAppearance({font:[...fonts].sort((a,b)=>b[1]-a[1])[0]?.[0],size:[...sizes].sort((a,b)=>b[1]-a[1])[0]?.[0]});
  }
  function applyTypography(node:DocNode, typography:TextAppearance){
    const existing=node.marks?.find(m=>m.type==='textAppearance');
    node.marks=[...(node.marks||[]).filter(m=>m.type!=='textAppearance'),{type:'textAppearance',attrs:{appearance:{...textAppearance(existing?.attrs?.appearance),...typography}}}];
  }
  async function paragraph(el: Element, part: string, width: number, inTable=false): Promise<DocNode[]> {
    const pp=one(el,'pPr');const ps=merge(style(value(one(pp,'pStyle')),normal),paragraphProperties(pp));
    if((ps.layout.indent||0)<0)ps.layout.left=Math.max(ps.layout.left||0,-ps.layout.indent!);
    const result: DocNode[]=[];let inline:DocNode[]=[];const raw=Array.from(el.getElementsByTagNameNS(W,'t')).map(x=>x.textContent||'').join('');
    const label=numberLabel(ps.numId,ps.listLevel);if(label)inline.push({type:'text',text:label,marks:marks(ps.run)});
    let level=ps.level;
    // Directly formatted headings from Google Docs often have no Word heading style.
    const runs=Array.from(el.getElementsByTagNameNS(W,'r')).filter(r=>r.getElementsByTagNameNS(W,'t').length);
    const bold = runs.length>0 && runs.every(r=>({...ps.run,...runProperties(one(r,'rPr'))}).bold);
    if(!level && raw.trim().length>0 && raw.length<180 && bold && /^(?:\d+(?:\.\d+)*\.?\s|[IVX]+[.)]\s|[A-ZÁÉÍÓÚÑ\s:.-]{8,}$)/u.test((label+raw).trim()))level=label||/^[IVX]+[.)]/.test(raw)?2:/^\d+\.\d+/.test(raw)?3:1;
    const attrs={textAlign:ps.align,layout:blockAppearance({...ps.layout,...(level?{keep:true}:{})}),...(level?{level,numbered:false}:{})};
    const flush=(empty=false)=>{if(inline.length||empty){result.push({type:level?'heading':'paragraph',attrs,content:inline});inline=[];}};
    async function visit(node:Element, inherited:RunStyle, link?:string):Promise<void>{
      options.signal.throwIfAborted();
      if(node.namespaceURI===M && node.localName==='oMath'){const latex=wordMath(node,warnings);equations++;if(node.parentElement?.localName==='oMathPara'&&!inTable){flush();result.push({type:'blockMath',attrs:{latex}});}else inline.push({type:'inlineMath',attrs:{latex}});return;}
      if(node.localName==='r'){
        const rp=one(node,'rPr');const s={...inherited,...style(value(one(rp,'rStyle')),{...normal,run:inherited}).run,...runProperties(rp)};
        for(const child of Array.from(node.children))if(child.localName!=='rPr')await visit(child,s,link);return;
      }
      if(node.localName==='hyperlink'){const relation=rels(part).get(node.getAttributeNS(R,'id')||'');for(const c of Array.from(node.children))await visit(c,inherited,relation?.external&&/^(https?:\/\/|mailto:)/i.test(relation.target)?relation.target:undefined);return;}
      if(node.localName==='t'){
        const text=node.textContent||'';if(!text)return;const m=marks(inherited);if(link)m.push({type:'link',attrs:{href:link}});inline.push({type:'text',text,marks:m});
        if(inherited.font)fonts.set(inherited.font,(fonts.get(inherited.font)||0)+text.length);if(inherited.size)sizes.set(inherited.size,(sizes.get(inherited.size)||0)+text.length);return;
      }
      if(node.localName==='drawing'||node.localName==='pict'){flush();result.push(...await image(node,part,width));return;}
      if(node.localName==='br'){if(value(node,'type')==='page'){flush();result.push({type:'pageBreak'});}else inline.push({type:'hardBreak'});return;}
      if(node.localName==='tab'){inline.push({type:'text',text:'\u2003',marks:marks(inherited)});return;}
      if(node.localName==='noBreakHyphen'){inline.push({type:'text',text:'‑',marks:marks(inherited)});return;}
      if(['del','instrText','pPr','rPr','lastRenderedPageBreak','sectPr'].includes(node.localName))return;
      if(node.localName==='footnoteReference'||node.localName==='endnoteReference'){const id=value(node,'id');inline.push({type:'text',text:`[${id}]`,marks:marks({...inherited,vertical:'super'})});return;}
      for(const child of Array.from(node.children))await visit(child,inherited,link);
    }
    if(ps.breakBefore)result.push({type:'pageBreak'});
    for(const child of Array.from(el.children))if(child.localName!=='pPr')await visit(child,ps.run);
    flush(result.length===0);
    if(bibliographyStyle(value(one(pp,'pStyle')))){
      const typography=proseTypography(result);
      for(const paragraph of result)for(const node of paragraph.content||[])if(node.marks?.some(m=>m.type==='link'))applyTypography(node,typography);
    }
    return result;
  }
  async function table(el:Element,part:string,width:number,depth:number):Promise<DocNode>{
    const grid=all(one(el,'tblGrid'),'gridCol').map(c=>(num(value(c,'w'))||1440)/15);const sum=grid.reduce((a,b)=>a+b,0);
    const factor=sum?Math.min(1,width/0.75/sum):1;const cols=grid.map(n=>Math.max(1,Math.round(n*factor)));
    const rows:DocNode[]=[];const active=new Map<number,DocNode>();
    const borders=one(one(el,'tblPr'),'tblBorders');const noBorder=!!borders&&Array.from(borders.children).every(b=>['nil','none'].includes(value(b)||''));
    for(const tr of all(el,'tr')){
      const cells:DocNode[]=[];let x=num(value(one(one(tr,'trPr'),'gridBefore')))||0;
      for(const tc of all(tr,'tc')){
        const p=one(tc,'tcPr'),span=Math.min(100,Math.max(1,num(value(one(p,'gridSpan')))||1)),vm=one(p,'vMerge');
        if(vm&&value(vm)!=='restart'&&active.has(x)){const cell=active.get(x)!;cell.attrs!.rowspan++;x+=span;continue;}
        const fill=value(one(p,'shd'),'fill');const cell:DocNode={type:enabled(one(one(tr,'trPr'),'tblHeader'))?'tableHeader':'tableCell',attrs:{colspan:span,rowspan:1,colwidth:cols.length?Array.from({length:span},(_,i)=>cols[x+i]||Math.round(width/.75/Math.max(1,cols.length))):null,layout:blockAppearance({background:fill,border:noBorder?false:undefined})},content:await blocks(tc,part,width*span/Math.max(span,grid.length),depth+1,true)};
        if(!cell.content?.length)cell.content=[{type:'paragraph'}];cells.push(cell);
        for(let i=0;i<span;i++){active.delete(x+i);if(vm&&value(vm)==='restart')active.set(x+i,cell);}x+=span;
      }
      rows.push({type:'tableRow',content:cells});
    }
    const typography=proseTypography(rows);
    const size=typography.size;
    // Compact math in cells is part of the table, not a separately numbered equation.
    if(size){const visit=(n:DocNode)=>{if(n.type==='inlineMath')applyTypography(n,{size});n.content?.forEach(visit);};rows.forEach(visit);}
    return {type:'table',attrs:{layout:blockAppearance({border:noBorder?false:undefined})},content:rows};
  }
  async function blocks(parent:Element,part:string,width:number,depth=0,inTable=false):Promise<DocNode[]>{
    if(depth>20)throw new Error('El documento tiene demasiados niveles de tablas.');const out:DocNode[]=[];
    for(const el of Array.from(parent.children)){
      if(el.localName==='p')out.push(...await paragraph(el,part,width,inTable));
      else if(el.localName==='tbl'){
        if(depth>0){warnings.add('Una tabla anidada se convirtió en una tabla independiente. Revisa su posición.');out.push(...await blocks(el,part,width,depth+1,inTable));}
        else out.push(await table(el,part,width,depth));
      }else if(['sdt','sdtContent','ins','tr','tc'].includes(el.localName))out.push(...await blocks(el,part,width,depth+1,inTable));
    }return out;
  }
  const content:DocNode[]=[];
  // Preserve header artwork once instead of silently discarding it; repeated headers need pagination support.
  const mainRelations=rels('word/document.xml');
  for(const ref of all(sect,'headerReference').slice(0,1)){
    const relation=mainRelations.get(ref.getAttributeNS(R,'id')||'');if(relation&&!relation.external&&files[relation.target]){
      const header=await blocks(readXML(files[relation.target]).documentElement,relation.target,contentWidth);
      const hasContent=(n:DocNode):boolean=>['figure','inlineMath','blockMath'].includes(n.type)||!!n.text?.trim()||!!n.content?.some(hasContent);
      const nonempty=header.filter(hasContent);
      // Word permits blank headers (including a deliberately blank first page).
      // The editor's importedHeader node requires at least one content block.
      if(!nonempty.length)continue;
      if(nonempty.every(n=>n.type==='paragraph'||n.type==='figure')&&nonempty.length<=3){
        nonempty.sort((a,b)=>(a.type==='figure'?0:1)-(b.type==='figure'?0:1));
        content.push({type:'importedHeader',content:nonempty});
      }else{content.push(...header);warnings.add('El encabezado complejo se recuperó al inicio. Revisa su posición.');}
    }
  }
  content.push(...await blocks(xml.getElementsByTagNameNS(W,'body')[0], 'word/document.xml',contentWidth));
  for(const part of ['word/footnotes.xml','word/endnotes.xml'])if(files[part]){
    const notes=Array.from(readXML(files[part]).documentElement.children).filter(n=>Number(value(n,'id'))>0);
    if(notes.length){warnings.add('Las notas al pie se recuperaron al final. Revisa su numeración y posición.');content.push({type:'heading',attrs:{level:2,numbered:false},content:[{type:'text',text:'Notas'}]});for(const note of notes){content.push({type:'paragraph',content:[{type:'text',text:`[${value(note,'id')}]`}]},...await blocks(note,part,contentWidth));}}
  }
  const dominantFont=[...fonts].sort((a,b)=>b[1]-a[1])[0]?.[0]||normal.run.font;
  const dominantSize=[...sizes].sort((a,b)=>b[1]-a[1])[0]?.[0]||11;
  const format=resolveFormat({pageSize,fontFamily:dominantFont as DocumentFont,fontSize:([10,11,12].includes(dominantSize)?dominantSize:11) as 10|11|12,margin:([2,2.5,2.54,3].sort((a,b)=>Math.abs(a-leftMargin*2.54/72)-Math.abs(b-leftMargin*2.54/72))[0]) as DocumentFormat['margin'],lineSpacing:1,paragraphSpacing:0,paragraphAlignment:'left',headingStyle:'formal',pageNumbers:'none'});
  if(equations)warnings.add(`Se convirtieron ${equations} ecuación(es) de Word a LaTeX editable. Revisa sus símbolos y agrupaciones.`);
  if(content.some(n=>n.type==='importedHeader'))warnings.add('El encabezado se muestra al inicio en el editor y en la impresión del navegador; se repite al compilar la exportación LaTeX.');
  if(all(sect,'footerReference').length)warnings.add('Los pies de página de Word requieren revisión manual. Puedes activar la numeración de páginas desde Diseño.');
  warnings.add('Se conservaron estilos, tablas e imágenes compatibles. La paginación puede variar por las fuentes disponibles; las citas importadas siguen siendo texto.');
  return {content:{type:'doc',content},format,warnings:[...warnings]};
}
