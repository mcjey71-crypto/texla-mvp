import { Unzip, UnzipInflate, strFromU8 } from 'fflate';
// Stream decompression with limits before passing an office file to a converter.
export function readArchive(bytes: Uint8Array): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = Object.create(null);
  let total = 0, count = 0, failure: Error | undefined;
  const unzip = new Unzip(file => {
    if (++count > 3000 || (file.originalSize || 0) > 32 * 1024 * 1024) { failure = new Error('El archivo comprimido es demasiado grande o complejo.'); return; }
    const parts: Uint8Array[] = []; let size = 0;
    file.ondata = (error, data, final) => {
      if (error) { failure = error; return; }
      total += data.length; size += data.length;
      if (total > 32 * 1024 * 1024) { failure = new Error('El archivo supera 32 MB al descomprimirse. Divide el documento.'); file.terminate(); return; }
      parts.push(data);
      if (final) { const output = new Uint8Array(size); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } files[file.name] = output; }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 4096) { unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length); if (failure) throw failure; }
  if (!count) throw new Error('El archivo no es un documento Office válido.');
  return files;
}
export function readXML(bytes: Uint8Array | undefined): XMLDocument {
  if (!bytes) throw new Error('Falta el contenido principal del documento.');
  const xml = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  if (xml.querySelector('parsererror') || xml.doctype) throw new Error('No se pudo leer la estructura del documento.');
  return xml;
}
