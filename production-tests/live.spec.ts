import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'texla-live-voice-'));
const wav = join(directory, 'microphone.wav');
const server = process.env.VITE_COLLABORATION_URL || 'https://texla-collaboration.mcjey71.workers.dev';
test.use({
  permissions: ['microphone'],
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`],
  },
});
test.beforeAll(() => {
  const samples = 48000 * 4;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(10000 * Math.sin(2 * Math.PI * 440 * i / 48000)), 44 + i * 2);
  writeFileSync(wav, bytes);
});
test.afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function probe(page: Page) {
  await page.addInitScript(() => {
    const state = (window as any).__texlaAudit = { sent: 0, streams: [] as MediaStream[], analysers: [] as AnalyserNode[] };
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
      if (typeof data === 'string' && data.includes('"type":"voice:audio"')) state.sent++;
      return originalSend.call(this, data);
    };
    const originalGet = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await originalGet(constraints); state.streams.push(stream); return stream;
    };
    const originalGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function() {
      const node = originalGain.call(this); const analyser = this.createAnalyser();
      node.connect(analyser); state.analysers.push(analyser); return node;
    };
  });
}
async function energy(page: Page) {
  return page.evaluate(() => {
    let maximum = 0;
    for (const analyser of (window as any).__texlaAudit.analysers as AnalyserNode[]) {
      const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
    }
    return maximum;
  });
}

test('published editor loads and reports the enabled login providers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.name));
  await page.goto('./');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.getByRole('button',{name:'Atajos de teclado',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toContainText('Insertar ecuación');
  await page.getByRole('button',{name:'Volver al documento'}).click();
  const settings = page.waitForResponse(response => new URL(response.url()).pathname === '/auth/v1/settings');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const response = await settings;
  expect(response.status()).toBe(200);
  const data = await response.json();
  const google = !!data.external?.google, email = !!data.external?.email;
  console.log(`::notice::Published login settings: Google=${google}; email=${email}. Email delivery and real OAuth consent are not exercised.`);
  expect(google || email).toBe(true);
  if (google) await expect(page.getByRole('button', { name: 'Continuar con Google', exact: true })).toBeVisible();
  if (email) await expect(page.getByLabel('Tu correo electrónico')).toBeVisible();
  expect(errors).toEqual([]);
});

test('live shared comments, typography and voice synchronize through the published server', async ({ page, browser, request }, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!).origin;
  const health = await request.get(server + '/health', { headers: { Origin: origin } });
  expect(health.status()).toBe(200);
  expect(health.headers()['access-control-allow-origin']).toBe(origin);
  expect((await health.json()).voiceVersion).toBe(1);
  const guestContext = await browser.newContext({ permissions: ['microphone'] });
  const guest = await guestContext.newPage();
  await probe(page); await probe(guest);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.name));
  guest.on('pageerror', error => pageErrors.push(error.name));
  let created: { room: string; ownerToken: string } | undefined;
  // Capture only the temporary room created by this test, including on a later UI failure.
  page.on('response', response => {
    if (response.url() === server + '/rooms' && response.request().method() === 'POST' && response.status() === 201) {
      void response.json().then(data => { created = data; }).catch(() => {});
    }
  });
  try {
    await test.step('Create an isolated test document on the published website', async () => {
      await page.goto('./');
      await page.getByRole('button', { name: 'Nuevo documento' }).click();
      await page.getByPlaceholder('Mi próxima gran idea').fill('Comprobación temporal de colaboración');
      await page.getByRole('button', { name: 'Crear documento', exact: true }).click();
      await page.getByRole('button', { name: 'Compartir', exact: true }).click();
      await page.getByLabel('Tu nombre para colaborar').fill('Prueba A');
      if (!await page.getByLabel('Servidor de colaboración').isVisible()) {
        await page.getByRole('button', { name: 'Configuración de la conexión', exact: true }).click();
      }
      await page.getByLabel('Servidor de colaboración').fill(server);
      await page.getByRole('button', { name: 'Crear enlace de edición', exact: true }).click();
      await expect(page.getByLabel('Enlace de edición')).toBeVisible();
      const link = await page.getByLabel('Enlace de edición').inputValue();
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await guest.goto(link);
      await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');
      await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');
    });
    await test.step('Synchronize text size, a comment, a reply and resolution on the published website', async () => {
      await page.locator('.tiptap p').first().click(); await page.keyboard.type('Fragmento para revisar.');
      await page.locator('.tiptap p').first().evaluate(el => {
        const editor = (el.closest('.tiptap') as any).editor, from = editor.view.posAtDOM(el, 0);
        editor.commands.setTextSelection({ from, to: from + 9 });
      });
      await page.getByLabel('Tamaño de letra en puntos').fill('18'); await page.getByLabel('Tamaño de letra en puntos').press('Enter');
      await expect(guest.locator('.tiptap span[style*="font-size: 18pt"]')).toHaveText('Fragmento');
      await page.getByRole('button', { name: 'Comentarios', exact: true }).click();
      await page.getByRole('button', { name: 'Añadir comentario', exact: true }).click();
      await page.getByLabel('Nuevo comentario').fill('Comentario temporal de comprobación.');
      await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click();
      await guest.getByRole('button', { name: 'Comentarios', exact: true }).click();
      await expect(guest.locator('.comment-message')).toContainText('Comentario temporal de comprobación.');
      await guest.getByLabel('Responder al comentario').fill('Respuesta recibida en el documento compartido.');
      await guest.getByRole('button', { name: 'Responder', exact: true }).click();
      await expect(page.locator('.comment-message')).toHaveCount(2);
      await page.getByRole('button', { name: 'Resolver comentario', exact: true }).click();
      await expect(guest.locator('.comment-card')).toHaveCount(0);
      await guest.getByLabel('Mostrar comentarios').selectOption('resolved');
      await expect(guest.locator('.comment-message')).toHaveCount(2);
      for (const participant of [page, guest]) await participant.getByRole('button', { name: 'Cerrar comentarios', exact: true }).click();
      console.log('::notice::Published shared font size, anchored comment, reply and resolution passed between two browsers.');
    });
    await test.step('Synchronize the header and automatic page settings', async () => {
      await page.getByRole('button', { name: 'Encabezado y pie', exact: true }).click();
      await page.getByLabel('Contenido del encabezado').selectOption('custom');
      await page.getByLabel('Texto del encabezado', { exact: true }).fill('Informe compartido');
      await page.getByLabel('Número inicial de página').fill('7');
      await page.getByLabel('Estilo de números de página').selectOption('Roman');
      await page.getByRole('button', { name: 'Listo', exact: true }).click();
      await expect(guest.getByRole('button', { name: 'Editar encabezado', exact: true })).toContainText('Informe compartido');
      await guest.getByRole('button', { name: 'Encabezado y pie', exact: true }).click();
      await expect(guest.getByLabel('Número inicial de página')).toHaveValue('7');
      await expect(guest.getByLabel('Estilo de números de página')).toHaveValue('Roman');
      await guest.getByRole('button', { name: 'Listo', exact: true }).click();
      console.log('::notice::Published header and automatic page settings synchronized between two browsers.');
    });
    await test.step('Join audio voluntarily and verify idle silence', async () => {
      for (const participant of [page, guest]) {
        expect(await participant.evaluate(() => (window as any).__texlaAudit.streams.length)).toBe(0);
        await participant.getByRole('button', { name: 'Activar walkie-talkie', exact: true }).click();
      }
      await expect(page.locator('.walkie-heading')).toContainText('2 en el canal');
      await expect(page.locator('.walkie-panel')).toHaveClass(/walkie-compact/);
      expect((await page.locator('.walkie-panel').boundingBox())!.height).toBeLessThan(85);
      await page.getByRole('button',{name:'Mostrar detalles del walkie-talkie'}).click();
      await expect(page.locator('.walkie-hint')).toBeVisible();
      await page.getByRole('button',{name:'Reducir walkie-talkie'}).click();

      expect(await page.evaluate(() => (window as any).__texlaAudit.sent)).toBe(0);
      expect(await energy(guest)).toBeLessThan(.001);
    });
    await test.step('Hold the voice shortcut from the editor and release a modifier', async () => {
      await page.locator('.tiptap p').first().click();
      const before=await page.locator('.tiptap').evaluate(el=>JSON.stringify((el as any).editor.getJSON()));
      await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.keyboard.down('Space');
      await expect.poll(()=>energy(guest)).toBeGreaterThan(.01);
      await page.keyboard.up('Shift');await expect.poll(()=>energy(guest)).toBeLessThan(.001);
      await page.keyboard.up('Space');await page.keyboard.up('Control');
      expect(await page.locator('.tiptap').evaluate(el=>JSON.stringify((el as any).editor.getJSON()))).toBe(before);
      console.log('::notice::Published global push-to-talk shortcut delivered audio and stopped on modifier release without changing the document.');
    });
    await test.step('Transmit A to B while edits still synchronize', async () => {
      const button = page.getByRole('button', { name: 'Mantener pulsado para hablar', exact: true });
      await button.hover(); await page.mouse.down();
      await expect(page.locator('.walkie-status')).toContainText('transmitiendo');
      await expect(guest.getByRole('button', { name: 'Mantener pulsado para hablar', exact: true })).toBeDisabled();
      await expect.poll(() => energy(guest)).toBeGreaterThan(.01);
      expect(await energy(page)).toBeLessThan(.001);
      await guest.locator('.tiptap').evaluate(el => {
        const editor = (el as any).editor;
        editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: 'Edición simultánea verificada.' }] });
      });
      await expect(page.locator('.tiptap')).toContainText('Edición simultánea verificada.');
      await guest.getByRole('button', { name: 'Silenciar sonido del walkie-talkie', exact: true }).click();
      await expect.poll(() => energy(guest)).toBeLessThan(.001);
      await guest.getByRole('button', { name: 'Activar sonido del walkie-talkie', exact: true }).click();
      await expect.poll(() => energy(guest)).toBeGreaterThan(.01);
      await page.mouse.up();
      await expect(guest.locator('.walkie-status')).toContainText('Canal libre');
      await expect.poll(() => energy(guest)).toBeLessThan(.001);
      const sent = await page.evaluate(() => (window as any).__texlaAudit.sent);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as any).__texlaAudit.sent)).toBe(sent);
    });
    await test.step('Transmit B to A and close both microphones', async () => {
      const button = guest.getByRole('button', { name: 'Mantener pulsado para hablar', exact: true });
      await button.hover(); await guest.mouse.down();
      await expect.poll(() => energy(page)).toBeGreaterThan(.01);
      await guest.mouse.up();
      await expect.poll(() => energy(page)).toBeLessThan(.001);
      for (const participant of [page, guest]) {
        await participant.getByRole('button', { name: 'Desactivar walkie-talkie', exact: true }).click();
        expect(await participant.evaluate(() => (window as any).__texlaAudit.streams.every((stream: MediaStream) => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true);
      }
      expect(pageErrors).toEqual([]);
    });
    console.log(`::notice::Audio passed against ${origin} and ${new URL(server).origin}: A to B and B to A, mute, release, microphone closure and concurrent editing. Synthetic microphone, no real user accounts.`);
  } finally {
    // Never retain audit documents or print their edit/owner capabilities.
    testInfo.setTimeout(testInfo.timeout + 20000);
    await guestContext.close();
    await page.close();
    if (created) {
      const response = await request.delete(`${server}/rooms/${created.room}`, { headers: { Origin: origin, Authorization: `Bearer ${created.ownerToken}` }, timeout: 15000 });
      expect(response.status(), 'Temporary audit room must be deleted').toBe(200);
      console.log('::notice::Temporary audit room deleted.');
    }
  }
});
