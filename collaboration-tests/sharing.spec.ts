import { test, expect, type Page } from '@playwright/test';

async function share(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo documento' }).click();
  await page.getByPlaceholder('Mi próxima gran idea').fill('Investigación en equipo');
  await page.getByRole('button', { name: 'Crear documento' }).click();
  await page.locator('.tiptap p').last().click(); await page.keyboard.type('Introducción compartida.');
  const originalId = await page.evaluate(()=>JSON.parse(localStorage.getItem('texla-docs-v1')!).find((doc:{title:string})=>doc.title==='Investigación en equipo')?.id);
  const originalCount = await page.locator('.document-list>button').count();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await page.getByLabel('Tu nombre para colaborar').fill('Ana');
  await page.getByLabel('Servidor de colaboración').fill('http://127.0.0.1:8787');
  await page.getByRole('button', { name: 'Crear enlace de edición' }).click();
  await expect(page.getByLabel('Enlace de edición')).toBeVisible();
  const link = await page.getByLabel('Enlace de edición').inputValue();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');
  await expect(page.locator('.document-list>button')).toHaveCount(originalCount);
  if(originalId) await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('texla-docs-v1')!).find((doc:{shared?:unknown})=>doc.shared)?.id)).toBe(originalId);
  return link;
}
async function append(page: Page, text: string) {
  await page.locator('.tiptap').evaluate((el, text) => {
    const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor;
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text }] });
  }, text);
}

