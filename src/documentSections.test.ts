import {describe,it,expect} from 'vitest';
import {sectionLayout} from './documentSections';
import {exportLatex,type DocNode} from './document';
import {validImagePlacement} from './imageTypes';
import {makeBackup,readBackup} from './backup';
const p=(text:string):DocNode=>({type:'paragraph',content:[{type:'text',text}]});
const table:DocNode={type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',content:[p('Encabezado')]}]},{type:'tableRow',content:[{type:'tableCell',content:[p('Celda editable')]}]}]};
const logo:DocNode={type:'figure',attrs:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',asset:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',mime:'image/png',width:32,height:16,size:100},caption:'',alt:'Logo',source:'',width:12,align:'right',captionMode:'none',placement:{left:85.29,top:4,width:12.3}}};
describe('imported section layout',()=>{
 it('bounds shared section styling and rejects unsafe image positions',()=>{
  expect(sectionLayout({columns:'2;display:none',gap:Infinity,breakBefore:'yes'})).toEqual({columns:1,gap:18,breakBefore:false});
  expect(sectionLayout({columns:2,gap:22.7,breakBefore:true})).toEqual({columns:2,gap:22.7,breakBefore:true});
  expect(validImagePlacement({left:85,top:0,width:12})).toBe(true);
  for(const placement of [{left:99,top:0,width:12},{left:0,top:NaN,width:12},{left:'0;display:none',top:0,width:12},{left:0,top:-20,width:12}])expect(validImagePlacement(placement)).toBe(false);
 });
 it('preserves positioned logos and section boundaries in backups and LaTeX',()=>{
  const content:DocNode={type:'doc',content:[{type:'documentSection',attrs:{columns:1,gap:22.7},content:[p('Institución'),logo]},{type:'documentSection',attrs:{columns:2,gap:22.7},content:[p('Izquierda'),{type:'columnBreak'},p('Derecha')]},{type:'documentSection',attrs:{columns:1,breakBefore:true},content:[table]}]};
  const restored=readBackup(makeBackup({id:'test',title:'Artículo',content,updated:0}));
  expect(restored.content.content?.[0].content?.[1].attrs?.placement).toEqual(logo.attrs?.placement);
  const out=exportLatex('Artículo',restored.content);
  expect(out).toContain('\\usepackage{multicol,eso-pic,capt-of}');
  expect(out).toContain('\\AddToShipoutPictureFG*');expect(out).toContain('0.852900\\textwidth');expect(out).toContain('-\\LenToUnit{4pt}');
  expect(out.match(/\\includegraphics/g)).toHaveLength(1);
  expect(out).toContain('\\begin{multicols}{2}');expect(out).toContain('\\columnbreak');
  expect(out.indexOf('\\end{multicols}')).toBeLessThan(out.indexOf('\\begin{longtable}'));
  expect(out).toContain('\\clearpage');
 });
 it('uses non-floating tables inside columns without repeating longtable headers',()=>{
  const out=exportLatex('Tabla en columna',{type:'doc',content:[{type:'documentSection',attrs:{columns:2},content:[table,p('Texto posterior')]}]});
  expect(out).toContain('\\begin{tabular}');expect(out).not.toContain('\\begin{longtable}');expect(out).not.toContain('\\endfirsthead');expect(out).not.toContain('\\endhead');expect(out.match(/Encabezado/g)).toHaveLength(1);expect(out).toContain('Texto posterior');
 });
});
