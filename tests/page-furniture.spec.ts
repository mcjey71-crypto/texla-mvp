import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();
  await page.getByPlaceholder('Mi próxima gran idea').fill('Páginas formales');await page.getByRole('button',{name:'Crear documento',exact:true}).click();
  await page.locator('.tiptap').evaluate(el => {
    const editor=(el as any).editor;
    editor.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Contenido de la primera hoja.'}]},{type:'pageBreak'},{type:'paragraph',content:[{type:'text',text:'Contenido de la segunda hoja.'}]},{type:'pageBreak'},{type:'paragraph',content:[{type:'text',text:'Contenido de la tercera hoja.'}]}]});
  });
}
async function printedPages(page: Page) {
  await page.evaluate(()=>document.fonts.ready);const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
  return page.evaluate(async bytes => {
    // Read the actual Chromium PDF in-browser with the same PDF.js library as the importer.
    const {getDocument,GlobalWorkerOptions}=await import(/* @vite-ignore */ '/node_modules/pdfjs-dist/build/pdf.mjs');
    GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const task=getDocument({data:Uint8Array.from(bytes),disableFontFace:true});const doc=await task.promise;
    try { const pages:string[]=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);const text=await p.getTextContent();pages.push(text.items.filter((v:any)=>'str' in v).map((v:any)=>v.str).join(' '));}return pages; }
    finally{await task.destroy();}
  },Array.from(pdf));
}
test('blank default header, editable running text and automatic page numbers survive actual PDF and LaTeX export',async({page})=>{
  await prepare(page);
  await expect(page.locator('.paper-eyebrow')).toHaveCount(0);await expect(page.locator('.running-header-editor>button>span').first()).toBeEmpty();
  await expect(page.locator('.footer-brand')).toHaveText('TEXLA DOCS');
  await page.getByRole('button',{name:'Editar encabezado',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Contenido del encabezado',{exact:true}).selectOption('custom');
  await dialog.getByLabel('Texto del encabezado',{exact:true}).fill('Instituto de investigación');
  await dialog.getByLabel('Texto del pie de página',{exact:true}).fill('Proyecto Capstone');
  await dialog.getByLabel('Numeración de páginas',{exact:true}).selectOption('bottom-right');
  await dialog.getByLabel('Número inicial de página',{exact:true}).fill('5');
  await dialog.getByLabel('Texto antes del número de página',{exact:true}).fill('Página ');
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  const pages=await printedPages(page);expect(pages).toHaveLength(3);
  for(let i=0;i<3;i++){expect(pages[i]).toContain('Instituto de investigación');expect(pages[i]).toContain('Proyecto Capstone');expect(pages[i]).toContain('TEXLA DOCS');expect(pages[i]).toContain(`Página ${i+5}`);}
  await page.getByRole('button',{name:'Encabezado y pie',exact:true}).click();
  await dialog.getByLabel('Estilo de números de página',{exact:true}).selectOption('roman');
  await dialog.getByLabel('Mostrar número en la primera página',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  const roman=await printedPages(page);expect(roman[0]).not.toContain('Página v');expect(roman[1]).toContain('Página vi');expect(roman[2]).toContain('Página vii');
  await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();
  const tex=await page.locator('.latex-panel pre').innerText();expect(tex).toContain('\\setcounter{page}{5}');expect(tex).toContain('\\pagenumbering{roman}');expect(tex).toContain('\\thispagestyle{texlafirst}');expect(tex).toContain('Instituto de investigación');expect(tex).toContain('Proyecto Capstone');
  await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Páginas formales Guardado en este dispositivo'}).click();
  await expect(page.locator('.running-header-editor')).toContainText('Instituto de investigación');
  await page.getByRole('button',{name:'Encabezado y pie',exact:true}).click();await expect(dialog.getByLabel('Número inicial de página',{exact:true})).toHaveValue('5');
  await dialog.getByLabel('Numeración de páginas',{exact:true}).selectOption('none');await dialog.getByLabel('Contenido del encabezado',{exact:true}).selectOption('auto');
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  const unnumbered=await printedPages(page);for(const p of unnumbered){expect(p).not.toContain('Página ');expect(p).not.toContain('Instituto de investigación');expect(p).toContain('TEXLA DOCS');}
});

test('page furniture is editable on mobile and imported headers can be hidden without deleting them',async({page})=>{
  await prepare(page);await page.locator('.tiptap').evaluate(el=>{const editor=(el as any).editor;editor.commands.insertContentAt(0,{type:'importedHeader',content:[{type:'paragraph',content:[{type:'text',text:'Encabezado original'}]}]});});
  await expect(page.locator('.imported-header')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Encabezado y pie',exact:true}).click();
  const header=page.getByRole('dialog').getByLabel('Contenido del encabezado',{exact:true});await header.selectOption('none');await page.getByRole('button',{name:'Listo',exact:true}).click();
  await expect(page.locator('.imported-header')).toBeHidden();
  await page.getByRole('button',{name:'Editar pie de página',exact:true}).click();await header.selectOption('auto');await page.getByRole('button',{name:'Listo',exact:true}).click();
  await expect(page.locator('.imported-header')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
