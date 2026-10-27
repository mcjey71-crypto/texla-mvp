import { useEffect, useRef, useState } from 'react';
import type { Schema } from '@tiptap/pm/model';
import { FileUp, Check, ArrowRight, LoaderCircle } from 'lucide-react';
import { makeBackup } from './backup';
import { importDocument } from './import';
import { IMPORT_ACCEPT, documentText, type ImportResult, type ImportedDocument } from './import/common';
export default function ImportDocument({ schema, hasAccount, onImport }: { schema: Schema; hasAccount: boolean; onImport: (document: ImportedDocument, cloud: boolean) => void }) {
  const [file, setFile] = useState<File>(); const [ocr, setOCR] = useState(false);
  const [result, setResult] = useState<ImportResult>(); const [title, setTitle] = useState(''); const [cloud, setCloud] = useState(hasAccount);
  const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => operation.current?.abort(), []);
  const isPDF = file?.name.toLowerCase().endsWith('.pdf');
  const bytes = result ? new TextEncoder().encode(makeBackup({ ...result.document, title, id: 'import', updated: 0 })).length : 0;
  const overCloudLimit = bytes > 1024 * 1024;
  function select(next?: File) { operation.current?.abort(); operation.current = undefined; setFile(next); setResult(undefined); setError(''); setProgress(''); setBusy(false); }
  async function convert() {
    if (!file) return;
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); setResult(undefined);
    try {
      const converted = await importDocument(file, schema, { signal: controller.signal, ocr, onProgress: setProgress });
      if (controller.signal.aborted || operation.current !== controller) return;
      setResult(converted); setTitle(converted.document.title);
      setCloud(hasAccount && new TextEncoder().encode(makeBackup({ ...converted.document, id: 'import', updated: 0 })).length <= 1024 * 1024);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo convertir el documento. Comprueba el archivo e inténtalo de nuevo.');
    } finally { if (operation.current === controller) { setBusy(false); setProgress(''); } }
  }
  function confirm() {
    if (!result) return;
    try { onImport({ ...result.document, title: title.trim() || result.document.title }, cloud && !overCloudLimit); }
    catch (e) { setError(e instanceof DOMException && e.name === 'QuotaExceededError' ? 'No queda espacio en este navegador. Exporta tus documentos y libera espacio antes de importar.' : e instanceof Error ? e.message : 'No se pudo guardar el documento.'); }
  }
  return <div className="document-import">
    <h2 id="modal-title">Tus documentos, ahora en Texla.</h2>
    <p>Importa, revisa y sigue escribiendo. Después puedes descargar tu documento en LaTeX desde Exportar.</p>
    <label className={`import-drop ${busy ? 'is-busy' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) select(event.dataTransfer.files[0]); }}>
      <FileUp size={30}/><strong>{file ? file.name : 'Elige un archivo o arrástralo aquí'}</strong>
      <span>Word · PDF · OpenDocument · Markdown · Texto · HTML · LaTeX · Texla</span>
      <span className="import-choose">Seleccionar archivo</span><input type="file" aria-label="Archivo para importar" accept={IMPORT_ACCEPT} disabled={busy} onChange={event => { select(event.target.files?.[0]); event.target.value = ''; }}/>
      <small>Hasta 20 MB por archivo · PDF de hasta 100 páginas</small>
    </label>
    {isPDF && <div className="import-pdf-note"><label><input type="checkbox" checked={ocr} disabled={busy} onChange={event => { setOCR(event.target.checked); setResult(undefined); }}/><span>Reconocer páginas escaneadas (OCR)</span></label><p>Español e inglés. Descarga el motor de reconocimiento la primera vez y puede tardar varios minutos. Las fórmulas y tablas del PDF requieren revisión manual.</p></div>}
    {busy && <div className="import-progress" role="status"><LoaderCircle size={18}/><span>{progress || 'Convirtiendo…'}</span><button onClick={() => { operation.current?.abort(); setBusy(false); setProgress(''); }}>Cancelar</button></div>}
    {!busy && !result && <button className="primary-button" disabled={!file} onClick={() => void convert()}>Convertir documento <ArrowRight size={16}/></button>}
    {result && <div className="import-review">
      <div className="import-ready"><Check size={16}/><strong>Conversión preparada</strong><span>{result.pages ? `${result.pages} páginas · ` : ''}{Math.ceil(bytes / 1024)} KB</span></div>
      <label className="field-label">Nombre del documento importado<input value={title} maxLength={500} onChange={event => setTitle(event.target.value)}/></label>
      {result.warnings.length > 0 && <div className="import-warnings"><strong>Revisa estos elementos</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      <details className="import-preview" open><summary>Vista previa del texto recuperado</summary><pre>{documentText(result.document.content).slice(0,4000)}{documentText(result.document.content).length > 4000 ? '\n… Vista previa abreviada; se importará el contenido completo.' : ''}</pre></details>
      {hasAccount && <label className="import-cloud"><input type="checkbox" checked={cloud && !overCloudLimit} disabled={overCloudLimit} onChange={event => setCloud(event.target.checked)}/>Guardar también en mi cuenta</label>}
      {hasAccount && overCloudLimit && <p className="import-limit">Supera 1 MiB, el límite por documento de tu cuenta. Puedes abrirlo en este navegador y dividirlo antes de guardarlo en la nube.</p>}
      <div className="modal-footer"><button className="text-button" onClick={() => { setResult(undefined); setError(''); }}>Volver a convertir</button><button className="primary-button" onClick={confirm}>Crear documento editable <ArrowRight size={16}/></button></div>
    </div>}
    {error && <p className="import-error" role="alert">{error}</p>}
    <p className="privacy-note">La conversión se realiza en este navegador, sin enviar el archivo a una IA. Se crea un documento nuevo. {hasAccount ? 'El contenido convertido se sube a tu cuenta solo si eliges guardarlo allí.' : 'Conserva el archivo original y una copia editable de Texla.'}</p>
  </div>;
}
