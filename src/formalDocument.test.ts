import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { createTemplate, resolveFormat } from './formalDocument';
import { exportLatex, type DocNode } from './document';
import { findText } from './SearchDocument';
import { readBackup, makeBackup } from './backup';
const text=(s:string):DocNode=>({type:'text',text:s});
const p=(s:string):DocNode=>({type:'paragraph',content:[text(s)]});
const cell=(s:string,type='tableCell',attrs={}):DocNode=>({type,attrs,content:[p(s)]});
describe('formal document export',()=>{
 it('exports a thesis structure, automatic sections, contents and selected page settings',()=>{
  const doc=createTemplate('thesis');const tex=exportLatex(doc.title,doc.content,[],doc.citationStyle,{...doc.format,pageSize:'Carta',margin:3,lineSpacing:2});
  expect(tex).toContain('\\documentclass[12pt,letterpaper]');expect(tex).toContain('margin=3cm');expect(tex).toContain('\\setstretch{2}');
  expect(tex).toContain('\\tableofcontents');expect(tex).toContain('\\clearpage');expect(tex).toContain('\\section{Metodología}');
  expect(tex).not.toContain('\\section{Mi tesis}');
 });
 it('exports table contents, escaped text and merged grid positions',()=>{
  const table:DocNode={type:'table',content:[{type:'tableRow',content:[cell('Medida & unidad','tableHeader',{colspan:2})]},{type:'tableRow',content:[cell('50%','tableCell',{rowspan:2}),cell('A')]},{type:'tableRow',content:[cell('B')]}]};
  const tex=exportLatex('Datos',{type:'doc',content:[table]});
  expect(tex).toContain('\\begin{longtable}{*{2}');expect(tex).toContain('\\multicolumn{2}');expect(tex).toContain('\\multirow{2}');
  expect(tex).toContain('Medida \\& unidad');expect(tex).toContain('50\\%');expect(tex).toMatch(/\n & B \\\\/);expect(tex).toContain('\\end{longtable}');
 });
 it('adds unnumbered sections to the exported index and validates settings',()=>{
  const tex=exportLatex('Datos',{type:'doc',content:[{type:'heading',attrs:{level:2},content:[text('Resumen')]}]});
  expect(tex).toContain('\\section*{Resumen}');expect(tex).toContain('\\addcontentsline{toc}{section}{Resumen}');
  expect(resolveFormat({margin:999 as 3,pageSize:'invalid' as 'A4'})).toMatchObject({margin:2.5,pageSize:'A4'});
 });
});
describe('literal search in editable prose',()=>{
 const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'inline*',group:'block'},text:{group:'inline'},inlineMath:{group:'inline',inline:true,atom:true,attrs:{latex:{default:''}}}},marks:{bold:{}}});
 it('finds across text marks without searching equations or crossing atom boundaries',()=>{
  const doc=schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[text('Alpha '),{...text('beta'),marks:[{type:'bold'}]},{type:'inlineMath',attrs:{latex:'Alpha beta'}},text('alpha beta')]}]});
  expect(findText(doc,'alpha beta')).toEqual([{from:1,to:11},{from:12,to:22}]);
  expect(findText(doc,'Alpha beta',true)).toHaveLength(1);expect(findText(doc,'betaalpha')).toHaveLength(0);
 });
 it('treats special characters literally rather than interpreting regular expressions',()=>{
  const doc=schema.nodeFromJSON({type:'doc',content:[p('a.b aXb [x] $5')]});
  expect(findText(doc,'a.b')).toHaveLength(1);expect(findText(doc,'[x]')).toHaveLength(1);expect(findText(doc,'$5')).toHaveLength(1);
 });
});
describe('editable backup',()=>{
 it('round trips document structure and preferences without importing an identity',()=>{
  const template=createTemplate('thesis');const raw=makeBackup({...template,id:'original',updated:1,references:[]});const restored=readBackup(raw);
  expect(restored.content).toEqual(template.content);expect(restored.format).toEqual(template.format);expect(restored).not.toHaveProperty('id');
 });
 it('rejects arbitrary JSON, unsupported versions and unsafe links',()=>{
  expect(()=>readBackup('{}')).toThrow('compatible');expect(()=>readBackup('{')).toThrow('leer');
  const raw=makeBackup({id:'x',updated:1,title:'X',content:{type:'doc',content:[{type:'paragraph',content:[{...text('Open'),marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]}});
  expect(()=>readBackup(raw)).toThrow('enlace');expect(()=>readBackup(raw.replace('"version": 1','"version": 99'))).toThrow('compatible');
  const malformed = makeBackup({id:'x',updated:1,title:'X',content:{type:'doc',content:[{type:'paragraph',attrs:{textAlign:'left; background: red'},content:[text('x')]}]}});expect(()=>readBackup(malformed)).toThrow('alineación');
 });
});
