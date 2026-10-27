import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtures='tests/fixtures/import/';
async function openImport(page: Page) { await page.goto('/'); await page.locator('.document-tools').getByRole('button',{name:'Importar documento',exact:true}).click(); }
async function convert(page: Page, name: string, content?: string) {
  await page.getByLabel('Archivo para importar').setInputFiles(content === undefined ? fixtures+name : {name,mimeType:'application/octet-stream',buffer:Buffer.from(content)});
  await page.getByRole('button',{name:'Convertir documento',exact:true}).click();
}
async function create(page: Page) { await expect(page.getByText('Conversión preparada', {exact:true})).toBeVisible(); await page.getByRole('button',{name:'Crear documento editable'}).click(); }
test('Markdown imports formatting, tables and editable math, preserves existing documents and exports LaTeX', async ({page}) => {
  await openImport(page);
  await convert(page,'tesis.md','# Mi investigación\n\nUn **resultado** con $x_i^2$.\n\n$$\\frac{a}{b}$$\n\n| Variable | Valor |\n|---|---|\n| Masa | 12 |');
  await create(page); await expect(page.locator('.tiptap h1')).toHaveText('Mi investigación');
  await expect(page.locator('.tiptap strong')).toContainText('resultado'); await expect(page.locator('.tiptap table')).toContainText('Masa');
  await expect(page.locator('.tiptap [data-type="block-math"]')).toHaveCount(1); await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveCount(1);
  await expect(page.locator('.document-list')).toContainText('El lenguaje del universo');
  await page.getByRole('button',{name:'LaTeX AUTO'}).click(); await expect(page.locator('.latex-panel pre')).toContainText('\\frac{a}{b}'); await expect(page.locator('.latex-panel pre')).toContainText('\\textbf{resultado}');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar .tex'}).click();const file=await downloaded;expect(readFileSync((await file.path())!,'utf8')).toContain('\\begin{document}');
});
test('DOCX converts headings, tables and native Word fractions',async({page})=>{
 await openImport(page);await convert(page,'research.docx');await create(page);
 await expect(page.locator('.tiptap h1')).toContainText('Investigación de prueba');await expect(page.locator('.tiptap table')).toContainText('Masa');await expect(page.locator('.tiptap [data-type="block-math"]')).toHaveCount(1);
 await page.getByRole('button',{name:'LaTeX AUTO'}).click();await expect(page.locator('.latex-panel pre')).toContainText('\\frac{a}{b}');
});
test('PDF text becomes editable paragraphs with page boundaries',async({page})=>{
 await openImport(page);await convert(page,'research.pdf');await create(page);
 await expect(page.locator('.tiptap')).toContainText('texto seleccionable');await expect(page.locator('.tiptap')).toContainText('Resultados de la segunda pagina');await expect(page.locator('.tiptap .page-break')).toHaveCount(1);
 await page.locator('.tiptap p').first().click();await page.keyboard.press('End');await page.keyboard.type(' EDITADO');await expect(page.locator('.tiptap')).toContainText('EDITADO');
});
test('scanned PDF explains OCR and converts with self-hosted recognition assets',async({page})=>{
 test.setTimeout(120000);const external:string[]=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:5173')&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
 await openImport(page);await convert(page,'scanned.pdf');await expect(page.getByRole('alert')).toContainText('parece escaneado');
 await page.getByLabel('Reconocer páginas escaneadas (OCR)').check();await page.getByRole('button',{name:'Convertir documento',exact:true}).click();
 await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible({timeout:90000});await expect(page.locator('.import-preview')).toContainText('ciencia');await create(page);await expect(page.locator('.tiptap')).toContainText('evidencia');
 expect(external).toEqual([]);
});
test('HTML strips executable content and remote images while keeping safe formatting',async({page})=>{
 await openImport(page);await convert(page,'safe.html','<h1>Importación segura</h1><script>window.injected=true</script><p onclick="window.injected=true">Texto <strong>con formato</strong><a href="javascript:alert(1)">enlace</a><img src="https://example.com/tracker.png" onerror="window.injected=true" alt="Figura 1"></p>');
 await create(page);expect(await page.evaluate(()=>Reflect.get(window,'injected'))).toBeUndefined();await expect(page.locator('.tiptap')).toContainText('[Imagen: Figura 1]');await expect(page.locator('.tiptap img')).toHaveCount(0);await expect(page.locator('.tiptap a[href^="javascript"]')).toHaveCount(0);
});
test('ODT, plain text and LaTeX can each be opened as separate editable documents',async({page})=>{
 await openImport(page);await convert(page,'research.odt');await create(page);await expect(page.locator('.tiptap')).toContainText('Contenido de OpenDocument');
 await page.locator('.document-tools').getByRole('button',{name:'Importar documento'}).click();await convert(page,'notas.txt','Notas del estudio\n\nUna ecuación \\(a+b\\).');await create(page);await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveCount(1);
 await page.locator('.document-tools').getByRole('button',{name:'Importar documento'}).click();await convert(page,'articulo.tex',String.raw`\documentclass{article}\title{Mi artículo}\begin{document}\maketitle\section{Resultados}Un \textbf{avance}.\begin{equation}x^2+y^2=z^2\end{equation}\end{document}`);await create(page);await expect(page.locator('.tiptap h2')).toHaveText('Resultados');await expect(page.getByLabel('Nombre del documento',{exact:true})).toHaveValue('Mi artículo');
});
test('invalid and protected files report errors without replacing the current document',async({page})=>{
 await openImport(page);await convert(page,'protected.pdf');await expect(page.getByRole('alert')).toContainText('contraseña');
 await convert(page,'bad.pdf','not a pdf');await expect(page.getByRole('alert')).toContainText('PDF');
 await convert(page,'too-many-pages.pdf');await expect(page.getByRole('alert')).toContainText('100 páginas');
 await convert(page,'old.doc','old');await expect(page.getByRole('alert')).toContainText('.docx');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.getByLabel('Nombre del documento',{exact:true})).toHaveValue('El lenguaje del universo');
});
test('import review fits a phone and closing conversion does not create a document',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openImport(page);await convert(page,'mobile.md','# Documento móvil\n\nUn texto para revisar.');await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible();
 expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'/tmp/texla-import-mobile.png',fullPage:true});await page.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.getByLabel('Nombre del documento',{exact:true})).toHaveValue('El lenguaje del universo');
});
