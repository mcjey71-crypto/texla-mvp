import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
async function blank(page:Page){await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Prueba de formatos');await page.getByRole('button',{name:'Crear documento'}).click();await page.locator('.tiptap p').last().click();}
async function paste(page:Page,html:string,text=''){
  await page.evaluate(async({html,text})=>{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);},{html,text});await page.keyboard.press('Control+V');
}
test('all seven page choices persist, print at the selected size and continuous mode reflows',async({page})=>{
  await blank(page);await expect(page.locator('.paper')).toHaveAttribute('data-page-size','A4');
  await page.getByRole('button',{name:'Formato del documento',exact:true}).click();
  const sizes=page.getByRole('dialog').getByLabel('Tamaño de página');await expect(sizes.locator('option')).toHaveCount(7);
  for(const [size,width,height] of [['Carta',215.9,279.4],['A5',148,210],['A3',297,420],['A2',420,594],['A1',594,841]] as const){
    await sizes.selectOption(size);await expect(page.locator('.paper')).toHaveAttribute('data-page-size',size);
    expect(await page.locator('style').allTextContents()).toContainEqual(expect.stringContaining(`size: ${width}mm ${height}mm;`));
    const path=`/tmp/texla-browser-${size}.pdf`;await page.pdf({path,preferCSSPageSize:true});
    const match=/Page size:\s+([\d.]+) x ([\d.]+)/.exec(execFileSync('pdfinfo',[path],{encoding:'utf8'}));
    // Chromium rounds CSS paper dimensions to device pixels (less than 1 point).
    expect(Math.abs(Number(match?.[1])-width*72/25.4)).toBeLessThan(1);expect(Math.abs(Number(match?.[2])-height*72/25.4)).toBeLessThan(1);
  }
  await sizes.selectOption('Continuo');await expect(page.getByRole('dialog')).toContainText('Altura libre');await page.getByRole('button',{name:'Listo',exact:true}).click();
  await expect(page.locator('.paper')).toHaveClass(/continuous-paper/);await expect(page.locator('.paper')).toHaveCSS('min-height','0px');
  await page.getByRole('button',{name:'Salto de página',exact:true}).click();await expect(page.locator('.page-break')).toBeHidden();
  await page.waitForTimeout(600);await page.reload();await page.getByRole('button',{name:'Prueba de formatos Guardado en este dispositivo'}).click();await expect(page.locator('.paper')).toHaveAttribute('data-page-size','Continuo');
  await page.getByRole('button',{name:'LaTeX AUTO'}).click();await expect(page.locator('.latex-panel pre')).toContainText('paperwidth=210mm,paperheight=297mm');await expect(page.locator('.latex-panel pre')).not.toContainText('\\clearpage');
});
test('rich clipboard converts Google equation metadata and MathML without duplicating KaTeX or losing adjacent text',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await blank(page);
  await page.keyboard.type('Antes después');await page.keyboard.press('Home');for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
  await paste(page,'<span id="docs-internal-guid-example" style="font-weight:700">Energía <img src="https://chart.googleapis.com/chart?cht=tx&amp;chl=E%3Dmc%5E2" alt="equation">.</span>','Energía');
  await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveAttribute('data-latex','E=mc^2');await expect(page.locator('.tiptap p').last()).toContainText('Antes Energía');await expect(page.locator('.tiptap p').last()).toContainText('después');await expect(page.locator('.tiptap strong')).toContainText('Energía');
  await page.keyboard.press('Control+End');
  await paste(page,'<p>Fracción <math><mfrac><mi>α</mi><msqrt><mi>x</mi></msqrt></mfrac></math></p><div class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2+y^2=z^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">DUPLICADO</span></span></div>');
  await expect(page.locator('.tiptap [data-type="inline-math"]').last()).toHaveAttribute('data-latex','\\frac{\\alpha }{\\sqrt{x}}');await expect(page.locator('.tiptap [data-type="block-math"]')).toHaveAttribute('data-latex','x^2+y^2=z^2');await expect(page.locator('.tiptap')).not.toContainText('DUPLICADO');
  await page.getByRole('button',{name:'LaTeX AUTO'}).click();await expect(page.locator('.latex-panel pre')).toContainText('\\frac{\\alpha }{\\sqrt{x}}');
});
test('image-only and unsupported equations are flagged without inventing mathematical structure or executing HTML',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await blank(page);
  await paste(page,'<p>Conservar <img src="https://lh3.googleusercontent.com/equation-image" alt="equation" onerror="window.clipboardAttack=true"><math><menclose notation="cancel"><mi>x</mi></menclose></math><script>window.clipboardAttack=true</script></p>');
  await expect(page.locator('.paste-notice')).toContainText('Word (.docx)');await expect(page.locator('.tiptap')).toContainText('Imagen pendiente de convertir');await expect(page.locator('.tiptap')).toContainText('Ecuación pendiente de convertir');await expect(page.locator('.tiptap .katex')).toHaveCount(0);expect(await page.evaluate(()=>('clipboardAttack' in window))).toBe(false);
});
test('paste dialog accepts rich equations and CV is formal, editable and mobile accessible',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await blank(page);await page.getByRole('button',{name:'Pegar contenido',exact:true}).click();await page.locator('.paste-area').click();await paste(page,'<p>Resultado <math><msup><mi>x</mi><mn>2</mn></msup></math></p>');
  await expect(page.locator('.paste-area')).toHaveValue('Resultado \\({x}^{2}\\)');await page.getByRole('button',{name:'Insertar contenido'}).click();await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveAttribute('data-latex','{x}^{2}');
  await page.getByRole('button',{name:'Plantillas'}).click();await page.getByRole('button',{name:/^CV estilo Harvard/}).click();await expect(page.locator('.paper')).toHaveClass(/cv-paper/);await expect(page.locator('.tiptap h2')).toHaveCount(4);await expect(page.locator('.paper')).toHaveAttribute('data-page-size','A4');
  await page.locator('.tiptap h1').click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.keyboard.type('Ana Pérez');await expect(page.locator('.tiptap h1')).toHaveText('Ana Pérez');await page.screenshot({path:'/tmp/texla-cv.png',fullPage:true});
  await page.emulateMedia({media:'print'});await page.pdf({path:'/tmp/texla-cv-browser.pdf',preferCSSPageSize:true});await page.emulateMedia({media:'screen'});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.getByRole('button',{name:'Formato del documento',exact:true}).click();await page.getByRole('dialog').getByLabel('Tamaño de página').selectOption('A1');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
