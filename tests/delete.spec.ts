import {test,expect} from '@playwright/test';
test('deleting a document offers a backup and cancellation, then persists an empty library',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('El lenguaje del universo');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar copia antes de borrar'}).click();expect((await download).suggestedFilename()).toMatch(/\.texla.json$/);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.tiptap h1')).toHaveText('El lenguaje del universo');
 await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await page.getByRole('button',{name:'Confirmar: borrar documento'}).click();
 await expect(page.locator('.document-list>button')).toHaveCount(0);await expect(page.locator('.empty-documents')).toBeVisible();await page.reload();await expect(page.locator('.empty-documents')).toBeVisible();await expect(page.locator('.document-list>button')).toHaveCount(0);
 await page.getByRole('button',{name:'Crear un documento',exact:true}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Un nuevo comienzo');await page.getByRole('button',{name:'Crear documento',exact:true}).click();await expect(page.locator('.tiptap h1')).toHaveText('Un nuevo comienzo');await page.locator('.tiptap p').last().click();await page.keyboard.type('Se conserva el contenido nuevo.');await expect(page.locator('.save-status')).toContainText('Guardado');await page.waitForTimeout(600);await page.reload();await expect(page.locator('.tiptap')).toContainText('Se conserva el contenido nuevo.');expect(errors).toEqual([]);
});
test('delete control works on mobile and leaves other documents intact',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Abrir menú'}).click();await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Borrar solo este');await page.getByRole('button',{name:'Crear documento',exact:true}).click();
 await expect(page.getByRole('button',{name:'Borrar documento',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await page.getByRole('button',{name:'Confirmar: borrar documento'}).click();await expect(page.locator('.tiptap h1')).toHaveText('El lenguaje del universo');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('texla-docs-v1')!).map((doc:{title:string})=>doc.title))).toEqual(['El lenguaje del universo']);
});
test('storage errors preserve the open document and report that deletion failed',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Unavailable','SecurityError');};});await page.getByRole('button',{name:'Confirmar: borrar documento'}).click();await expect(page.getByRole('alert')).toContainText('El documento se conserva');await expect(page.locator('.document-list>button')).toHaveCount(1);
});
