import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function blank(page:import('@playwright/test').Page,title:string) {
 await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill(title);await page.getByRole('button',{name:'Crear documento'}).click();await page.locator('.tiptap p').last().click();
}
test('thesis headings, contents and format update, persist and export together',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Plantillas'}).click();await page.getByRole('button',{name:/^Tesis Resumen/}).click();
 const sections=page.locator('.tiptap h2[data-section-number]');await expect(sections.first()).toHaveAttribute('data-section-number','1');
 await expect(page.locator('.document-contents a').first()).toContainText('Resumen');
 await sections.first().click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.keyboard.type('Resumen actualizado');
 await expect(page.locator('.document-contents a').first()).toContainText('Resumen actualizado');
 await page.waitForTimeout(600);
 await page.locator('.tiptap').evaluate(el=>{const editor=(el as HTMLElement & {editor:import('@tiptap/core').Editor}).editor;let range:{from:number;to:number}|undefined;editor.state.doc.descendants((node,pos)=>{if(!range&&node.type.name==='heading'&&node.attrs.level===2)range={from:pos,to:pos+node.nodeSize};});editor.commands.deleteRange(range!);});
 await expect(sections.first()).toHaveText('Planteamiento del problema');await expect(sections.first()).toHaveAttribute('data-section-number','1');await expect(page.locator('.document-contents')).not.toContainText('Resumen actualizado');
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.document-contents a').first()).toContainText('Resumen actualizado');
 await sections.nth(2).click();await page.getByLabel('Estilo de párrafo').selectOption('3');await expect(page.locator('.tiptap h3')).toHaveAttribute('data-section-number','2.1');await expect(page.locator('.document-contents .contents-child')).toContainText('Objetivos');
 await page.getByRole('button',{name:'Índice automático',exact:true}).click();await expect(page.locator('.document-contents')).toHaveCount(1);
 await page.getByRole('button',{name:'Formato del documento',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Tamaño de página').selectOption('Carta');await page.getByRole('dialog').getByLabel('Márgenes').selectOption('3');await page.getByRole('dialog').getByLabel('Interlineado').selectOption('2');await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Mi tesis Guardado en este dispositivo'}).click();await expect(page.locator('.paper')).toHaveClass(/letter/);
 await page.getByRole('button',{name:'LaTeX AUTO'}).click();const tex=page.locator('.latex-panel pre');await expect(tex).toContainText('\\documentclass[12pt,letterpaper]');await expect(tex).toContainText('margin=3cm');await expect(tex).toContainText('\\setstretch{2}');await expect(tex).toContainText('\\section{Resumen actualizado}');await expect(tex).toContainText('\\tableofcontents');
 await page.getByRole('button',{name:'Editor visual',exact:true}).click();await page.emulateMedia({media:'print'});expect(await page.locator('.page-break').first().evaluate(el=>getComputedStyle(el).breakAfter)).toBe('page');expect(await page.locator('.document-tools').evaluate(el=>getComputedStyle(el).display)).toBe('none');expect(errors).toEqual([]);
});
test('visual tables support editing rows and columns, undo and LaTeX',async({page})=>{
 await blank(page,'Tabla de resultados');await page.getByRole('button',{name:'Tabla',exact:true}).click();await page.getByLabel('Filas',{exact:true}).selectOption('2');await page.getByLabel('Columnas',{exact:true}).selectOption('2');await page.getByRole('button',{name:'Insertar tabla',exact:true}).click();
 const table=page.locator('.tiptap table');await expect(table.locator('tr')).toHaveCount(2);await table.locator('th').first().click();await page.keyboard.type('Medida & unidad');await page.keyboard.press('Tab');await page.keyboard.type('Resultado');await page.keyboard.press('Tab');await page.keyboard.type('Eficiencia');await page.keyboard.press('Tab');await page.keyboard.type('50%');
 await page.getByRole('button',{name:'Añadir fila',exact:true}).click();await expect(table.locator('tr')).toHaveCount(3);await page.getByRole('button',{name:'Añadir columna',exact:true}).click();await expect(table.locator('tr').first().locator('th,td')).toHaveCount(3);
 await page.waitForTimeout(600);await page.getByRole('button',{name:'Eliminar columna',exact:true}).click();await expect(table.locator('tr').first().locator('th,td')).toHaveCount(2);await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(table.locator('tr').first().locator('th,td')).toHaveCount(3);
 await page.getByRole('button',{name:'LaTeX AUTO'}).click();await expect(page.locator('.latex-panel pre')).toContainText('\\begin{longtable}{*{3}');await expect(page.locator('.latex-panel pre')).toContainText('Medida \\& unidad');await expect(page.locator('.latex-panel pre')).toContainText('50\\%');
});
test('search replaces prose in one undo operation and leaves equations untouched',async({page})=>{
 await blank(page,'Búsqueda');await page.locator('.tiptap').evaluate(el=>{
  const editor=(el as HTMLElement & {editor:import('@tiptap/core').Editor}).editor;
  editor.commands.insertContent([{type:'paragraph',content:[{type:'text',text:'Alpha beta, alpha.'},{type:'inlineMath',attrs:{latex:'alpha'}}]}]);
 });
 await page.getByRole('button',{name:'Buscar y reemplazar',exact:true}).click();await page.getByLabel('Buscar en el texto',{exact:true}).fill('alpha');await expect(page.locator('.search-match')).toHaveCount(2);
 await page.getByRole('button',{name:'Coincidencia siguiente'}).click();await expect(page.locator('.current-match')).toHaveCount(1);await page.getByLabel('Reemplazar por',{exact:true}).fill('Gamma');await page.waitForTimeout(600);await page.getByRole('button',{name:'Reemplazar todo',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('Gamma beta, Gamma.');await expect(page.locator('[data-type="inline-math"]')).toHaveAttribute('data-latex','alpha');await expect(page.locator('.search-match')).toHaveCount(0);
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.search-match')).toHaveCount(2);await page.getByRole('button',{name:'Cerrar búsqueda'}).click();await expect(page.locator('.search-match')).toHaveCount(0);
});
test('editable backup restores a new document and rejects invalid files without replacing work',async({page})=>{
 await blank(page,'Copia de prueba');await page.keyboard.type('Contenido conservado');
 await page.locator('.tiptap').evaluate(el=>{const editor=(el as HTMLElement & {editor:import('@tiptap/core').Editor}).editor;editor.commands.insertContent([{type:'blockMath',attrs:{latex:'E=mc^2'}},{type:'paragraph',content:[{type:'citation',attrs:{reference:{id:'doi:10.1038/nphys1170',url:'https://doi.org/10.1038/nphys1170',title:'Measured measurement',authors:'Aspelmeyer, Markus',year:'2009'}}}]}]);editor.commands.insertTable({rows:2,cols:2,withHeaderRow:true});});
 await page.getByRole('button',{name:'Referencias',exact:true}).click();await page.getByRole('combobox',{name:'Estilo bibliográfico'}).selectOption('apa');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Copias editables'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar copia editable'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('Copia de prueba.texla.json');const data=readFileSync((await download.path())!);
 await page.getByLabel('Abrir copia de Texla').setInputFiles({name:'incorrecta.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.getByRole('alert')).toContainText('compatible');await expect(page.getByRole('textbox',{name:'Nombre del documento'})).toHaveValue('Copia de prueba');
 await page.getByLabel('Abrir copia de Texla').setInputFiles({name:'copia.texla.json',mimeType:'application/json',buffer:data});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.tiptap')).toContainText('Contenido conservado');await expect(page.getByRole('button',{name:'Copia de prueba Guardado en este dispositivo'})).toHaveCount(2);await expect(page.locator('.tiptap table')).toHaveCount(1);await expect(page.locator('.tiptap [data-type=\"block-math\"]')).toHaveAttribute('data-latex','E=mc^2');await expect(page.locator('.tiptap .citation')).toHaveAttribute('data-citation-label','(Aspelmeyer, 2009)');await expect(page.locator('.bibliography')).toContainText('Measured measurement');
});
test('formal controls remain reachable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Formato del documento',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('Tamaño de página')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.getByRole('button',{name:'Listo',exact:true}).click();await page.getByRole('button',{name:'Tabla',exact:true}).click();await expect(page.getByLabel('Columnas',{exact:true})).toBeVisible();
});
