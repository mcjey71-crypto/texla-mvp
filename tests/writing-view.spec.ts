import {test,expect} from '@playwright/test';
test('clear view keeps editing tools and normal view leaves more room for writing',async({page})=>{
 await page.setViewportSize({width:1366,height:900});await page.goto('/');
 await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Vista de redacción');await page.getByRole('button',{name:'Crear documento',exact:true}).click();
 const editor=page.locator('.tiptap');await editor.locator('p').first().click();await page.keyboard.type('Texto inicial.');
 await expect(page.locator('.inspector')).toBeHidden();const normal=await page.locator('.canvas').boundingBox();expect(normal!.height).toBeGreaterThan(900*.65);
 await page.getByRole('button',{name:'Despejar pantalla',exact:true}).click();await expect(page.locator('.toolbar')).toBeVisible();await expect(page.locator('.document-tools')).toBeVisible();await expect(editor).toHaveAttribute('contenteditable','true');
 await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Escribo con la pantalla despejada.');await expect(editor).toContainText('Escribo con la pantalla despejada.');
 await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.getByRole('button',{name:'Negrita',exact:true}).click();await expect(editor.locator('strong')).toContainText('Texto inicial.');
 const focused=await page.locator('.canvas').boundingBox();expect(focused!.height).toBeGreaterThan(normal!.height+80);
 await page.getByRole('button',{name:'Ecuación',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.app-shell')).toHaveClass(/focus-mode/);
 await page.getByRole('button',{name:'Salir de vista despejada',exact:true}).click();await expect(page.locator('.toolbar')).toBeVisible();await expect(editor).toContainText('pantalla despejada');
 await page.getByRole('button',{name:'Estructura y diseño',exact:true}).click();await expect(page.locator('.inspector')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('Control+Shift+Enter');await expect(page.locator('.toolbar')).toBeVisible();await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Movil.');await expect(editor).toContainText('Movil.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('formal links inherit text color and print excludes floating widgets',async({page})=>{
 await page.goto('/');await page.locator('.tiptap').evaluate(el=>{(el as any).editor.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Referencia. '},{type:'text',text:'https://doi.org/10.1234/example',marks:[{type:'link',attrs:{href:'https://doi.org/10.1234/example'}},{type:'textAppearance',attrs:{appearance:{color:'0000FF',size:10}}}]}]}]});});
 const link=page.locator('.tiptap a');const colors=await link.evaluate(el=>({link:getComputedStyle(el.querySelector('span')||el).color,paragraph:getComputedStyle(el.closest('p')!).color}));expect(colors.link).toBe(colors.paragraph);
 await page.evaluate(()=>{const widget=document.createElement('div');widget.id='foreign-widget';widget.style.cssText='position:fixed;top:20px;left:20px;background:red';widget.textContent='Widget externo';document.body.append(widget);const walkie=document.createElement('div');walkie.className='walkie-panel walkie-dock';walkie.textContent='Control de voz';document.querySelector('.main')!.append(walkie);});
 await page.emulateMedia({media:'print'});await expect(page.locator('#foreign-widget')).toBeHidden();await expect(page.locator('.walkie-dock')).toBeHidden();await expect(page.locator('.toolbar')).toBeHidden();
 expect(await page.locator('style').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('color: #739681')]));
 await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:'LaTeX AUTO',exact:true}).click();const tex=await page.locator('.latex-panel pre').innerText();expect(tex).not.toContain('textcolor[HTML]{0000FF}');expect(tex).toContain('Texla Docs - El arte de escribir bien');expect(tex).toContain('\\AddToShipoutPictureBG');
});
