import { getDocument, GlobalWorkerOptions, PasswordResponses, type PDFDocumentProxy } from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Worker as OCRWorker } from 'tesseract.js';
import type { DocNode } from '../document';
import { paragraph, MAX_PDF_PAGES, type ImportOptions } from './common';
import { pdfParagraphs, type PdfTextItem } from './pdfLayout';
GlobalWorkerOptions.workerSrc = workerURL;
export async function readPdf(bytes: Uint8Array, options: ImportOptions): Promise<{ content: DocNode; pages: number; warnings: string[] }> {
  const assetBase = new URL(`${import.meta.env.BASE_URL}import-assets/`, window.location.origin).href;
  const task = getDocument({ data: bytes, cMapUrl: `${assetBase}pdf/cmaps/`, cMapPacked: true, standardFontDataUrl: `${assetBase}pdf/standard_fonts/`, wasmUrl: `${assetBase}pdf/wasm/`, stopAtErrors: true });
  const abort = () => { void task.destroy(); };
  options.signal.addEventListener('abort', abort, { once: true });
  let pdf: PDFDocumentProxy | undefined, ocr: OCRWorker | undefined;
  let passwordRequired = false;
  task.onPassword = (_update: (password: string) => void, reason: number) => { passwordRequired = reason === PasswordResponses.NEED_PASSWORD || reason === PasswordResponses.INCORRECT_PASSWORD; void task.destroy(); };
  const warnings = ['PDF: revisa el orden de lectura, las ecuaciones y las tablas. Se recupera contenido editable, no una réplica de la maquetación. Las imágenes no se conservan.'];
  const blocks: DocNode[] = []; let textLength = 0, scannedPages = 0, skipped = 0, ocrPages = 0, currentPage = 0;
  const stopOCR = () => { if (ocr) void ocr.terminate(); };
  options.signal.addEventListener('abort', stopOCR, { once: true });
  try {
    options.signal.throwIfAborted(); pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`El PDF tiene ${pdf.numPages} páginas. Divide el archivo en partes de hasta ${MAX_PDF_PAGES} páginas.`);
    for (let number = 1; number <= pdf.numPages; number++) {
      currentPage = number; options.signal.throwIfAborted(); options.onProgress(`Leyendo página ${number} de ${pdf.numPages}…`);
      const page = await pdf.getPage(number);
      const text = await page.getTextContent();
      const items = text.items.filter((item): item is typeof item & PdfTextItem => 'str' in item);
      let content = pdfParagraphs(items);
      if (items.map(item => item.str).join('').trim().length < 15) {
        scannedPages++;
        if (options.ocr) {
          options.onProgress(`Preparando reconocimiento de texto · página ${number}…`);
          if (!ocr) {
            const { createWorker, OEM } = await import('tesseract.js');
            ocr = await createWorker('spa+eng', OEM.LSTM_ONLY, { workerPath: `${assetBase}ocr/worker.min.js`, corePath: `${assetBase}ocr`, langPath: `${assetBase}ocr`, workerBlobURL: false,
              errorHandler: () => { /* The recognition promise reports the error in the import dialog. */ },
              logger: message => { if (!options.signal.aborted) options.onProgress(`Reconociendo página ${currentPage} de ${pdf!.numPages} · ${Math.round(message.progress * 100)} %`); },
            });
            if (options.signal.aborted) { await ocr.terminate(); ocr = undefined; options.signal.throwIfAborted(); }
          }
          const initial = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.sqrt(6_000_000 / (initial.width * initial.height)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          try {
            await page.render({ canvas, viewport }).promise; options.signal.throwIfAborted();
            const result = await abortable(ocr!.recognize(canvas), options.signal); options.signal.throwIfAborted();
            content = result.data.text.split(/\n\s*\n/).map(value => paragraph(value.replace(/\n/g, ' ').trim())).filter(node => node.content?.length);
            ocrPages++;
          } finally { canvas.width = 0; canvas.height = 0; }
        } else { skipped++; }
      }
      if (number > 1) blocks.push({ type: 'pageBreak' });
      if (!content.length) blocks.push(paragraph(`[Página ${number}: no se recuperó texto${options.ocr ? '' : '; activa el reconocimiento de texto si está escaneada'}.]`));
      else blocks.push(...content);
      textLength += JSON.stringify(content).length;
      if (textLength > 1_000_000) throw new Error('El contenido del PDF es demasiado extenso. Divide el archivo en partes más pequeñas.');
      page.cleanup();
      // Yield between pages so cancellation and progress remain responsive.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (skipped) warnings.push(`${skipped} página(s) tienen poco o ningún texto seleccionable. Activa «Reconocer páginas escaneadas» y vuelve a convertir para recuperar su texto.`);
    if (ocrPages) warnings.push(`Se aplicó OCR a ${ocrPages} página(s), en español e inglés. Corrige posibles errores; el OCR de texto no reconstruye fórmulas matemáticas ni tablas.`);
    if (scannedPages === pdf.numPages && !options.ocr && itemsTextLength(blocks) === 0) throw new Error('Este PDF parece escaneado. Activa «Reconocer páginas escaneadas» y vuelve a convertir.');
    return { content: { type: 'doc', content: blocks }, pages: pdf.numPages, warnings };
  } catch (error) {
    if (passwordRequired) throw new Error('El PDF está protegido con contraseña. Guarda una copia desbloqueada e impórtala.');
    if (options.signal.aborted) throw options.signal.reason;
    if (error instanceof Error && /invalid pdf|invalidpdf|missingpdf/i.test(error.name + error.message)) throw new Error('No se pudo leer este PDF. Comprueba que no esté dañado.');
    throw error;
  } finally {
    options.signal.removeEventListener('abort', abort); options.signal.removeEventListener('abort', stopOCR);
    if (ocr) await ocr.terminate(); await task.destroy();
  }
}
function itemsTextLength(blocks: DocNode[]) { return blocks.filter(block => block.type === 'paragraph' && !block.content?.[0]?.text?.startsWith('[Página')).map(block => block.content?.map(item => item.text || '').join('') || '').join('').length; }

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
