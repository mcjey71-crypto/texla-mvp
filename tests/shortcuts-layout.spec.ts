import { test, expect } from '@playwright/test';

test('writing shortcuts change selected text, insert one page break and open tools without affecting dialog fields', async ({page}) => {
  await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();
  await page.getByPlaceholder('Mi próxima gran idea').fill('Atajos');await page.getByRole('button',{name:'Crear documento',exact:true}).click();
  const editor=page.locator('.tiptap');await editor.locator('p').click();await page.keyboard.type('Texto seleccionado');
  await page.keyboard.press('Home');await page.keyboard.press('Shift+End');
  const size=Number(await page.getByLabel('Tamaño de letra en puntos').inputValue());
  await page.keyboard.press('Control+Shift+Period');await expect(page.getByLabel('Tamaño de letra en puntos')).toHaveValue(String(size+1));
  await page.keyboard.press('Control+Shift+Comma');await expect(page.getByLabel('Tamaño de letra en puntos')).toHaveValue(String(size));
  await page.keyboard.press('Control+b');await expect(editor.locator('strong')).toHaveText('Texto seleccionado');
  await page.keyboard.press('Control+Alt+2');await expect(editor.locator('h2')).toHaveText('Texto seleccionado');
  await page.keyboard.press('Control+Shift+e');await expect(editor.locator('h2')).toHaveCSS('text-align','center');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Control+Enter');
  await expect(editor.locator('.page-break')).toHaveCount(1);await expect(editor.locator('br:not(.ProseMirror-trailingBreak)')).toHaveCount(0);
  for (const [key,selector] of [['e','.math-field-container, math-field'],['r','select[aria-label="Estilo bibliográfico"]'],['t','select[aria-label="Filas"]']]) {
    await editor.click();await page.keyboard.press(`Control+Alt+${key}`);await expect(page.getByRole('dialog')).toBeVisible();
    if(key==='r')await expect(page.getByRole('combobox',{name:'Estilo bibliográfico'})).toBeVisible();
    if(key==='t')await expect(page.getByLabel('Filas',{exact:true})).toBeVisible();
    if(key==='e')await expect(page.getByRole('dialog').locator(selector).first()).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await editor.click();await page.keyboard.press('Control+Alt+k');await expect(page.getByRole('dialog')).toContainText('Aumentar / disminuir letra');
  await page.getByRole('button',{name:'Volver al documento'}).click();
  // Spanish keyboards produce '/' with Shift + 7; keep this legacy alias working.
  await editor.dispatchEvent('keydown',{key:'/',code:'Digit7',ctrlKey:true,shiftKey:true,bubbles:true});
  await expect(page.getByRole('dialog')).toContainText('Ctrl + Alt + K');
  await page.getByRole('button',{name:'Volver al documento'}).click();
  // Mac modifier path, synthesized on Linux, invokes the same application action.
  await page.keyboard.press('Meta+Alt+t');await expect(page.getByLabel('Filas',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Campo protegido');
  await page.keyboard.press('Control+Alt+t');await expect(page.getByPlaceholder('Mi próxima gran idea')).toHaveValue('Campo protegido');
  await expect(page.getByLabel('Filas',{exact:true})).toHaveCount(0);
});

test('outline is compact, highlights the current section and shortcuts stay reachable on mobile', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  const links=page.locator('.outline button');await expect(links).toHaveCount(4);
  const gap=await page.locator('.outline').evaluate(el=>parseFloat(getComputedStyle(el).rowGap));expect(gap).toBeLessThanOrEqual(3);
  await links.last().click();await expect(links.last()).toHaveAttribute('aria-current','location');await expect(links.first()).not.toHaveAttribute('aria-current','location');
  await expect(page.locator('.inspector-help')).toBeVisible();await expect(page.locator('.ai-card')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Atajos de teclado',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Insertar ecuación');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
