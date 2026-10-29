import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Plus, Search, ArrowRight, ExternalLink, LoaderCircle, Pencil } from 'lucide-react';
import DOMPurify from 'dompurify';
import { normalizeReferenceLink, type Reference } from './references';
import { lookupDoi, missingMetadata } from './doi';
import { formatReferences, parseAuthors, STYLE_LABELS, type CitationStyle } from './citationStyles';

type Props = { library: Reference[]; cited: Reference[]; style: CitationStyle; onStyleChange: (style: CitationStyle) => void; onInsert: (reference: Reference) => void; onSave: (reference: Reference) => void };
const emptyFields = { link: '', title: '', authors: '', year: '', journal: '', journalAbbreviation: '', volume: '', issue: '', pages: '', articleNumber: '', publisher: '', type: 'article-journal', group:'' };
export default function ReferenceManager({ library, cited, style, onStyleChange, onInsert, onSave }: Props) {
  const [fields, setFields] = useState(emptyFields); const [metadata, setMetadata] = useState<Reference | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null); const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  let identity: ReturnType<typeof normalizeReferenceLink> | undefined;
  try { if (fields.link.trim()) identity = normalizeReferenceLink(fields.link); } catch { /* Show validation on submit. */ }
  const existing = identity ? library.find(r => r.id === identity!.id) : undefined;
  const duplicate = existing && editing !== existing.id;
  function cancelLookup() { sequence.current++; pending.current?.abort(); setLoading(false); }
  function setField(key: keyof typeof emptyFields, value: string) {
    if (key === 'link') {
      cancelLookup(); setEditing(null); setError(''); setNotice('');
      if (metadata) { setMetadata(null); setFields({ ...emptyFields, link: value }); return; }
    }
    setFields(prev => ({ ...prev, [key]: value }));
  }
  function load(r: Reference) {
    setMetadata(r);
    setFields({ link: r.url, title: r.title, authors: r.authors, year: r.year, journal: r.journal || '', journalAbbreviation: r.journalAbbreviation || '', volume: r.volume || '', issue: r.issue || '', pages: r.pages || '', articleNumber: r.articleNumber || '', publisher: r.publisher || '', type: r.type || 'webpage', group:r.group || '' });
  }
  async function searchDoi() {
    cancelLookup(); setError(''); setNotice('');
    const controller = new AbortController(); pending.current = controller;
    const ticket = sequence.current; setLoading(true);
    try {
      const result = await lookupDoi(fields.link, controller.signal);
      if (sequence.current !== ticket) return;
      load(result); setEditing(library.some(r => r.id === result.id) ? result.id : null);
      const missing = missingMetadata(result);
      setNotice(`Datos recuperados de ${result.source}. Revisa la información antes de guardar.${missing.length ? ` Faltan: ${missing.join(', ')}.` : ''}`);
    } catch (e) { if (sequence.current === ticket && !controller.signal.aborted) setError((e as Error).message); }
    finally { if (sequence.current === ticket) setLoading(false); }
  }
  function submit(insert: boolean) {
    setError(''); setNotice('');
    try {
      const normalized = normalizeReferenceLink(fields.link);
      if (existing && editing !== existing.id) { if (insert) onInsert(existing); else setNotice('Esta fuente ya está guardada. Puedes citarla desde tu biblioteca.'); return; }
      if (!fields.title.trim()) { setError('Añade el título de la fuente para identificarla en la bibliografía.'); return; }
      if (fields.year && !/^\d{4}$/.test(fields.year.trim())) { setError('Escribe el año con cuatro cifras o déjalo vacío.'); return; }
      const reference: Reference = { ...(metadata || {}), ...normalized, title: fields.title.trim(), authors: fields.authors.trim(), year: fields.year.trim(),
        people: metadata && fields.authors === metadata.authors ? metadata.people : parseAuthors(fields.authors),
        issued: metadata && fields.year === metadata.year ? metadata.issued : fields.year ? [Number(fields.year)] : [],
        group: fields.group === 'primary' || fields.group === 'complementary' ? fields.group : undefined, type: fields.type, journal: fields.journal.trim(), journalAbbreviation: fields.journalAbbreviation.trim(), volume: fields.volume.trim(), issue: fields.issue.trim(), pages: fields.pages.trim(), articleNumber: fields.articleNumber.trim(), publisher: fields.publisher.trim(), doi: normalized.id.startsWith('doi:') ? normalized.id.slice(4) : undefined };
      if (insert) onInsert(reference);
      else { onSave(reference); setNotice(editing ? 'Referencia actualizada en todo el documento.' : 'Fuente guardada en tu biblioteca.'); setFields(emptyFields); setMetadata(null); setEditing(null); }
    } catch (e) { setError((e as Error).message); }
  }
  return <div className="reference-manager">
    <h2 id="modal-title">Cada idea, con su fuente.</h2>
    <div className="citation-style-picker"><label>Estilo del documento<select aria-label="Estilo bibliográfico" value={style} onChange={e => onStyleChange(e.target.value as CitationStyle)}>{Object.entries(STYLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><small>{style === 'apa' ? 'Autor y año en el texto · bibliografía alfabética.' : style === 'ieee' ? 'Citas [1] y bibliografía por primera aparición.' : 'Variante NLM: citas (1) y bibliografía por primera aparición.'} Convenciones en inglés según el estilo CSL.</small></div>
    <label className="field-label">Enlace o DOI<input autoFocus value={fields.link} onChange={e => setField('link', e.target.value)} placeholder="https://doi.org/10.… o enlace de la fuente"/></label>
    <button className="doi-search" disabled={loading || !fields.link.trim()} onClick={searchDoi}>{loading ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} {loading ? 'Buscando en los registros…' : 'Buscar datos por DOI'}</button>
    {duplicate ? <div className="reference-duplicate" role="status"><Check size={17}/><div><strong>Esta fuente ya existe</strong><span>{existing.title}</span><small>Reutilizaremos la referencia sin duplicarla.</small></div></div> : <><label className="field-label">Grupo bibliográfico (UTEC)<select value={fields.group} onChange={event=>setField('group',event.target.value)}><option value="">Sin clasificar</option><option value="primary">Referencia primaria</option><option value="complementary">Referencia complementaria</option></select></label><div className="reference-fields"><label className="field-label">Título de la fuente<input disabled={loading} value={fields.title} onChange={e => setField('title', e.target.value)} placeholder="Título del artículo, libro o página"/></label><div><label className="field-label">Autoría <span>(opcional)</span><input disabled={loading} value={fields.authors} onChange={e => setField('authors', e.target.value)} placeholder="García, Ana; Pérez, Luis"/></label><label className="field-label">Año <span>(opcional)</span><input disabled={loading} value={fields.year} onChange={e => setField('year', e.target.value)} inputMode="numeric" maxLength={4} placeholder="2026"/></label></div><small className="author-hint">Separa autores con punto y coma: Apellidos, Nombres; Apellidos, Nombres. Para instituciones, escribe el nombre completo.</small>
      <details className="reference-details"><summary>Datos de publicación{metadata?.source ? ` · ${metadata.source}` : ''}</summary><label className="field-label">Tipo de fuente<select value={fields.type} disabled={loading} onChange={e => setField('type', e.target.value)}><option value="article-journal">Artículo de revista</option><option value="book">Libro</option><option value="chapter">Capítulo de libro</option><option value="paper-conference">Artículo de congreso</option><option value="webpage">Página web</option><option value="report">Informe</option><option value="thesis">Tesis</option><option value="dataset">Conjunto de datos</option><option value="software">Software</option><option value="article">Prepublicación / otro artículo</option></select></label>{([['journal','Revista o publicación'],['journalAbbreviation','Abreviatura oficial de la revista'],['volume','Volumen'],['issue','Número'],['pages','Páginas'],['articleNumber','Número de artículo (sin páginas)'],['publisher','Editorial']] as const).map(([key,label]) => <label className="field-label" key={key}>{label}<input disabled={loading} value={fields[key]} onChange={e => setField(key,e.target.value)}/></label>)}<small>Si el registro no incluye la abreviatura oficial de la revista, se usa su nombre completo. Puedes corregirla aquí.</small></details></div></>}
    {error && <p className="reference-error" role="alert">{error}</p>}{notice && <p className="reference-notice" role="status">{notice}</p>}
    <div className="reference-actions"><button className="text-button" disabled={loading} onClick={() => submit(false)}><Plus size={13}/> {editing ? 'Guardar cambios' : 'Guardar fuente'}</button><button className="primary-button" disabled={loading} onClick={() => submit(true)}>{duplicate ? 'Citar fuente existente' : 'Guardar e insertar cita'}<ArrowRight size={15}/></button></div>
    <p className="reference-note">Consultamos Crossref y, si el DOI no está registrado allí, DataCite. Solo se envía el DOI, no tu documento. Revisa los datos recuperados: pueden estar incompletos. <a href="https://citationstyles.org/" target="_blank" rel="noopener noreferrer">Estilos CSL</a> · <a href="https://citeproc-js.readthedocs.io/" target="_blank" rel="noopener noreferrer">citeproc-js © Frank Bennett</a> · <a href={`${import.meta.env.BASE_URL}licenses/NOTICE.txt`} target="_blank" rel="noopener noreferrer">Licencias</a>.</p>
    <div className="reference-library-heading"><h3><BookOpen size={16}/> Biblioteca del documento <span>{library.length}</span></h3><label><Search size={14}/><input aria-label="Buscar referencia" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título, autor o enlace"/></label></div>
    <div className="reference-library">{library.filter(r => `${r.title} ${r.authors} ${r.url}`.toLowerCase().includes(query.toLowerCase())).map(r => {
      const index = cited.findIndex(c => c.id === r.id);
      return <div className="reference-entry" key={r.id}><span className="reference-entry-number">{index >= 0 ? style === 'apa' ? '•' : `${index + 1}` : '—'}</span><div><strong>{r.title}</strong><small>{[r.authors, r.year].filter(Boolean).join(' · ') || 'Sin autoría ni fecha'}</small><a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}<ExternalLink size={10}/></a><span className="reference-use">{index < 0 ? 'Sin citar · disponible para reutilizar' : 'Incluida en la bibliografía'}</span></div><div className="reference-entry-actions"><button className="reference-cite" onClick={() => onInsert(r)} aria-label={`Citar ${r.title}`}>Citar <Plus size={13}/></button><button className="reference-cite" onClick={() => { cancelLookup(); setError(''); setNotice(''); load(r); setEditing(r.id); }} aria-label={`Editar ${r.title}`}><Pencil size={12}/> Editar</button></div></div>;
    })}{library.length === 0 && <div className="reference-empty"><BookOpen size={22}/><p>Tu biblioteca comienza con una fuente.</p><span>Añade su DOI arriba para buscar tu primera referencia.</span></div>}{library.length > 0 && !library.some(r => `${r.title} ${r.authors} ${r.url}`.toLowerCase().includes(query.toLowerCase())) && <p className="muted">No encontramos referencias con esa búsqueda.</p>}</div>
  </div>;
}
export function Bibliography({ references, style }: { references: Reference[]; style: CitationStyle }) {
  if (!references.length) return null;
  const formatted = formatReferences(references, style);
  return <section className={`bibliography csl-bibliography style-${style} ${formatted.hangingIndent ? 'hanging-indent' : ''}`} style={{ '--bib-line-spacing': formatted.lineSpacing } as React.CSSProperties} aria-label="Bibliografía"><h2>Referencias</h2><div className="csl-entries" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.html, { ALLOWED_TAGS: ['div','span','i','b','em','strong','a','sup','sub'], ALLOWED_ATTR: ['class','href','style'] }) }}/></section>;
}
