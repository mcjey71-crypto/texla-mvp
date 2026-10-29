import {describe,it,expect} from 'vitest';
import {TEMPLATES,createTemplate,resolveFormat} from './formalDocument';
import {exportLatex,type DocNode} from './document';
import {makeBackup,readBackup} from './backup';
import {fontLatex} from './fonts';
import {formatReferences,referenceGroups} from './citationStyles';
const allText=(node:DocNode):string=>node.text || (node.content||[]).map(allText).join(' ');
describe('formal templates and persistent typography',()=>{
 it('offers distinct presets rather than relabeling one layout',()=>{
  expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);expect(new Set(TEMPLATES.map(t=>t.id)).size).toBe(TEMPLATES.length);
  for(const template of TEMPLATES){const doc=createTemplate(template.id);expect(readBackup(makeBackup({...doc,id:'test',updated:0})).format).toEqual(doc.format);}
  expect(createTemplate('article').format).toMatchObject({fontFamily:'Times New Roman',fontSize:12,margin:2.54,pageSize:'Carta',lineSpacing:2,firstLineIndent:1.27,paragraphSpacing:0,headingStyle:'apa'});
  expect(createTemplate('report').format).toMatchObject({fontFamily:'Arial',lineSpacing:1.15});
 });
 it('follows the supplied UTEC structure, page geometry and IEEE guide',()=>{
  const doc=createTemplate('utec');expect(doc.format).toMatchObject({pageSize:'Carta',fontFamily:'Times New Roman',fontSize:12,margin:3,lineSpacing:1.5,firstLineIndent:1.25,sectionStyle:'chapters',bibliographyGroups:true});expect(doc.citationStyle).toBe('ieee');
  const chapters=doc.content.content!.filter(node=>node.type==='heading'&&node.attrs?.level===2&&node.attrs.numbered!==false);
  expect(chapters).toHaveLength(10);expect(chapters.map(allText)).toEqual(['INTRODUCCIÓN','ESTADO DEL ARTE','MARCO TEÓRICO','MARCO REFERENCIAL (LEGAL, NORMATIVO, GEOGRÁFICO)','MARCO METODOLÓGICO','DISEÑO TECNOLÓGICO','PRUEBAS Y RESULTADOS','ANÁLISIS ECONÓMICO-FINANCIERO','ANÁLISIS DE SEGURIDAD, RIESGOS E IMPACTOS AMBIENTALES','CONCLUSIONES Y RECOMENDACIONES']);
  expect(allText(doc.content)).toContain('150–300 palabras');expect(allText(doc.content)).toContain('4–8 descriptores');expect(allText(doc.content)).toContain('Anexo 8: Proceso iterativo (opcional)');
  const tex=exportLatex(doc.title,doc.content,[],doc.citationStyle,doc.format);expect(tex).toContain('\\documentclass[12pt,letterpaper]');expect(tex).toContain('CAPÍTULO \\Roman{section}');expect(tex).toContain('\\section*{RESUMEN}');expect(tex).toContain('\\setlength{\\parindent}{1.25cm}');
 });
 it('sanitizes font/layout preferences and declares exact-font and pdfLaTeX fallback paths',()=>{
  expect(resolveFormat({fontFamily:'evil\\input' as 'Arial',margin:999 as 3,firstLineIndent:999 as 0})).toMatchObject({fontFamily:'Literata',margin:2.5,firstLineIndent:0});
  expect(fontLatex('Times New Roman')).toContain('\\IfFontExistsTF{Times New Roman}');expect(fontLatex('Times New Roman')).toContain('\\usepackage{mathptmx}');
 });
 it('groups IEEE entries without renumbering citations and exports bibliography before annexes once',()=>{
  const refs=[{id:'https://example.com/one',url:'https://example.com/one',title:'Fuente uno',authors:'García, Ana',year:'2024',group:'complementary' as const},{id:'https://example.com/two',url:'https://example.com/two',title:'Fuente dos',authors:'Pérez, Luis',year:'2025',group:'primary' as const}];
  const doc=createTemplate('utec');doc.content.content!.splice(1,0,{type:'paragraph',content:refs.map(reference=>({type:'citation',attrs:{reference}}))});
  const formatted=formatReferences(refs,'ieee');expect(formatted.citations.get(refs[0].id)).toBe('[1]');expect(referenceGroups(refs,formatted)[0].indices).toEqual([1]);
  const tex=exportLatex(doc.title,doc.content,refs,'ieee',doc.format);expect(tex.match(/\\hypertarget\{ref1\}/g)).toHaveLength(1);expect(tex.indexOf('\\hypertarget{ref1}')).toBeLessThan(tex.indexOf('\\section*{ANEXOS}'));expect(tex).toContain('\\subsection*{Referencias primarias}');expect(tex).toContain('\\subsection*{Referencias complementarias}');
 });
});
