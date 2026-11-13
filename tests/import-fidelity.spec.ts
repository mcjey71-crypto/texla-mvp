import {test,expect} from '@playwright/test';
import {zipSync,strToU8,unzipSync,strFromU8} from 'fflate';
import {readFileSync} from 'node:fs';
const png='iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAIElEQVR4nGP0SHJmoCVgoqnpoxaMWjBqwagFoxZQCQAAAmUBDf3J3P4AAAAASUVORK5CYII=';
function word(){
 const xml=(body:string)=>`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1440" w:right="1440"/><w:headerReference r:id="header"/></w:sectPr></w:body></w:document>`;
 const p=(text:string)=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
 const drawing='<w:r><w:drawing><wp:inline><wp:extent cx="1270000" cy="635000"/><a:blip r:embed="picture"/></wp:inline></w:drawing></w:r>';
 const files:Record<string,Uint8Array>={
  'word/document.xml':strToU8(xml(`<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:t>Título con estilo heredado</w:t></w:r></w:p>
  <w:p><w:pPr><w:spacing w:before="120" w:after="80" w:line="276"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:i/><w:rFonts w:ascii="Calibri"/><w:sz w:val="19"/><w:color w:val="112233"/><w:highlight w:val="yellow"/></w:rPr><w:t>Resaltado</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r></w:p>
  <w:tbl><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="2000"/></w:tblGrid>
   <w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:shd w:fill="DDEEFF"/></w:tcPr>${p('Resultados')}</w:tc></w:tr>
   <w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr>${p('Grupo A')}</w:tc><w:tc>${p('Valor 1')}</w:tc></w:tr>
   <w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr>${p('')}</w:tc><w:tc>${p('Valor 2')}</w:tc></w:tr>
  </w:tbl><w:p>${drawing}</w:p>`)),
  'word/styles.xml':strToU8('<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:basedOn w:val="Normal"/><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>'),
  'word/header1.xml':strToU8(`<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:p>${drawing}</w:p>${p('Encabezado del proyecto')}</w:hdr>`),
  'word/_rels/document.xml.rels':strToU8('<Relationships><Relationship Id="picture" Target="media/image.png"/><Relationship Id="header" Target="header1.xml"/></Relationships>'),
  'word/_rels/header1.xml.rels':strToU8('<Relationships><Relationship Id="picture" Target="media/image.png"/></Relationships>'),
  'word/media/image.png':new Uint8Array(Buffer.from(png,'base64')),
 };return Buffer.from(zipSync(files));
}
test('Word retains inherited typography, highlights, superscripts, merged tables, images and header through export and reload',async({page})=>{
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Estilos.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:word()});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 await expect(page.locator('.tiptap h1')).toContainText('Título con estilo heredado');
 await expect(page.locator('.imported-header')).toContainText('Encabezado del proyecto');
 await expect(page.locator('.texla-figure img')).toHaveCount(2);
 await expect.poll(()=>page.locator('.texla-figure img').evaluateAll(images=>images.every(el=>(el as HTMLImageElement).naturalWidth>0))).toBe(true);
 const highlight=page.locator('.tiptap span[style*="background-color"]');await expect(highlight).toHaveCSS('background-color','rgb(255, 255, 0)');await expect(highlight).toHaveCSS('color','rgb(17, 34, 51)');await expect(highlight).toHaveCSS('font-size','12.6667px');
 await expect(page.locator('.tiptap span[style*="vertical-align"]')).toHaveText('2');
 await expect(page.locator('.tiptap td[rowspan="2"]')).toContainText('Grupo A');await expect(page.locator('.tiptap th[colspan="2"]')).toContainText('Resultados');
 const widths=await page.locator('.tiptap td').first().evaluate(el=>el.getAttribute('colwidth'));expect(Number(widths)).toBeGreaterThan(200);
 await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Estilos Guardado en este dispositivo'}).click();await expect(page.locator('.texla-figure img')).toHaveCount(2);await expect(page.locator('.tiptap span[style*="vertical-align"]')).toHaveText('2');
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();const tex=await page.locator('.latex-panel pre').innerText();expect(tex).toContain('\\textsuperscript');expect(tex).toContain('\\colorbox[HTML]{FFFF00}');expect(tex).toContain('\\cellcolor[HTML]{DDEEFF}');expect(tex).toContain('\\multirow{2}');expect(tex).toContain('\\fancyhead[L]');expect(tex).toContain('\\fontsize{9.5}');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar .zip',exact:true}).click();const file=await download;const files=unzipSync(new Uint8Array(readFileSync((await file.path())!)));expect(Object.keys(files).filter(name=>name.startsWith('imagenes/'))).toHaveLength(1);expect(Object.values(files).map(strFromU8).some(text=>text.includes('\\begin{document}'))).toBe(true);
 await page.getByRole('button',{name:'Editor visual',exact:true}).click();
 await page.getByLabel('Tipografía',{exact:true}).selectOption('Times New Roman');
 await expect(highlight).toHaveCSS('font-family', /Times New Roman/);
 await page.getByRole('button',{name:'Formato del documento',exact:true}).click();
 await page.getByRole('dialog').getByLabel(/^Tamaño del texto/).selectOption('12');
 await page.getByRole('dialog').getByLabel('Interlineado').selectOption('2');
 await page.getByRole('button',{name:'Listo',exact:true}).click();
 await expect(highlight).toHaveCSS('font-size','15.2px');
 await expect(highlight).toHaveCSS('background-color','rgb(255, 255, 0)');
 await expect(highlight.locator('xpath=ancestor::p')).toHaveCSS('line-height','32px');

});

