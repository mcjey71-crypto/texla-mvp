import {test,expect} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';

// Synthetic Word structure reproduces narrow mathematical headers and a
// bibliography whose hyperlink character style differs from its body runs.
function fixture(){
 const run=(text:string)=>`<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>${text}</w:t></w:r>`;
 const para=(body:string,style='Compact')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/><w:jc w:val="center"/></w:pPr>${body}</w:p>`;
 const math='<m:oMath><m:sSub><m:e><m:r><m:t>log</m:t></m:r></m:e><m:sub><m:r><m:t>2</m:t></m:r></m:sub></m:sSub><m:r><m:t>FC</m:t></m:r></m:oMath>';
 const cell=(body:string)=>`<w:tc>${para(body)}</w:tc>`;
 const link='<w:hyperlink r:id="doi"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>10.1234/example</w:t></w:r></w:hyperlink>';
 return Buffer.from(zipSync({
  'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
  <w:tbl><w:tblGrid>${[1116,909,1504,1460,3183].map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
  <w:tr><w:trPr><w:tblHeader/></w:trPr>${cell(run('Variable'))}${cell(`<m:oMathPara>${math}</m:oMathPara>`)}${cell(run('p ajustada'))}${cell(run('Dirección'))}${cell(run('Función'))}</w:tr>
  <w:tr>${cell(run('Marcador A'))}${cell(run('10.42'))}${cell('<m:oMath><m:r><m:t>3.5×</m:t></m:r><m:sSup><m:e><m:r><m:t>10&#x200b;</m:t></m:r></m:e><m:sup><m:r><m:t>-44</m:t></m:r></m:sup></m:sSup></m:oMath>')}${cell(run('Aumento'))}${cell(run('Descripción de la función'))}</w:tr></w:tbl>
  ${para(run('Referencia de ejemplo. doi: ')+link,'BibliographyChild')}
  ${para(run('Enlace con estilo independiente: ')+link,'Normal')}
  ${para(`<m:oMathPara>${math}</m:oMathPara>`)}
  <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>`),
  'word/styles.xml':strToU8(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Compact"><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="36" w:after="36"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Bibliography"><w:name w:val="Bibliography"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="BibliographyChild"><w:basedOn w:val="Bibliography"/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="28"/><w:color w:val="156082"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`),
  'word/_rels/document.xml.rels':strToU8('<Relationships><Relationship Id="doi" Target="https://doi.org/10.1234/example" TargetMode="External"/></Relationships>'),
 }));
}
test('Word table formulas fit their cells and bibliography links use the reference typography',async({page})=>{
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Tabla y referencias.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fixture()});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 const table=page.locator('.tiptap table');await expect(table.locator('tr')).toHaveCount(2);await expect(table.locator('th')).toHaveCount(5);
 const header=table.locator('th').nth(1);await expect(header.locator('[data-type="inline-math"]')).toHaveAttribute('data-latex',/log.*2.*FC/);
 await expect(table.locator('[data-type="block-math"]')).toHaveCount(0);
 await expect(page.locator('.tiptap>[data-type="block-math"]')).toHaveCount(1);
 await page.evaluate(()=>document.fonts.ready);
 const box=await header.boundingBox(), formula=await header.locator('.katex-html').boundingBox();
 expect(formula!.width).toBeGreaterThan(20);expect(formula!.width).toBeLessThan(box!.width);expect(box!.height).toBeLessThan(45);
 const reference=page.locator('.tiptap p').filter({hasText:'Referencia de ejemplo.'});const link=reference.locator('a');
 await expect(link).toHaveAttribute('href','https://doi.org/10.1234/example');
 const typography=await reference.evaluate(el=>{const texts=[...el.querySelectorAll('span[style]')].filter(e=>e.textContent?.includes('Referencia de ejemplo')||e.textContent==='10.1234/example');return texts.map(e=>({size:getComputedStyle(e).fontSize,font:getComputedStyle(e).fontFamily}));});
 expect(typography).toHaveLength(2);expect(typography[1]).toEqual(typography[0]);expect(typography[1].size).toBe('13.3333px');
 await expect(page.locator('.tiptap p').filter({hasText:'Enlace con estilo independiente:'}).locator('a span')).toHaveCSS('font-size','18.6667px');
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();const tex=await page.locator('.latex-panel pre').innerText();
 const tableTex=tex.split('\\begin{longtable}')[1].split('\\end{longtable}')[0];expect(tableTex).toContain('\\fontsize{10}');expect(tableTex).not.toContain('\\begin{equation}');expect(tableTex).not.toContain('\u200b');expect(tableTex).toContain('^{');
 await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Tabla y referencias Guardado en este dispositivo'}).click();
 await expect(header.locator('[data-type="inline-math"]')).toBeVisible();await expect(reference.locator('a span')).toHaveCSS('font-size','13.3333px');
 await page.emulateMedia({media:'print'});await expect(reference.locator('a span')).toHaveCSS('font-size','13.3333px');
});
