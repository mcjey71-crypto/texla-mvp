import { useState } from 'react';
import { BookOpen, Check, Plus, Search, ArrowRight, ExternalLink } from 'lucide-react';
import { normalizeReferenceLink, type Reference } from './references';

type Props = { library: Reference[]; cited: Reference[]; onInsert: (reference: Reference) => void; onSave: (reference: Reference) => void };
export default function ReferenceManager({ library, cited, onInsert, onSave }: Props) {
  const [link, setLink] = useState(''); const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState(''); const [year, setYear] = useState('');
  const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  let identity: ReturnType<typeof normalizeReferenceLink> | undefined;
  try { if (link.trim()) identity = normalizeReferenceLink(link); } catch { /* Show validation on submit. */ }
  const existing = identity ? library.find(r => r.id === identity!.id) : undefined;
  function submit(insert: boolean) {
    setError(''); setNotice('');
    try {
      const normalized = normalizeReferenceLink(link);
      const duplicate = library.find(r => r.id === normalized.id);
      if (duplicate) { if (insert) onInsert(duplicate); else setNotice('Esta fuente ya está guardada. Puedes citarla desde tu biblioteca.'); return; }
      if (!title.trim()) { setError('Añade el título de la fuente para identificarla en la bibliografía.'); return; }
      if (year && !/^\d{4}$/.test(year.trim())) { setError('Escribe el año con cuatro cifras o déjalo vacío.'); return; }
      const reference: Reference = { ...normalized, title: title.trim(), authors: authors.trim(), year: year.trim() };
      if (insert) onInsert(reference);
      else { onSave(reference); setNotice('Fuente guardada en tu biblioteca.'); setLink(''); setTitle(''); setAuthors(''); setYear(''); }
    } catch (e) { setError((e as Error).message); }
  }
  return <div className="reference-manager">
    <h2 id="modal-title">Cada idea, con su fuente.</h2>
    <p>Las citas se numeran por orden de aparición. Una misma fuente conserva el mismo número en todo el documento.</p>
    <label className="field-label">Enlace o DOI<input autoFocus value={link} onChange={e => { setLink(e.target.value); setError(''); setNotice(''); }} placeholder="https://doi.org/10.… o enlace de la fuente"/></label>
    {existing ? <div className="reference-duplicate" role="status"><Check size={17}/><div><strong>Esta fuente ya existe</strong><span>{existing.title}</span><small>Reutilizaremos la referencia sin duplicarla.</small></div></div> : <div className="reference-fields"><label className="field-label">Título de la fuente<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del artículo, libro o página"/></label><div><label className="field-label">Autoría <span>(opcional)</span><input value={authors} onChange={e => setAuthors(e.target.value)} placeholder="Apellidos, nombres o institución"/></label><label className="field-label">Año <span>(opcional)</span><input value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" maxLength={4} placeholder="2026"/></label></div></div>}
    {error && <p className="reference-error" role="alert">{error}</p>}{notice && <p className="reference-notice" role="status">{notice}</p>}
    <div className="reference-actions"><button className="text-button" onClick={() => submit(false)}><Plus size={13}/> Guardar fuente</button><button className="primary-button" onClick={() => submit(true)}>{existing ? 'Citar fuente existente' : 'Guardar e insertar cita'}<ArrowRight size={15}/></button></div>
    <p className="reference-note">El enlace identifica duplicados; no verifica la calidad de la fuente ni completa sus datos automáticamente. DOI y enlaces de editoriales distintos pueden requerir revisión manual.</p>
    <div className="reference-library-heading"><h3><BookOpen size={16}/> Biblioteca del documento <span>{library.length}</span></h3><label><Search size={14}/><input aria-label="Buscar referencia" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título, autor o enlace"/></label></div>
    <div className="reference-library">{library.filter(r => `${r.title} ${r.authors} ${r.url}`.toLowerCase().includes(query.toLowerCase())).map(r => {
      const index = cited.findIndex(c => c.id === r.id);
      return <div className="reference-entry" key={r.id}><span className="reference-entry-number">{index >= 0 ? `[${index + 1}]` : '—'}</span><div><strong>{r.title}</strong><small>{[r.authors, r.year].filter(Boolean).join(' · ') || 'Sin autoría ni fecha'}</small><a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}<ExternalLink size={10}/></a><span className="reference-use">{index < 0 ? 'Sin citar · disponible para reutilizar' : 'Incluida en la bibliografía'}</span></div><button className="reference-cite" onClick={() => onInsert(r)} aria-label={`Citar ${r.title}`}>Citar <Plus size={13}/></button></div>;
    })}{library.length === 0 && <div className="reference-empty"><BookOpen size={22}/><p>Tu biblioteca comienza con una fuente.</p><span>Añade su enlace arriba para guardar tu primera referencia.</span></div>}{library.length > 0 && !library.some(r => `${r.title} ${r.authors} ${r.url}`.toLowerCase().includes(query.toLowerCase())) && <p className="muted">No encontramos referencias con esa búsqueda.</p>}</div>
  </div>;
}

export function Bibliography({ references }: { references: Reference[] }) {
  if (!references.length) return null;
  return <section className="bibliography" aria-label="Bibliografía"><h2>Referencias</h2><ol>{references.map((r, index) => <li key={r.id}><span className="bibliography-number">[{index + 1}]</span><div>{r.authors && <span>{r.authors}. </span>}<cite>{r.title}</cite>{r.year && <span>. {r.year}</span>}. <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a></div></li>)}</ol></section>;
}
