import {describe,it,expect} from 'vitest';
import {PAGE_FORMATS} from './pageFormats';
import {resolveFormat,createTemplate} from './formalDocument';
import {exportLatex} from './document';
import {makeBackup,readBackup} from './backup';
describe('page sizes and continuous documents',()=>{
  it('defaults to A4 and preserves each supported size in backups and export',()=>{
    expect(resolveFormat().pageSize).toBe('A4');
    for(const page of PAGE_FORMATS){
      const doc={...createTemplate('report'),id:'sample',updated:0,format:resolveFormat({pageSize:page.id})};
      expect(readBackup(makeBackup(doc)).format?.pageSize).toBe(page.id);
      const tex=exportLatex(doc.title,doc.content,[],doc.citationStyle,doc.format);
      expect(tex).toContain(`paperwidth=${page.width}mm,paperheight=${page.height}mm`);
      expect(tex).not.toMatch(/documentclass\[[^\]]*a[123]paper/);
    }
  });
  it('exports continuous writing on A4 without explicit page breaks',()=>{
    const content={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Antes'}]},{type:'pageBreak'},{type:'paragraph',content:[{type:'text',text:'Después'}]}]};
    expect(exportLatex('Continuo',content,[],'apa',{pageSize:'Continuo'})).not.toContain('\\clearpage');
    expect(exportLatex('A4',content,[],'apa',{pageSize:'A4'})).toContain('\\clearpage');
  });
  it('creates an editable Harvard-style CV with no fake accomplishments or bibliography',()=>{
    const cv=createTemplate('cv');expect(cv.format).toMatchObject({pageSize:'A4',headingStyle:'cv',lineSpacing:1,pageNumbers:'none',numberedSections:false});
    expect(cv.content.content!.filter(n=>n.type==='heading'&&n.attrs?.level===2).map(n=>n.content?.[0].text)).toEqual(['EDUCACIÓN','EXPERIENCIA','LIDERAZGO Y ACTIVIDADES','HABILIDADES E INTERESES']);
    expect(JSON.stringify(cv.content)).not.toContain('bibliographyAnchor');
    expect(exportLatex(cv.title,cv.content,[],cv.citationStyle,cv.format)).toContain('\\titlerule');
  });
});
