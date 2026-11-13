import {test,expect} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
import {readFileSync} from 'node:fs';
const png='iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAIElEQVR4nGP0SHJmoCVgoqnpoxaMWjBqwagFoxZQCQAAAmUBDf3J3P4AAAAASUVORK5CYII=';
function fixture(){
 const p=(text:string)=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
 const section=(columns:number)=>`<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1134" w:right="1134" w:top="1020" w:bottom="1020"/><w:cols w:num="${columns}" w:space="454"/></w:sectPr>`;
 const end=(columns:number)=>`<w:p><w:pPr>${section(columns)}</w:pPr></w:p>`;
 const picture=(floating=false)=>`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:${floating?'anchor':'inline'}>${floating?'<wp:positionH relativeFrom="margin"><wp:posOffset>5220000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:wrapNone/>':''}<wp:extent cx="${floating?752475:5200000}" cy="${floating?376237:2600000}"/><wp:docPr descr="${floating?'Logo institucional':'Gráfico ancho'}"/><a:blip r:embed="image"/></wp:${floating?'anchor':'inline'}></w:drawing></w:r></w:p>`;
 return Buffer.from(zipSync({
  'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${p('Universidad de ejemplo')}${picture(true)}${p('Título del artículo')}${p('Resumen a todo el ancho')}${end(1)}${p('Introducción en la primera columna. '+ 'Texto editable de investigación. '.repeat(10))}<w:p><w:r><w:br w:type="column"/></w:r></w:p>${p('Métodos en la segunda columna. '+ 'Procedimiento y resultados. '.repeat(10))}${end(2)}${picture()}<w:tbl><w:tr><w:tc>${p('Tabla a todo el ancho')}</w:tc><w:tc>${p('Resultado')}</w:tc></w:tr></w:tbl>${section(1)}</w:body></w:document>`),
  'word/_rels/document.xml.rels':strToU8('<Relationships><Relationship Id="image" Target="media/example.png"/></Relationships>'),
  'word/media/example.png':new Uint8Array(Buffer.from(png,'base64')),
 }));
}
test('Word sections keep two-column text, full-width blocks and original logo coordinates through editing and backups',async({page,browser})=>{
 await page.setViewportSize({width:1600,height:1100});await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Artículo en columnas.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fixture()});await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 const sections=page.locator('.document-section');await expect(sections).toHaveCount(3);expect(await sections.evaluateAll(els=>els.map(e=>getComputedStyle(e).columnCount))).toEqual(['1','2','1']);
 const checkLogo=async()=>{const b=await sections.first().evaluate(el=>{const s=el.getBoundingClientRect(),f=el.querySelector('.texla-figure')!.getBoundingClientRect();return {top:f.top-s.top,left:(f.left-s.left)/s.width,width:f.width/s.width};});expect(Math.abs(b.top)).toBeLessThan(1);expect(b.left).toBeCloseTo(.852923,3);expect(b.width).toBeCloseTo(.12295,3);};await checkLogo();
 const left=sections.nth(1).locator('p').filter({hasText:'Introducción en la primera columna'}),right=sections.nth(1).locator('p').filter({hasText:'Métodos en la segunda columna'});
 const lb=await left.boundingBox(),rb=await right.boundingBox();expect(rb!.x-lb!.x).toBeGreaterThan(lb!.width);expect(Math.abs(lb!.y-rb!.y)).toBeLessThan(40);
 await expect(sections.nth(1).locator('table,.texla-figure')).toHaveCount(0);await expect(sections.nth(2).locator('table')).toHaveCount(1);await expect(sections.nth(2).locator('.texla-figure')).toHaveCount(1);
 await left.click();await page.keyboard.press('End');await page.keyboard.type(' Revision compartible.');await expect(left).toContainText('Revision compartible.');
 await page.waitForTimeout(700);await page.reload();await page.getByRole('button',{name:'Artículo en columnas Guardado en este dispositivo',exact:true}).click();await checkLogo();await expect(left).toContainText('Revision compartible.');
 await page.emulateMedia({media:'print'});await checkLogo();await expect(sections.nth(1)).toHaveCSS('column-count','2');await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();const tex=await page.locator('.latex-panel pre').innerText();expect(tex).toContain('\\begin{multicols}{2}');expect(tex).toContain('\\columnbreak');expect(tex).toContain('\\AddToShipoutPictureFG*');expect(tex.indexOf('\\end{multicols}')).toBeLessThan(tex.indexOf('\\begin{longtable}'));expect(tex.match(/\\includegraphics/g)).toHaveLength(2);
 await page.getByRole('button',{name:'Exportar',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Copia editable de Texla'}).click();const backup=readFileSync((await(await pending).path())!);
 const secondContext=await browser.newContext();try{const second=await secondContext.newPage();await second.goto('/');await second.getByRole('button',{name:'Copias editables'}).click();await second.getByLabel('Abrir copia de Texla').setInputFiles({name:'columnas.texla.json',mimeType:'application/json',buffer:backup});await expect(second.locator('.document-section[data-columns="2"]')).toHaveCount(1);await expect(second.locator('.texla-figure[data-positioned="true"]')).toHaveCount(1);await expect(second.locator('.tiptap')).toContainText('Revision compartible.');}finally{await secondContext.close();}
});
