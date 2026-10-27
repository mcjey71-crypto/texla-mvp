import { mkdir, copyFile, cp, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const destination = resolve('public/import-assets');
await mkdir(`${destination}/ocr`, { recursive: true });
await mkdir(`${destination}/pdf`, { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', `${destination}/ocr/worker.min.js`);
for (const name of await readdir('node_modules/tesseract.js-core')) {
  if (/-lstm\.wasm(?:\.js)?$/.test(name)) await copyFile(`node_modules/tesseract.js-core/${name}`, `${destination}/ocr/${name}`);
}
for (const language of ['spa', 'eng']) await copyFile(`node_modules/@tesseract.js-data/${language}/4.0.0/${language}.traineddata.gz`, `${destination}/ocr/${language}.traineddata.gz`);
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) await cp(`node_modules/pdfjs-dist/${folder}`, `${destination}/pdf/${folder}`, { recursive: true });
console.log('PDF and OCR assets ready; documents are processed locally.');
for (const [source, name] of [['tesseract.js/LICENSE.md', 'tesseract-license.txt'], ['tesseract.js-core/LICENSE', 'tesseract-core-license.txt'], ['pdfjs-dist/LICENSE', 'pdfjs-license.txt']]) {
  await copyFile(`node_modules/${source}`, `${destination}/${name}`);
}
