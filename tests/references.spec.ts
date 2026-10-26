import { test, expect, type Page } from '@playwright/test';
async function newDoc(page: Page, title: string) {
 await page.getByRole('button', { name: 'Nuevo documento' }).click();
 await page.getByPlaceholder('Mi próxima gran idea').fill(title);
 await page.getByRole('button', { name: 'Crear documento' }).click();
 await page.locator('.tiptap p').last().click();
}
async function addReference(page: Page, link: string, title: string) {
 await page.getByRole('button', { name: 'Referencias', exact: true }).click();
 await page.getByLabel('Enlace o DOI', { exact: true }).fill(link);
 await page.getByLabel('Título de la fuente', { exact: true }).fill(title);
 await page.getByRole('button', { name: 'Guardar e insertar cita' }).click();
}
const citationNumbers = (page: Page) => page.locator('.tiptap .citation').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-citation-number')));
async function selectCitation(page: Page, index: number) {
 await page.locator('.tiptap').evaluate((el, index) => {
  const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor;
  const positions: number[] = []; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'citation') positions.push(pos); });
  editor.chain().focus().setNodeSelection(positions[index]).run();
 }, index);
 await expect(page.locator('.tiptap .citation').nth(index)).toHaveClass(/ProseMirror-selectednode/);
}
test('deduplicates sources, renumbers citations and bibliography after deleting text, restores on undo', async ({ page }) => {
 await page.goto('/'); await newDoc(page, 'Tesis con fuentes');
 await page.keyboard.type('Primera idea ');
 await addReference(page, 'https://doi.org/10.1000/alpha', 'Estudio Alpha');
 await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('Segunda idea ');
 await addReference(page, 'https://example.org/paper?id=2', 'Estudio Beta');
 await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('Otra idea ');
 await page.getByRole('button', { name: 'Referencias', exact: true }).click();
 await page.getByLabel('Enlace o DOI', { exact: true }).fill('doi:10.1000/ALPHA');
 await expect(page.getByText('Esta fuente ya existe')).toBeVisible();
 await page.getByRole('button', { name: 'Citar fuente existente' }).click();
 await expect.poll(() => citationNumbers(page)).toEqual(['1', '2', '1']);
 await expect(page.locator('.bibliography .csl-entry')).toHaveCount(2);
 expect(await page.locator('.tiptap .citation').first().evaluate(el => getComputedStyle(el, '::after').content)).toBe('"[1]"');
 // Delete the complete first paragraph, as when revising a thesis.
 await page.waitForTimeout(600);
 await page.locator('.tiptap').evaluate(el => {
  const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor;
  let range: { from: number; to: number } | undefined;
  editor.state.doc.descendants((node, pos) => { if (!range && node.type.name === 'paragraph') range = { from: pos, to: pos + node.nodeSize }; });
  editor.chain().focus().setTextSelection(range!).run();
 });
 await page.keyboard.press('Backspace');
 await expect.poll(() => citationNumbers(page)).toEqual(['1', '2']);
 await expect(page.locator('.bibliography .csl-entry').first()).toContainText('Estudio Beta');
 await expect(page.locator('.bibliography .csl-entry').last()).toContainText('Estudio Alpha');
 await page.waitForTimeout(600); await selectCitation(page, 1); await page.keyboard.press('Backspace');
 await expect.poll(() => citationNumbers(page)).toEqual(['1']);
 await expect(page.locator('.bibliography .csl-entry')).toHaveCount(1);
 await page.getByRole('button', { name: 'Referencias', exact: true }).click();
 await expect(page.locator('.reference-entry')).toHaveCount(2);
 await expect(page.locator('.reference-entry').filter({ hasText: 'Estudio Alpha' })).toContainText('Sin citar');
 await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
 await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
 await expect.poll(() => citationNumbers(page)).toEqual(['1', '2']);
 await page.emulateMedia({ media: 'print' });
 await expect(page.locator('.bibliography')).toBeVisible();
 expect(await page.locator('.tiptap .citation').last().evaluate(el => getComputedStyle(el, '::after').content)).toBe('"[2]"');
 await page.emulateMedia({ media: 'screen' });
 await page.getByRole('button', { name: 'LaTeX AUTO' }).click();
 await expect(page.locator('.latex-panel pre')).toContainText('\\hypertarget{ref1}{}[1]');
 await page.waitForTimeout(600); await page.reload();
 await page.getByRole('button', { name: 'Tesis con fuentes Guardado en este dispositivo' }).click();
 await expect.poll(() => citationNumbers(page)).toEqual(['1', '2']);
 await expect(page.locator('.bibliography .csl-entry')).toHaveCount(2);
});
test('copies citations across documents with metadata; bibliography starts at one', async ({ page, context }) => {
 await context.grantPermissions(['clipboard-read', 'clipboard-write']); await page.goto('/');
 await newDoc(page, 'Origen'); await addReference(page, 'https://example.org/article', 'Artículo portable');
 // Copy a paragraph containing both a citation and a math node.
 await page.locator('.tiptap').evaluate(el => {
  const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor;
  editor.chain().focus().insertContent([{ type: 'text', text: ' junto a ' }, { type: 'inlineMath', attrs: { latex: 'x^2' } }]).run();
  editor.state.doc.descendants((node, pos) => {
   if (node.type.name === 'paragraph') editor.commands.setTextSelection({ from: pos + 1, to: pos + node.nodeSize - 1 });
  });
 });
 await page.keyboard.press('Control+C');
 await newDoc(page, 'Destino'); await page.keyboard.press('Control+V');
 await expect.poll(() => citationNumbers(page)).toEqual(['1']);
 await expect(page.locator('.bibliography')).toContainText('Artículo portable');
 await expect(page.locator('.tiptap .katex')).toHaveCount(1);
 await page.getByRole('button', { name: 'Referencias', exact: true }).click();
 await expect(page.locator('.reference-entry')).toHaveCount(1);
 await page.getByLabel('Enlace o DOI', { exact: true }).fill('https://example.org/article?utm_source=chatgpt#intro');
 await expect(page.getByText('Esta fuente ya existe')).toBeVisible();
});
test('reference manager is usable on mobile and rejects invalid URLs', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
 await page.getByRole('button', { name: 'Referencias', exact: true }).click();
 await page.getByLabel('Enlace o DOI', { exact: true }).fill('javascript:alert(1)');
 await page.getByRole('button', { name: 'Guardar e insertar cita' }).click();
 await expect(page.getByRole('alert')).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({ path: '/workspace/texla-references-mobile.png' });
});