for(const [kind,header] of [
 ['empty part',''],
 ['empty paragraph','<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p>'],
 ['whitespace','<w:p><w:r><w:t xml:space="preserve">   </w:t><w:tab/></w:r></w:p>'],
])test(`Word with a blank header (${kind}) imports without creating an invalid header`,async({page})=>{
 const files=unzipSync(word());
 files['word/header1.xml']=strToU8(`<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${header}</w:hdr>`);
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Encabezado vacío.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync(files))});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();
 await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 await expect(page.locator('.imported-header')).toHaveCount(0);
 await expect(page.locator('.tiptap h1')).toContainText('Título con estilo heredado');
 await expect(page.locator('.tiptap td[rowspan="2"]')).toContainText('Grupo A');
 await expect(page.locator('.texla-figure img')).toHaveCount(1);
 await page.waitForTimeout(600);await page.reload();
 await page.getByRole('button',{name:'Encabezado vacío Guardado en este dispositivo',exact:true}).click();
 await expect(page.locator('.imported-header')).toHaveCount(0);
 await expect(page.locator('.tiptap th[colspan="2"]')).toContainText('Resultados');
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();
 await expect(page.locator('.latex-panel pre')).toContainText('\\begin{longtable}');
 await expect(page.locator('.latex-panel pre')).not.toContainText('\\fancyhead[L]');
});

test('Word header content inside tables or equations is not mistaken for a blank header',async({page})=>{
 const files=unzipSync(word());
 files['word/header1.xml']=strToU8('<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Encabezado en tabla</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><m:oMath><m:r><m:t>x=2</m:t></m:r></m:oMath></w:p></w:hdr>');
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Encabezado complejo.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync(files))});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();
 await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 await expect(page.locator('.tiptap table')).toHaveCount(2);
 await expect(page.locator('.tiptap table').first()).toContainText('Encabezado en tabla');
 await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveAttribute('data-latex','x=2');
});

test('HTML typography and superscripts survive without accepting arbitrary font or CSS URLs',async({page})=>{
 const external:string[]=[];page.on('request',r=>{if(r.url().includes('evil.example'))external.push(r.url());});
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'format.html',mimeType:'text/html',buffer:Buffer.from('<p><span style="font-family:Arial;font-size:14pt;color:#123456;background-color:#ffff00">Texto</span> m<sup>2</sup><span style="font-family:evil;background:url(https://evil.example/track)">Seguro</span></p>')});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 await expect(page.locator('.tiptap span[style*="font-size: 14pt"]')).toHaveText('Texto');await expect(page.locator('.tiptap span[style*="vertical-align"]')).toHaveText('2');expect(external).toEqual([]);expect(await page.locator('.tiptap').innerHTML()).not.toContain('evil.example');
});

test('tagged PDF retains editable table cells across pages, typography and an embedded image',async({page})=>{
 await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles('tests/fixtures/import/tagged-tables.pdf');
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();
 await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 await expect(page.locator('.tiptap h1 strong')).toHaveText('RESULTADOS DEL PROYECTO');
 await expect(page.locator('.tiptap table')).toHaveCount(1);
 await expect(page.locator('.tiptap tr')).toHaveCount(3);
 await expect(page.locator('.tiptap td,.tiptap th')).toHaveText(['Variable','Resultado','Masa','12 gramos','Tiempo','30 segundos']);
 await expect(page.locator('.texla-figure img')).toHaveCount(1);
 await expect.poll(()=>page.locator('.texla-figure img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(page.locator('.tiptap')).not.toContainText('no se recuperó texto');
 await page.locator('.tiptap td').first().click();await page.keyboard.press('End');await page.keyboard.type(' editable');
 await expect(page.locator('.tiptap td').first()).toContainText('Masa editable');
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();
 const tex=await page.locator('.latex-panel pre').innerText();expect(tex).toContain('\\begin{longtable}');expect(tex).toContain('\\includegraphics');expect(tex).toContain('Masa editable');
});