test('two independent browsers merge simultaneous edits, metadata, math, tables and citations; offline edits reconnect', async ({ browser, page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const link = await share(page);
  const guestContext = await browser.newContext(); const guest = await guestContext.newPage(); guest.on('pageerror', e => errors.push(e.message));
  try {
    await guest.goto(link); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await expect(guest.locator('.tiptap')).toContainText('Introducción compartida.');
    await expect(guest.locator('.tiptap p')).toHaveCount(1);
    expect(guest.url()).not.toContain('#share=');
    await guest.getByRole('button', { name: 'Compartir', exact: true }).click(); await guest.getByLabel('Tu nombre para colaborar').fill('Luis'); await guest.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.locator('.collaborators')).toContainText('Luis'); await expect(guest.locator('.collaborators')).toContainText('Ana');
    await Promise.all([append(page, 'Aporte de Ana.'), append(guest, 'Aporte de Luis.')]);
    for (const p of [page, guest]) { await expect(p.locator('.tiptap')).toContainText('Aporte de Ana.'); await expect(p.locator('.tiptap')).toContainText('Aporte de Luis.'); }
    await expect.poll(() => page.locator('.tiptap').innerText()).toBe(await guest.locator('.tiptap').innerText());
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(page.locator('.tiptap')).not.toContainText('Aporte de Ana.'); await expect(page.locator('.tiptap')).toContainText('Aporte de Luis.');
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await expect(guest.locator('.tiptap')).toContainText('Aporte de Ana.');
    await guest.getByLabel('Nombre del documento').fill('Tesis colaborativa'); await expect(page.getByLabel('Nombre del documento')).toHaveValue('Tesis colaborativa');
    await guest.getByRole('button', { name: 'Formato del documento', exact: true }).click(); await guest.getByRole('dialog').getByLabel('Tamaño de página').selectOption('Carta'); await guest.getByRole('button', { name: 'Listo', exact: true }).click(); await expect(page.locator('.paper')).toHaveClass(/letter/);
    await guest.getByRole('button',{name:'Formato del documento',exact:true}).click();await guest.getByRole('dialog').getByLabel('Fuente del documento').selectOption('Times New Roman');await guest.getByRole('dialog').getByLabel('Sangría de primera línea').selectOption('1.25');await guest.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.getByLabel('Tipografía',{exact:true})).toHaveValue('Times New Roman');await expect(page.locator('.paper')).toHaveCSS('--first-indent','1.25cm');
    await guest.getByRole('button',{name:'Formato del documento',exact:true}).click();
    await guest.getByRole('dialog').getByLabel('Tamaño de página').selectOption('A1');await expect(page.locator('.paper')).toHaveAttribute('data-page-size','A1');
    await guest.getByRole('dialog').getByLabel('Tamaño de página').selectOption('Continuo');await expect(page.locator('.paper')).toHaveClass(/continuous-paper/);
    await guest.getByRole('button',{name:'Listo',exact:true}).click();
    await page.locator('.tiptap').evaluate(el => {
      const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor;
      editor.commands.insertContentAt(editor.state.doc.content.size, [{ type: 'blockMath', attrs: { latex: 'E=mc^2' } }, { type: 'paragraph', content: [{ type: 'citation', attrs: { reference: { id: 'doi:10.1038/nphys1170', url: 'https://doi.org/10.1038/nphys1170', title: 'Measured measurement', authors: 'Aspelmeyer, Markus', year: '2009' } } }] }]);
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    });
    await expect(guest.locator('.tiptap table')).toHaveCount(1); await expect(guest.locator('[data-type="block-math"]')).toHaveAttribute('data-latex', 'E=mc^2'); await expect(guest.locator('.bibliography')).toContainText('Measured measurement');
    await page.locator('[data-type="block-math"]').click();
    await expect(page.locator('math-field')).toBeVisible();
    await page.getByText('Editar código LaTeX (opcional)', { exact: true }).click(); await page.getByLabel('Código LaTeX').fill('E=mc^3');
    await guest.locator('.tiptap').evaluate(el => { const editor = (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor; editor.commands.insertContentAt(0, { type: 'paragraph', content: [{ type: 'text', text: 'Cambio antes de la ecuación.' }] }); });
    await expect(page.locator('.tiptap')).toContainText('Cambio antes de la ecuación.');
    await page.getByRole('button', { name: 'Guardar ecuación', exact: true }).click(); await expect(guest.locator('[data-type="block-math"]')).toHaveAttribute('data-latex', 'E=mc^3');
    await guest.getByRole('button', { name: 'Referencias', exact: true }).click(); await guest.getByRole('combobox', { name: 'Estilo bibliográfico' }).selectOption('apa'); await guest.getByRole('button', { name: 'Cerrar', exact: true }).click(); await expect(page.locator('.tiptap .citation')).toHaveAttribute('data-citation-label', '(Aspelmeyer, 2009)');
    await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await guestContext.setOffline(true); await guest.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(guest.locator('.collaboration-status')).toContainText('Sin conexión al servidor');
    await append(guest, 'Nota escrita sin conexión.'); await append(page, 'Nota del equipo conectado.');
    await expect(page.locator('.tiptap')).not.toContainText('Nota escrita sin conexión.');
    await guestContext.setOffline(false); await guest.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.tiptap')).toContainText('Nota escrita sin conexión.'); await expect(guest.locator('.tiptap')).toContainText('Nota del equipo conectado.');
    await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await guest.reload(); await guest.getByRole('button', { name: 'Tesis colaborativa Documento compartido' }).click();
    await expect(guest.locator('.tiptap')).toContainText('Nota escrita sin conexión.'); await expect(guest.locator('.tiptap table')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally { await guestContext.close(); }
});

test('capability checks reject a wrong link and non-owner revocation; owner can revoke existing connections', async ({ browser, page, request }) => {
  const link = await share(page); const access = JSON.parse(decodeURIComponent(new URL(link).hash.slice(7)));
  const denied = await request.delete(`${access.server}/rooms/${access.room}`, { headers: { Origin: 'http://127.0.0.1:5173', Authorization: `Bearer ${access.token}` } }); expect(denied.status()).toBe(403);
  const forbidden = await request.get(`${access.server}/health`, { headers: { Origin: 'https://unrelated.example' } }); expect(forbidden.status()).toBe(403);
  const close = await page.evaluate(async ({ server, room }) => await new Promise<number>(resolve => { const ws = new WebSocket(server.replace('http', 'ws') + '/rooms/' + room + '/socket'); ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: '0'.repeat(64), clientId: 17 })); ws.onclose = e => resolve(e.code); }), access); expect(close).toBe(4003);
  const guestContext = await browser.newContext(); const guest = await guestContext.newPage();
  try {
    await guest.goto(link); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await page.getByRole('button', { name: 'Compartir', exact: true }).click(); await page.getByRole('button', { name: 'Dejar de compartir', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar: dejar de compartir' }).click();
    await expect(page.locator('.collaboration-status')).toHaveCount(0); await expect(page.locator('.tiptap')).toContainText('Introducción compartida.'); await expect(guest.locator('.collaboration-status')).toContainText('Colaboración detenida');
    const revoked = await page.evaluate(async ({ server, room }) => await new Promise<number>(resolve => { const ws = new WebSocket(server.replace('http', 'ws') + '/rooms/' + room + '/socket'); ws.onclose = e => resolve(e.code); }), access); expect(revoked).toBe(4003);
    await guest.getByRole('button', { name: 'Copias editables' }).click(); const downloadEvent = guest.waitForEvent('download'); await guest.getByRole('button', { name: 'Descargar copia editable' }).click(); const download = await downloadEvent;
    const fs = await import('node:fs/promises'); const backup = await fs.readFile((await download.path())!, 'utf8'); expect(backup).not.toContain(access.token); expect(backup).not.toContain('ownerToken'); expect(backup).toContain('Introducción compartida.');
  } finally { await guestContext.close(); }
});

test('mobile sharing is clear about server setup and preserves private local documents', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(page.getByText('La colaboración necesita activar el servidor gratuito de Texla en Cloudflare.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear enlace de edición' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('pending offline changes survive closing the tab and merge when reopened', async ({ browser, page }) => {
  const link = await share(page); const context = await browser.newContext(); let guest = await context.newPage();
  try {
    await guest.goto(link); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    await context.setOffline(true); await guest.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(guest.locator('.collaboration-status')).toContainText('Sin conexión al servidor');
    await append(guest, 'Pendiente guardado antes de cerrar.');
    // A transaction on the same database is queued after the write of the CRDT update.
    await guest.evaluate(async () => {
      const databases = await indexedDB.databases(); const name = databases.find(db => db.name?.startsWith('texla-collaboration-v1:'))!.name!;
      await new Promise<void>((resolve, reject) => { const opening = indexedDB.open(name); opening.onerror = () => reject(opening.error); opening.onsuccess = () => { const db = opening.result; const tx = db.transaction('updates', 'readonly'); tx.objectStore('updates').getAll(); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
    });
    await expect(page.locator('.tiptap')).not.toContainText('Pendiente guardado antes de cerrar.');
    await guest.close(); await append(page, 'Aporte mientras el invitado estaba fuera.'); await context.setOffline(false);
    guest = await context.newPage(); await guest.goto(link);
    for (const p of [guest, page]) { await expect(p.locator('.tiptap')).toContainText('Pendiente guardado antes de cerrar.'); await expect(p.locator('.tiptap')).toContainText('Aporte mientras el invitado estaba fuera.'); }
    await expect(guest.locator('.tiptap p').filter({ hasText: 'Pendiente guardado antes de cerrar.' })).toHaveCount(1);
  } finally { await context.close(); }
});

test('disabled browser cache warns explicitly while online collaboration keeps working', async ({ browser, page }) => {
  const link = await share(page); const context = await browser.newContext();
  await context.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: { open() { throw new DOMException('Storage disabled', 'SecurityError'); } } }));
  const guest = await context.newPage(); const errors: string[] = []; guest.on('pageerror', e => errors.push(e.message));
  try {
    await guest.goto(link); await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor'); await expect(guest.locator('.collaboration-status')).toContainText('No se pudo activar la copia sin conexión');
    await append(guest, 'Edición con almacenamiento restringido.'); await expect(page.locator('.tiptap')).toContainText('Edición con almacenamiento restringido.'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('owner reopening the same link and stopping sharing keep one document',async({page})=>{
 const link=await share(page);const count=await page.locator('.document-list>button').count();
 await page.goto(link);await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');await expect(page.locator('.document-list>button')).toHaveCount(count);
 await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByRole('button',{name:'Dejar de compartir',exact:true}).click();await page.getByRole('button',{name:'Confirmar: dejar de compartir'}).click();await expect(page.locator('.collaboration-status')).toHaveCount(0);await expect(page.locator('.document-list>button')).toHaveCount(count);await expect(page.locator('.tiptap')).toContainText('Introducción compartida.');
});
