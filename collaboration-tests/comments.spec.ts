import { test, expect, type Page } from '@playwright/test';

async function openComments(page: Page) {
  await page.getByRole('button', { name: 'Comentarios', exact: true }).click();
}
test('shared comments and simultaneous replies merge across browsers, persist offline and resolve for everyone', async ({ browser, page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Nuevo documento' }).click();
  await page.getByPlaceholder('Mi próxima gran idea').fill('Comentarios en equipo');
  await page.getByRole('button', { name: 'Crear documento', exact: true }).click();
  await page.locator('.tiptap p').click(); await page.keyboard.type('Una afirmación para revisar.');
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await page.getByLabel('Tu nombre para colaborar').fill('Ana');
  await page.getByLabel('Servidor de colaboración').fill('http://127.0.0.1:8787');
  await page.getByRole('button', { name: 'Crear enlace de edición' }).click();
  await expect(page.getByLabel('Enlace de edición')).toBeVisible();
  const link = await page.getByLabel('Enlace de edición').inputValue();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const context = await browser.newContext(); const guest = await context.newPage();
  try {
    await guest.goto(link); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await page.locator('.tiptap p').first().evaluate(el => { const editor=(el.closest('.tiptap') as any).editor;const from=editor.view.posAtDOM(el,0);editor.commands.setTextSelection({from,to:from+15}); });
    await openComments(page); await page.getByRole('button', { name: 'Añadir comentario', exact: true }).click();
    await page.getByLabel('Nuevo comentario').fill('Necesitamos verificar esta fuente.');
    // A remote edit while the draft is open must move the anchor with the text.
    await guest.locator('.tiptap').evaluate(el => (el as any).editor.commands.insertContentAt(1, 'Contexto: '));
    await expect(page.locator('.tiptap')).toContainText('Contexto:');
    await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click();
    await expect(guest.locator('.comment-anchor')).toContainText('Una afirmación');
    await expect(guest.locator('.comment-anchor')).not.toContainText('Contexto:');
    await openComments(guest); await guest.getByLabel('Tu nombre en los comentarios').fill('Luis');
    await expect(guest.locator('.comment-message')).toContainText('Necesitamos verificar esta fuente.');
    await Promise.all([page.getByLabel('Responder al comentario').fill('Respuesta de Ana.'), guest.getByLabel('Responder al comentario').fill('Respuesta de Luis.')]);
    await Promise.all([page.getByRole('button', { name: 'Responder', exact: true }).click(), guest.getByRole('button', { name: 'Responder', exact: true }).click()]);
    for (const p of [page, guest]) { await expect(p.locator('.comment-message')).toHaveCount(3); await expect(p.locator('.comment-list')).toContainText('Respuesta de Ana.'); await expect(p.locator('.comment-list')).toContainText('Respuesta de Luis.'); }
    await context.setOffline(true); await expect(guest.locator('.collaboration-status')).toContainText('Sin conexión');
    await guest.getByLabel('Responder al comentario').fill('Respuesta pendiente sin conexión.'); await guest.getByRole('button', { name: 'Responder', exact: true }).click();
    await context.setOffline(false); await expect(page.locator('.comment-list')).toContainText('Respuesta pendiente sin conexión.');
    await page.getByRole('button', { name: 'Resolver comentario', exact: true }).click();
    await expect(guest.locator('.comment-card')).toHaveCount(0);
    await guest.getByLabel('Mostrar comentarios').selectOption('resolved'); await expect(guest.locator('.comment-message')).toHaveCount(4);
    await guest.getByRole('button', { name: 'Reabrir comentario', exact: true }).click();
    await expect(page.locator('.comment-card')).toHaveCount(1);
    await guest.reload(); await guest.getByRole('button', { name: 'Comentarios en equipo Documento compartido' }).click(); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await openComments(guest); await expect(guest.locator('.comment-message')).toHaveCount(4);
    await guest.getByRole('button', { name: 'Cerrar comentarios', exact: true }).click();
    await guest.locator('.tiptap p').first().evaluate(el => { const editor=(el.closest('.tiptap') as any).editor;const from=editor.view.posAtDOM(el,0);editor.commands.setTextSelection({from,to:from+15}); });
    await guest.getByLabel('Tamaño de letra en puntos').fill('20'); await guest.getByLabel('Tamaño de letra en puntos').press('Enter');
    await expect(page.locator('.tiptap span[style*="font-size: 20pt"]')).toBeVisible();
  } finally { await context.close(); }
});
