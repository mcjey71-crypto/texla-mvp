import {test, expect, type Page} from '@playwright/test';

async function content(page: Page, blocks: unknown[]) {
  await page.locator('.tiptap').evaluate((el, content) => (el as any).editor.commands.setContent({type:'doc', content}), blocks);
}
const paragraph = (text: string) => ({type:'paragraph', content:[{type:'text', text}]});
async function pdfText(page: Page) {
  const bytes = await page.pdf({preferCSSPageSize:true});
  return page.evaluate(async data => {
    const {getDocument, GlobalWorkerOptions} = await import(/* @vite-ignore */ '/node_modules/pdfjs-dist/build/pdf.mjs');
    GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const task = getDocument({data:Uint8Array.from(data)});
    const pdf = await task.promise;
    try {
      const text: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const sheet = await pdf.getPage(i), body = await sheet.getTextContent();
        text.push(body.items.map((item:any) => item.str || '').join(' '));
      }
      return text;
    } finally { await task.destroy(); }
  }, Array.from(bytes));
}

test('zoom up to 600% magnifies without reflow, changing content or altering the printed pages', async ({page}) => {
  await page.setViewportSize({width:1366,height:900}); await page.goto('/');
  await content(page, [paragraph('Primera hoja.'), {type:'pageBreak'}, paragraph('Segunda hoja.'), {type:'pageBreak'}, paragraph('Tercera hoja.')]);
  const count = page.getByLabel('Total de páginas'), zoom = page.getByLabel('Zoom',{exact:true});
  await expect(count).toHaveText('3 páginas aprox.');
  const original = await page.locator('.tiptap').evaluate(el => (el as any).editor.getJSON());
  const width = (await page.locator('.paper').boundingBox())!.width;
  const normalPdf = await pdfText(page); expect(normalPdf).toHaveLength(3);
  for (const level of [25, 500, 600]) {
    await zoom.selectOption(String(level));
    const box = (await page.locator('.paper').boundingBox())!;
    expect(Math.abs(box.width / width - level / 100)).toBeLessThan(.01);
    const canvas = (await page.locator('.canvas').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(canvas.x);
    await expect(count).toHaveText('3 páginas aprox.');
  }
  expect(await page.locator('.tiptap').evaluate(el => (el as any).editor.getJSON())).toEqual(original);
  expect(await pdfText(page)).toEqual(normalPdf);
  expect(normalPdf.join(' ')).not.toContain('aprox.');
  await page.locator('.canvas').evaluate(el => {el.scrollLeft = el.scrollWidth;});
  expect(await page.locator('.canvas').evaluate(el => el.scrollLeft)).toBeGreaterThan(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1366);
  await page.getByRole('button',{name:'Despejar pantalla',exact:true}).click(); await expect(count).toBeVisible();
  await page.setViewportSize({width:390,height:844}); await zoom.selectOption('100');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await zoom.selectOption('600');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(count).toHaveText('3 páginas aprox.');
});

test('page estimate updates for flowing text, paper size and deletion, with continuous mode explicit', async ({page}) => {
  await page.goto('/');
  const count = page.getByLabel('Total de páginas');
  await content(page, [paragraph('Documento breve.')]); await expect(count).toHaveText('1 página aprox.');
  await content(page, Array.from({length:50}, (_,i) => paragraph(`Párrafo ${i+1}. ` + 'La investigación requiere una redacción clara y precisa. '.repeat(5))));
  await expect.poll(async () => parseInt(await count.innerText())).toBeGreaterThan(2);
  const a4 = parseInt(await count.innerText());
  await page.getByRole('button',{name:'Formato del documento',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Tamaño de página').selectOption('A5');
  await expect.poll(async () => parseInt(await count.innerText())).toBeGreaterThan(a4);
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await content(page, [paragraph('Solo una hoja de nuevo.')]); await expect(count).toHaveText('1 página aprox.');
  await page.getByRole('button',{name:'Formato del documento',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Tamaño de página').selectOption('Continuo');
  await expect(count).toHaveText('Sin páginas'); await expect(page.locator('.page-count-measurement')).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('Tamaño de página').selectOption('A4');
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await expect(count).toHaveText('1 página aprox.'); await expect(page.locator('.page-count-measurement')).toHaveCount(1);
  await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();
  await expect(page.locator('.page-count-measurement')).toHaveCount(0);
});
