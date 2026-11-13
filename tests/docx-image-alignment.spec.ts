import {test,expect} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
const png='iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAIElEQVR4nGP0SHJmoCVgoqnpoxaMWjBqwagFoxZQCQAAAmUBDf3J3P4AAAAASUVORK5CYII=';
function word(){
 const cases=[
  {paragraph:'left',expected:'left'},
  {paragraph:'center',expected:'center'},
  {paragraph:'right',expected:'right'},
  {paragraph:'center',expected:'right',position:'<wp:positionH relativeFrom="margin"><wp:align>right</wp:align></wp:positionH>'},
  {paragraph:'center',expected:'right',position:'<wp:positionH relativeFrom="margin"><wp:posOffset>5220000</wp:posOffset></wp:positionH>'},
  {paragraph:'center',expected:'right',position:'<wp:positionH relativeFrom="page"><wp:posOffset>5940090</wp:posOffset></wp:positionH>'},
  {paragraph:'center',expected:'left',position:'<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'},
  {paragraph:'right',expected:'center',position:'<wp:positionH relativeFrom="margin"><wp:align>center</wp:align></wp:positionH>'},
 ];
 const body=cases.map((c,i)=>`<w:p><w:pPr><w:pStyle w:val="${c.paragraph}"/></w:pPr><w:r><w:drawing><wp:${c.position?'anchor':'inline'}>${c.position||''}<wp:extent cx="752475" cy="376237"/><wp:docPr id="${i+1}" descr="Imagen ${i+1}"/><a:blip r:embed="picture"/></wp:${c.position?'anchor':'inline'}></w:drawing></w:r></w:p>`).join('');
 return {expected:cases.map(c=>c.expected),buffer:Buffer.from(zipSync({
  'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1134" w:right="1134"/></w:sectPr></w:body></w:document>`),
  'word/styles.xml':strToU8(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${['left','center','right'].map(align=>`<w:style w:type="paragraph" w:styleId="${align}"><w:pPr><w:jc w:val="${align}"/></w:pPr></w:style>`).join('')}</w:styles>`),
  'word/_rels/document.xml.rels':strToU8('<Relationships><Relationship Id="picture" Target="media/image.png"/></Relationships>'),
  'word/media/image.png':new Uint8Array(Buffer.from(png,'base64')),
 }))};
}
test('Word image anchors override paragraph alignment and survive reload, print and LaTeX export',async({page})=>{
 const fixture=word();await page.goto('/');await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'Posición de imágenes.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fixture.buffer});
 await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await page.getByRole('button',{name:'Crear documento editable',exact:true}).click();
 const check=async()=>{
  const positions=await page.locator('.tiptap').evaluate(el=>{const editor=(el as any).editor;editor.state.doc.check();return editor.getJSON().content.filter((n:any)=>n.type==='figure').map((n:any)=>n.attrs.align);});expect(positions).toEqual(fixture.expected);
  const boxes=await page.locator('.texla-figure').evaluateAll(figures=>figures.map(f=>{const box=f.getBoundingClientRect(),container=f.parentElement!.getBoundingClientRect();return {left:box.left-container.left,right:container.right-box.right};}));
  boxes.forEach((b,i)=>{if(fixture.expected[i]==='center')expect(Math.abs(b.left-b.right)).toBeLessThan(2);else if(fixture.expected[i]==='right'){expect(Math.abs(b.right)).toBeLessThan(2);expect(b.left).toBeGreaterThan(100);}else expect(Math.abs(b.left)).toBeLessThan(2);});
 };
 await expect(page.locator('.texla-figure img')).toHaveCount(8);await check();
 await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Posición de imágenes Guardado en este dispositivo',exact:true}).click();await check();
 await page.emulateMedia({media:'print'});await check();await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();const tex=await page.locator('.latex-panel pre').innerText();
 expect((tex.match(/\\begingroup\\raggedleft\n\\includegraphics/g)||[]).length).toBe(4);
 expect((tex.match(/\\begingroup\\centering\n\\includegraphics/g)||[]).length).toBe(2);
 expect((tex.match(/\\begingroup\\raggedright\n\\includegraphics/g)||[]).length).toBe(2);
});
