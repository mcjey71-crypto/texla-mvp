import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Fragment, Slice } from '@tiptap/pm/model';
import { readMathClipboard, mathPasteText } from './mathClipboard';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MappablePosition } from '@tiptap/core';
import type { Session } from '@supabase/supabase-js';
import { useAccount } from './useAccount';
import { useCloudSave } from './useCloudSave';
import { accountClient } from './supabase';
import AccountPanel from './AccountPanel';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { SharedSession } from './SharedSession';
import ShareDocument, { participantName } from './ShareDocument';
import { readShareLink, validAccess } from '../shared/collaboration';
import Mathematics from '@tiptap/extension-mathematics';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import katex from 'katex';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { SectionNumbering, TableOfContents, PageBreak, BibliographyAnchor, hasBibliographyAnchor, documentHeadings } from './DocumentStructure';
import SearchDocument, { DocumentSearch } from './SearchDocument';
import { FormatControls, InsertTable, TableControls } from './DocumentTools';
import { resolveFormat, createTemplate, TEMPLATES, type TemplateId, type DocumentFormat } from './formalDocument';
import { makeBackup, readBackup, MAX_BACKUP_BYTES, type SavedDocument } from './backup';
const MathInput = lazy(() => import('./MathInput'));
const ImportDocument = lazy(() => import('./ImportDocument'));
import type { ImportedDocument } from './import/common';
import { FONTS, fontDefinition, type DocumentFont } from './fonts';
import { pageFormat, printPageSize } from './pageFormats';
import TemplatePicker from './TemplatePicker';
import { applySharedDocument, joinSharedDocument, sameSharedDocument } from './sharedDocumentIdentity';
import { cloudFingerprint } from './cloudDocuments';
import { ArrowDownToLine, ArrowRight, Bold, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Clipboard, Code2, FileText, FolderOpen, Italic, LayoutTemplate, List, ListOrdered, Menu, MoreHorizontal, PanelLeftClose, Plus, Redo2, Search, Settings2, Sparkles, Underline, Undo2, X, AlignLeft, AlignCenter, AlignRight, AlignJustify, Sigma, CheckCheck, ExternalLink, Maximize2 } from 'lucide-react';
import { resolveStyle, type CitationStyle } from './citationStyles';
import { Citation } from './Citation';
import ReferenceManager, { Bibliography } from './ReferenceManager';
import { citedReferences, mergeReferenceLibrary, type Reference } from './references';
import { EquationNumbering } from './EquationNumbering';
import { initialContent, parseMathText, exportLatex, type DocNode } from './document';

type Document = SavedDocument;
type Modal = 'new' | 'paste' | 'equation' | 'export' | 'help' | 'templates' | 'references' | 'table' | 'format' | 'backup' | 'share' | 'account' | 'import' | null;
const STORAGE = 'texla-docs-v1';
function readDocs(storage = STORAGE): Document[] { try { const data = JSON.parse(localStorage.getItem(storage) || 'null'); if (Array.isArray(data) && data.length && data.every(d => typeof d.id === 'string' && typeof d.title === 'string' && d.content?.type === 'doc')) return data; } catch {} return [{ id: 'welcome', title: 'El lenguaje del universo', content: initialContent, updated: Date.now() }]; }
function Logo({ small = false }: { small?: boolean }) { return <div className={`logo ${small ? 'small' : ''}`}><svg className="logo-monogram" viewBox="0 0 44 48" fill="currentColor" aria-label="Texla: pluma y precisión"><path d="M3 4h38v14c-3-8-7-10-14-10v12c0 7 5 11 10 14-9 1-13 5-14 13h-2c-1-8-5-12-14-13 5-3 10-7 10-14V8C10 8 6 10 3 18z"/><path d="M22 23c1 6 3 9 7 11-4 2-6 5-7 10-1-5-3-8-7-10 4-2 6-5 7-11" fill="#203f32"/></svg>{!small && <span className="wordmark">texla<span>DOCS</span></span>}</div>; }
const examples = [{ name: 'Fracción', tex: '\\frac{a}{b}' }, { name: 'Raíz', tex: '\\sqrt{x}' }, { name: 'Potencia', tex: 'x^{2}' }, { name: 'Integral', tex: '\\int_{a}^{b} f(x)\\,dx' }, { name: 'Sumatoria', tex: '\\sum_{n=1}^{\\infty} a_n' }, { name: 'Euler', tex: 'e^{i\\pi}+1=0' }];
function MathPreview({ value }: { value: string }) { let html = ''; try { html = katex.renderToString(value, { throwOnError: true, displayMode: true, trust: false }); } catch { return <p className="math-error">Revisa la expresión para mostrar su vista previa.</p>; } return <div className="math-preview" dangerouslySetInnerHTML={{ __html: html }} />; }

export default function App() {
 const account = useAccount();
 if (account.loading) return <div className="account-loading" role="status">Preparando tu espacio de Texla…</div>;
 return <Workspace key={account.session?.user.id || 'device'} authSession={account.session} authError={account.error}/>;
}
function Workspace({authSession, authError}: {authSession: Session | null; authError: string}) {
 const storageKey = authSession ? `texla-account-docs-v1:${authSession.user.id}` : STORAGE;
 const [docs, replaceDocs] = useState<Document[]>(() => readDocs(storageKey));
 const setDocs: Dispatch<SetStateAction<Document[]>> = useCallback(update => replaceDocs(previous => {
   const next = typeof update === 'function' ? update(previous) : update;
   return next.map(doc => {
     const old = previous.find(item => item.id === doc.id);
     return doc.cloud && old && old !== doc && old.cloud?.revision === doc.cloud.revision && cloudFingerprint(old) !== cloudFingerprint(doc) ? {...doc, cloud: {...doc.cloud, dirty: true}} : doc;
   });
 }), []);
 const cloudSave = useCloudSave(authSession, docs, setDocs);
 const [activeId, setActiveId] = useState(docs[0].id);
 const [editorRevision, setEditorRevision] = useState(0);
 const latestDocs = useRef(docs); latestDocs.current = docs;
 const active = docs.find(d => d.id === activeId) || docs[0];
 const [modal, setModal] = useState<Modal>(null); const [tab, setTab] = useState<'edit'|'latex'>('edit'); const [rightTab, setRightTab] = useState<'outline'|'design'>('outline');
 const [search, setSearch] = useState(''); const [title, setTitle] = useState(''); const [paste, setPaste] = useState(''); const [equation, setEquation] = useState(''); const [eqPos, setEqPos] = useState<number | null>(null); const [eqType, setEqType] = useState('blockMath'); const [toast, setToast] = useState(''); const [pasteNotice,setPasteNotice] = useState(''); const [saved, setSaved] = useState(true); const [storageError, setStorageError] = useState(false); const [zoom, setZoom] = useState('100'); const [sidebar, setSidebar] = useState(false); const [searchOpen, setSearchOpen] = useState(false); const [importError, setImportError] = useState('');
 const [sessionState, setSession] = useState<SharedSession | null>(null);
 const session = sessionState && sameSharedDocument(sessionState.access, active.shared) ? sessionState : null;
 const [, refreshSession] = useState(0);
 const sharedReady = !!session?.ready;
 const equationTarget = useRef<{position: MappablePosition; original: string; removed: boolean} | null>(null);
 const format = resolveFormat(active.format); const pageSize = format.pageSize;
 const formatRef = useRef(format); formatRef.current = format;
 const activeRef = useRef(activeId); activeRef.current = activeId;
 const styleRef = useRef(resolveStyle(active.citationStyle)); styleRef.current = resolveStyle(active.citationStyle);
 const libraryRef = useRef(active.references || []); libraryRef.current = active.references || [];
 const editor = useEditor({ shouldRerenderOnTransaction: true, extensions: [StarterKit.configure({ undoRedo: session && sharedReady ? false : {} }), ...(session && sharedReady ? [Collaboration.configure({ document: session.doc }), CollaborationCaret.configure({ provider: session, user: { name: participantName(), color: '#376e53' } })] : []), EquationNumbering, DocumentSearch, PageBreak, BibliographyAnchor.configure({getLibrary:()=>libraryRef.current,getStyle:()=>styleRef.current,getGrouped:()=>formatRef.current.bibliographyGroups}), SectionNumbering.configure({ isNumbered: () => formatRef.current.numberedSections, isChapter: () => formatRef.current.sectionStyle === 'chapters' }), TableOfContents.configure({ isNumbered: () => formatRef.current.numberedSections }), Table.configure({ resizable: false, renderWrapper: true }), TableRow, TableCell.extend({content: '(paragraph|bulletList|orderedList|blockquote|blockMath)+'}), TableHeader.extend({content: '(paragraph|bulletList|orderedList|blockquote|blockMath)+'}), Citation.configure({ getStyle: () => styleRef.current, getLibrary: () => libraryRef.current }), Placeholder.configure({ placeholder: 'Deja que tus ideas tomen forma…' }), TextAlign.configure({ types: ['heading', 'paragraph'] }), Mathematics.configure({ katexOptions: { throwOnError: false, trust: false }, blockOptions: { onClick: (node, pos) => editEquation(node.attrs.latex, pos, 'blockMath') }, inlineOptions: { onClick: (node, pos) => editEquation(node.attrs.latex, pos, 'inlineMath') } })], content: session && sharedReady ? undefined : active.content, editable: !active.shared || sharedReady,
  onTransaction: ({ editor, transaction }) => { if (equationTarget.current && transaction.docChanged) { const result = editor.utils.getUpdatedPosition(equationTarget.current.position, transaction); equationTarget.current.position = result.position; if (result.mapResult?.deleted) equationTarget.current.removed = true; } },
  onUpdate: ({ editor }) => { if (active.shared && !sharedReady) return; setSaved(false); const content = editor.getJSON() as DocNode; setDocs(prev => prev.map(d => d.id === activeRef.current ? { ...d, content, references: mergeReferenceLibrary(d.references || [], content), updated: Date.now() } : d)); },
  editorProps: { attributes: { spellcheck: 'true', 'aria-label': 'Contenido del documento' }, handlePaste: (view, event) => {
    if(!event.clipboardData) return false;
    try {
      const result=readMathClipboard(event.clipboardData,view.state.schema); if(!result) return false;
      const nodes=(result.document.content||[]).map(node=>view.state.schema.nodeFromJSON(node));
      nodes.forEach(node=>node.check());
      event.preventDefault();view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(Fragment.fromArray(nodes))).scrollIntoView());
      setPasteNotice(result.warnings.join(' '));return true;
    } catch(error) { event.preventDefault();setPasteNotice(error instanceof Error?error.message:'No se pudo convertir el contenido copiado.');return true; }
  } }
 }, [activeId, session, sharedReady, editorRevision]);
 useEffect(() => {
   if (!active.shared || !validAccess(active.shared)) { setSession(null); return; }
   const session = new SharedSession(active.shared); setSession(session);
   let lastMetadata = '';
   const unsubscribe = session.subscribe(() => {
     refreshSession(n => n + 1);
     if (session.ready) {
       const snapshot = session.snapshot();
       const serialized = JSON.stringify(snapshot);
       if (serialized !== lastMetadata) { lastMetadata = serialized; setDocs(prev => prev.map(d => d.id === activeId ? { ...d, ...snapshot, updated: Date.now() } : d)); }
     }
   });
   void session.start();
   return () => { unsubscribe(); session.destroy(); };
 }, [activeId, active.shared?.token]);
 useEffect(() => {
   function join() {
     try {
       const access = readShareLink(window.location.hash); if (!access) return;
       const joined = joinSharedDocument(latestDocs.current, access);
       setDocs(joined.documents);
       setActiveId(joined.document.id); setTab('edit'); setSidebar(false); setSearchOpen(false); setModal(null);
       // Remove the bearer capability from the address bar after opening the document.
       history.replaceState(null, '', window.location.pathname + window.location.search);
     } catch (e) { setToast(e instanceof Error ? e.message : 'Enlace no válido.'); }
   }
   join(); window.addEventListener('hashchange', join); return () => window.removeEventListener('hashchange', join);
 }, []);
 useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('bibliographyRefresh', true)); }, [active.citationStyle, active.references, active.format, editor]);
 function editEquation(tex: string, pos: number, type: string) { equationTarget.current = editor ? {position: editor.utils.createMappablePosition(pos), original: tex, removed: false} : null; setEquation(tex); setEqPos(pos); setEqType(type); setModal('equation'); }
 useEffect(() => { const timer = setTimeout(() => { try { localStorage.setItem(storageKey, JSON.stringify(docs)); setSaved(true); setStorageError(false); } catch { setStorageError(true); } }, 400); return () => clearTimeout(timer); }, [docs]);
 useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
 useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(null); setSidebar(false); setSearchOpen(false); } if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h')) { e.preventDefault(); setTab('edit'); setSearchOpen(true); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
 function openDocument(d: Document) { setPasteNotice(''); equationTarget.current = null; activeRef.current = d.id; setActiveId(d.id); setTab('edit'); setSidebar(false); setSearchOpen(false); }
 useEffect(() => () => { try { localStorage.setItem(storageKey, JSON.stringify(latestDocs.current)); } catch { /* The visible storage warning and downloadable backups remain available. */ } }, [storageKey]);
 useEffect(() => { if (authError) setToast(authError); }, [authError]);
 function forAccount(doc: Document): Document { return authSession && !doc.shared ? {...doc, cloud: {ownerId: authSession.user.id, revision: 0, dirty: true}} : doc; }
 function copyToAccount(doc: Document, resolveConflict = false) {
   if (!authSession) return;
   const base = readBackup(makeBackup(doc));
   const copy = forAccount({...base, title: resolveConflict ? `${base.title.slice(0, 480)} (mi copia)` : base.title, id: crypto.randomUUID(), updated: Date.now()});
   setDocs(prev => [...(resolveConflict ? prev.filter(item => item.id !== doc.id) : prev), copy]); openDocument(copy); setModal(null); setToast('Copia privada preparada. Se guardará en tu cuenta.');
 }
 function openCloudDocument(doc: Document) {
   const existing = docs.find(item => item.id === doc.id);
   if (existing?.cloud?.dirty && !sameSharedDocument(existing.shared,doc.shared)) throw new Error('Hay cambios pendientes en este navegador. Guárdalos o conserva una copia antes de abrir la versión de la nube.');
   editor?.schema.nodeFromJSON(doc.content).check();
   setDocs(prev => [...prev.filter(item => item.id !== doc.id && !sameSharedDocument(item.shared,doc.shared)), doc]); setEditorRevision(value => value + 1); openDocument(doc); setModal(null);
 }
 async function signOut() { const {error} = await accountClient!.auth.signOut({scope:'local'}); if(error) throw error; }
 function createDocument(template?: TemplateId) {
   const base = template ? createTemplate(template) : { title: title.trim() || 'Documento sin título', format: resolveFormat(), content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title.trim() || 'Una nueva idea' }] }, { type: 'paragraph' }] } };
   const d: Document = forAccount({ ...base, id: crypto.randomUUID(), updated: Date.now() }); setDocs(prev => [...prev, d]); openDocument(d); setModal(null); setTitle(''); setToast('Tu nuevo documento está listo');
 }
 function updateFormat(patch: Partial<DocumentFormat>) { if (session) session.doc.transact(() => { for (const [key, value] of Object.entries(patch)) session.metadata.set(`format.${key}`, value); }); setSaved(false); setDocs(prev => prev.map(d => d.id === activeRef.current ? { ...d, format: resolveFormat({ ...resolveFormat(d.format), ...patch }), updated: Date.now() } : d)); }
 function insertContents() {
   if (!editor) return; let existing: number | undefined;
   editor.state.doc.descendants((node,pos)=>{if(node.type.name==='tableOfContents') existing=pos;});
   setTab('edit');
   if(existing !== undefined) { editor.chain().setNodeSelection(existing).scrollIntoView().run(); setToast('Este documento ya tiene un índice automático'); return; }
   const firstSection = documentHeadings(editor.state.doc).find(h=>h.level>=2);
   editor.chain().focus().insertContentAt(firstSection?.pos ?? editor.state.doc.content.size,{type:'tableOfContents'}).run();
 }
 function printDocument() { setModal(null); setTab('edit'); requestAnimationFrame(()=>requestAnimationFrame(()=>window.print())); }
 function downloadBackup() {
   const url=URL.createObjectURL(new Blob([makeBackup(active)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${active.title.replace(/[^\p{L}\p{N} -]/gu,'')||'documento'}.texla.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('Copia editable descargada');
 }
 function addImportedDocument(imported: ImportedDocument, cloud: boolean) {
   const content = editor!.schema.nodeFromJSON(imported.content); content.check();
   const base: Document = {...imported, content: content.toJSON(), id: crypto.randomUUID(), updated: Date.now()};
   const doc = cloud ? forAccount(base) : base;
   const next = [...latestDocs.current, doc];
   localStorage.setItem(storageKey, JSON.stringify(next));
   setDocs(next); openDocument(doc); setModal(null); setToast('Documento importado. Ya puedes editarlo y exportarlo a LaTeX.');
 }
 async function importBackup(file?: File) {
   setImportError(''); if(!file || !editor) return;
   try {
     if(file.size>MAX_BACKUP_BYTES)throw new Error('La copia supera el límite de 5 MB.');
     const restored=readBackup(await file.text());const content=editor.schema.nodeFromJSON(restored.content);content.check();
     const d:Document=forAccount({...restored,content:content.toJSON(),id:crypto.randomUUID(),updated:Date.now()});const next=[...docs,d];
     localStorage.setItem(storageKey,JSON.stringify(next));setDocs(next);openDocument(d);setModal(null);setToast('Copia abierta como un documento nuevo');
   } catch(e) {setImportError(e instanceof DOMException && e.name==='QuotaExceededError' ? 'No queda espacio en este navegador. Conserva la copia descargada.' : e instanceof Error ? `No se importó la copia: ${e.message}` : 'No se pudo importar esta copia.');}
 }

 const citationStyle = resolveStyle(active.citationStyle);
 function changeCitationStyle(style: CitationStyle) { session?.metadata.set('citationStyle', style); setSaved(false); setDocs(prev => prev.map(d => d.id === activeId ? { ...d, citationStyle: style, updated: Date.now() } : d)); }
 const references = mergeReferenceLibrary(active.references || [], active.content);
 const cited = citedReferences(active.content, references);
 function saveReference(reference: Reference) {
   session?.references.set(reference.id, reference);
   setSaved(false);
   setDocs(prev => prev.map(d => d.id === activeRef.current ? { ...d, references: [...mergeReferenceLibrary(d.references || [], d.content).filter(r => r.id !== reference.id), reference], updated: Date.now() } : d));
   if (editor) { const tr = editor.state.tr; editor.state.doc.descendants((node, pos) => { if (node.type.name === 'citation' && node.attrs.reference?.id === reference.id && JSON.stringify(node.attrs.reference) !== JSON.stringify(reference)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, reference }); }); if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false)); }
 }
 function insertReference(reference: Reference) {
   saveReference(reference);
   editor?.chain().focus().insertContent({ type: 'citation', attrs: { reference } }).run();
   setModal(null); setTab('edit'); setToast('Cita insertada · bibliografía actualizada');
 }
 const latex = exportLatex(active.title, active.content, references, citationStyle, format);
 function download() { const url = URL.createObjectURL(new Blob([latex], { type: 'application/x-tex' })); const a = document.createElement('a'); a.href = url; a.download = `${active.title.replace(/[^\p{L}\p{N} -]/gu, '') || 'documento'}.tex`; a.click(); URL.revokeObjectURL(url); setToast('Documento LaTeX exportado'); }
 const headings = editor ? documentHeadings(editor.state.doc) : [];
 const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0;
 function tool(label: string, Icon: typeof Bold, action: () => void, isActive = false) { return <button className={`icon-button ${isActive ? 'active' : ''}`} title={label} aria-label={label} onClick={action}><Icon size={17}/></button>; }
 function insertEquation() { try { katex.renderToString(equation, { throwOnError: true, trust: false }); } catch { setToast('La ecuación tiene un error de sintaxis'); return; } if (!equation.trim()) return; if (eqPos !== null) { const target = equationTarget.current; const pos = target?.position.position ?? eqPos; const node = editor?.state.doc.nodeAt(pos); if (!node || target?.removed || node.type.name !== eqType || (target && node.attrs.latex !== target.original)) { setToast('La ecuación cambió o fue eliminada. Vuelve a abrirla para revisar la versión actual.'); return; } editor?.commands.command(({ tr, dispatch }) => { if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex: equation }); return true; }); } else editor?.chain().focus().insertContent({ type: eqType, attrs: { latex: equation } }).run(); setModal(null); }
 const cloudStatus = active.cloud ? cloudSave.errors[active.id] ? 'No se pudo guardar en tu cuenta' : active.cloud.dirty ? 'Pendiente de guardar en tu cuenta' : 'Guardado en tu cuenta' : '';
 const sharedStatus = session ? ({ connecting: 'Conectando al documento…', synced: 'Guardado en el servidor', saving: 'Sincronizando cambios…', offline: 'Sin conexión al servidor', blocked: 'Colaboración detenida · conserva una copia' }[session.state]) : '';
 if (!editor) return null;
 return <div className="app-shell">
  <style>{`@media print { @page { size: ${printPageSize(format.pageSize)}; margin: ${format.margin}cm; @top-right { content: ${format.pageNumbers === 'top-right' ? 'counter(page)' : 'none'}; font-family: ${fontDefinition(format.fontFamily).css}; font-size: 10pt; } @bottom-center { content: ${format.pageNumbers === 'bottom' ? 'counter(page)' : 'none'}; font-family: ${fontDefinition(format.fontFamily).css}; font-size: 10pt; } } }`}</style>
  {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)}/>}
  <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
   <div className="brand-row"><Logo/>{tool('Cerrar menú', PanelLeftClose, () => setSidebar(false))}</div>
   <button className="workspace-picker" onClick={() => setModal('account')}><span className="workspace-icon">M</span><span>{authSession ? 'Mi cuenta de Texla' : 'Mi espacio personal'}<small>{authSession ? 'Documentos privados' : 'Un lugar para tus ideas'}</small></span><ChevronDown size={14}/></button>
   <button className="new-doc" onClick={() => { setTitle(''); setModal('new'); }}><Plus size={18}/> Nuevo documento <span>＋</span></button>
   <button className="nav-item import-nav" onClick={() => setModal('import')}><FolderOpen size={18}/> Importar documento</button>
   <div className="nav-section"><button className="nav-item selected" onClick={() => { setSearch(''); setSidebar(true); }}><FolderOpen size={18}/> Mis documentos <span>{docs.length}</span></button>{authSession && <button className="nav-item" onClick={() => setModal('account')}><FolderOpen size={18}/> Mi biblioteca en la nube</button>}<button className="nav-item" onClick={() => setModal('templates')}><LayoutTemplate size={18}/> Plantillas <span className="new-label">NUEVO</span></button></div>
   <div className="section-label">TU BIBLIOTECA <MoreHorizontal size={16}/></div>
   <label className="search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento…" aria-label="Buscar documento"/><kbd>⌕</kbd></label>
   <div className="document-list">{docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase())).map(d => <button key={d.id} className={`document-link ${active.id === d.id ? 'current' : ''}`} onClick={() => openDocument(d)}><FileText size={17}/><span>{d.title}<small>{d.shared ? 'Documento compartido' : d.cloud ? 'Documento de mi cuenta' : d.id === 'welcome' ? 'Tu primer documento' : 'Guardado en este dispositivo'}</small></span>{active.id === d.id && <span className="current-dot"/>}</button>)}{!docs.some(d => d.title.toLowerCase().includes(search.toLowerCase())) && <p className="no-results">No encontramos documentos.</p>}</div>
   <div className="sidebar-bottom"><div className="free-card"><span className="free-icon"><Sparkles size={18}/></span><strong>Grandes ideas. Sin límites.</strong><p>Todo lo que necesitas para escribir algo extraordinario.</p><span className="free-pill"><span/> Plan gratuito</span></div><button className="help-link" onClick={() => setModal('help')}><CircleHelp size={17}/> Guía de Texla <ExternalLink size={13}/></button><div className="profile"><div className="avatar">T</div><div>{authSession?.user.email || 'Tu espacio creativo'}<small>{authSession ? 'Cuenta gratuita' : 'Sin iniciar sesión · Gratis'}</small></div><span className="online-dot"/></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setSidebar(true)} aria-label="Abrir menú"><Menu size={20}/></button><span>Mi espacio</span><ChevronRight size={13}/><span>Documentos</span><ChevronRight size={13}/><strong>{active.title}</strong></div><button className="account-top" onClick={() => setModal('account')}>{authSession ? 'Mi cuenta' : 'Iniciar sesión'}</button></header>
   <section className="document-header"><div className="document-title"><div className="title-icon"><FileText size={23}/></div><div><input aria-label="Nombre del documento" value={active.title} disabled={!!active.shared && !sharedReady} maxLength={500} onChange={e => { session?.metadata.set('title', e.target.value); setSaved(false); setDocs(prev => prev.map(d => d.id === active.id ? { ...d, title: e.target.value } : d)); }}/><div className="save-status"><span className={storageError ? 'storage-error' : ''}><CheckCheck size={13}/>{storageError ? 'Sin espacio: exporta para conservar tus cambios' : session ? sharedStatus : cloudStatus || (saved ? 'Guardado en este navegador' : 'Guardando…')}</span><span className="status-divider">·</span><span>{session ? `${session.people.length || 1} en este documento` : 'Solo tú'}</span></div></div></div><div className="header-actions"><button className="share-button" onClick={() => setModal('share')}>Compartir</button><button className="export-button" onClick={() => setModal('export')}><ArrowDownToLine size={16}/><span>Exportar</span><ChevronDown size={14}/></button></div></section>
   <section className="editor-navigation"><div className="editor-tabs"><button className={tab === 'edit' ? 'tab selected-tab' : 'tab'} onClick={() => setTab('edit')}><FileText size={15}/> Editor visual</button><button className={tab === 'latex' ? 'tab selected-tab' : 'tab'} onClick={() => setTab('latex')}><Code2 size={16}/> LaTeX <span className="tiny-badge">AUTO</span></button></div><div className="engine"><span/> Precisión LaTeX. Cero código.</div></section>
   {active.cloud && cloudSave.errors[active.id] && <div className="cloud-warning" role="alert"><span>{cloudSave.errors[active.id].message}</span><button onClick={cloudSave.retry}>Reintentar guardado</button>{cloudSave.errors[active.id].conflict && <button onClick={() => copyToAccount(active, true)}>Guardar mis cambios como otro documento</button>}</div>}
   {session && <div className={`collaboration-status ${session.state}`} role="status"><span>{sharedStatus}{session.state === 'offline' && ' · Los cambios pendientes se enviarán al reconectar.'}</span><span className="collaborators">{session.people.map((person, index) => <span key={index} title={person.name} style={{ borderColor: person.color }}>{person.name}</span>)}</span>{session.error && <span>{session.error}</span>}{active.cloud?.dirty && <span>Acceso desde tu cuenta pendiente de guardar.</span>}{session.cacheError && <span>No se pudo activar la copia sin conexión. Descarga una copia editable.</span>}</div>}
   <div className="editing-controls" inert={!!active.shared && !sharedReady}>
   <div className="toolbar"><div className="toolbar-group">{tool('Deshacer', Undo2, () => editor.chain().focus().undo().run())}{tool('Rehacer', Redo2, () => editor.chain().focus().redo().run())}</div><div className="toolbar-group"><select aria-label="Estilo de párrafo" value={String(editor.getAttributes('heading').level || 0)} onChange={e => Number(e.target.value) ? editor.chain().focus().setHeading({ level: Number(e.target.value) as 1|2|3|4 }).run() : editor.chain().focus().setParagraph().run()}><option value="0">Texto normal</option><option value="1">Título</option><option value="2">Sección</option><option value="3">Subsección</option><option value="4">Subsubsección</option></select></div><div className="toolbar-group font-selector"><select value={format.fontFamily} aria-label="Tipografía" onChange={e => updateFormat({fontFamily:e.target.value as DocumentFont})}>{FONTS.map(font=><option key={font.id}>{font.id}</option>)}</select></div><div className="toolbar-group">{tool('Negrita', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}{tool('Cursiva', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}{tool('Subrayado', Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}</div><div className="toolbar-group alignment">{tool('Alinear a la izquierda', AlignLeft, () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}{tool('Centrar', AlignCenter, () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }))}{tool('Alinear a la derecha', AlignRight, () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }))}{tool('Justificar (Ctrl+Mayús+J)', AlignJustify, () => editor.chain().focus().setTextAlign('justify').run(), editor.isActive({ textAlign: 'justify' }))}<select className="alignment-select" aria-label="Alineación del párrafo" value={editor.isActive({ textAlign: 'justify' }) ? 'justify' : editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left'} onChange={e => editor.chain().focus().setTextAlign(e.target.value).run()}><option value="left">Izquierda</option><option value="center">Centrado</option><option value="right">Derecha</option><option value="justify">Justificado</option></select></div><div className="toolbar-group">{tool('Lista con viñetas', List, () => editor.chain().focus().toggleBulletList().run())}{tool('Lista numerada', ListOrdered, () => editor.chain().focus().toggleOrderedList().run())}</div><button className="equation-button" onClick={() => { equationTarget.current = null; setEquation(''); setEqPos(null); setEqType('blockMath'); setModal('equation'); }}><Sigma size={17}/><span>Ecuación</span></button><button className="equation-button reference-toolbar" title="Insertar cita y gestionar referencias" aria-label="Referencias" onClick={() => setModal('references')}><BookOpen size={17}/><span>Referencias</span></button><div className="zoom"><select aria-label="Zoom" value={zoom} onChange={e => setZoom(e.target.value)}><option value="80">80%</option><option value="100">100%</option><option value="120">120%</option></select></div></div>
   <div className="document-tools" aria-label="Herramientas del documento"><button onClick={()=>setModal('import')}>Importar documento</button><button onClick={()=>{setTab('edit');setModal('table');}}>Tabla</button><button onClick={insertContents}>Índice automático</button><button onClick={()=>{setTab('edit');editor.chain().focus().insertContent({type:'pageBreak'}).run();}}>Salto de página</button><button onClick={()=>{setTab('edit');setSearchOpen(v=>!v);}}>Buscar y reemplazar</button><button onClick={()=>setModal('format')}>Formato del documento</button><button onClick={()=>{setImportError('');setModal('backup');}}>Copias editables</button></div>
   {searchOpen && <SearchDocument key={activeId} editor={editor} onClose={()=>setSearchOpen(false)}/>}
   <TableControls editor={editor}/>
   </div>
   {pasteNotice && <div className="paste-notice" role="status"><span>{pasteNotice}</span><button aria-label="Cerrar aviso de pegado" onClick={()=>setPasteNotice('')}><X size={15}/></button></div>}<div className="work-area"><div className="canvas"><div className="canvas-top"><span><span className="canvas-dot"/> TU LIENZO, TUS IDEAS</span><button onClick={() => setModal('help')}><BookOpen size={13}/> Consejos de escritura <ArrowRight size={12}/></button></div>{tab === 'edit' ? <article className={`paper ${pageSize === 'Carta' ? 'letter' : ''} ${format.headingStyle !== 'editorial' ? 'formal-paper' : ''} ${format.headingStyle === 'apa' ? 'apa-paper' : ''} ${format.headingStyle === 'cv' ? 'cv-paper' : ''} ${pageSize === 'Continuo' ? 'continuous-paper' : ''}`} data-page-size={pageSize} style={{ zoom: Number(zoom) / 100, '--page-width': `${pageFormat(pageSize).width}mm`, '--page-height': `${pageFormat(pageSize).height}mm`, '--body-size': `${format.fontSize}pt`, '--body-spacing': format.lineSpacing, '--document-margin': `${format.margin}cm`, '--document-font': fontDefinition(format.fontFamily).css, '--first-indent': `${format.firstLineIndent}cm`, '--paragraph-gap': `${format.paragraphSpacing}pt`, '--paragraph-align': format.paragraphAlignment } as React.CSSProperties}><div className="paper-eyebrow"><span>NOTAS & DESCUBRIMIENTOS</span><span className="paper-symbol"><Sparkles size={24} strokeWidth={1.2}/></span></div><EditorContent editor={editor}/>{!hasBibliographyAnchor(active.content) && <Bibliography references={cited} style={citationStyle}/>}<div className="paper-footer"><span>TEXLA DOCS</span><span>{pageSize === 'Continuo' ? 'SIN PÁGINAS' : pageSize}</span></div></article> : <div className="latex-panel"><div><span><Code2 size={18}/> Tu documento, en LaTeX</span><button onClick={download}><ArrowDownToLine size={16}/> Descargar .tex</button></div><p>Se genera automáticamente a partir de tu documento visual.</p><pre>{latex}</pre></div>}<div className="canvas-bottom"><span>Escribe con libertad. Publica con precisión.</span><span>Hecho con texla <span className="star">✦</span></span></div></div>
   <aside className="inspector"><div className="inspector-tabs"><button className={rightTab === 'outline' ? 'active' : ''} onClick={() => setRightTab('outline')}>Estructura</button><button className={rightTab === 'design' ? 'active' : ''} onClick={() => setRightTab('design')}>Diseño</button><Settings2 size={14}/></div>{rightTab === 'outline' ? <><div className="inspector-label">EN ESTE DOCUMENTO</div><div className="outline">{headings.map((h, i) => <button key={i} className={`${h.level === 1 ? 'outline-title' : ''} ${i === 1 ? 'outline-current' : ''}`} onClick={() => { setTab('edit'); editor.chain().focus().setTextSelection(h.pos + 1).run(); requestAnimationFrame(() => { const dom = editor.view.nodeDOM(h.pos); if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); }}><span>{h.level === 1 ? <FileText size={13}/> : <span className="outline-line"/>}</span>{format.numberedSections && h.number ? `${h.number}. ` : ''}{h.text}</button>)}{!headings.length && <p className="muted">Añade títulos para organizar tus ideas.</p>}</div></> : <div className="design-panel"><FormatControls value={format} onChange={updateFormat}/></div>}
    <div className="ai-card"><span className="ai-icon"><Sparkles size={21}/></span><span className="ai-kicker">DE LA IA A TU DOCUMENTO</span><h3>Tus ideas, sin perder<br/>la fórmula.</h3><p>Pega respuestas de ChatGPT o cualquier IA. Las ecuaciones encontrarán su lugar.</p><button onClick={() => { setPaste(''); setModal('paste'); }}><Clipboard size={15}/> Pegar contenido <ArrowRight size={14}/></button><small><Check size={11}/> Compatible con fórmulas LaTeX</small></div>
    <div className="tip"><span>✧</span><div><strong>Un pequeño gran atajo</strong><p>Selecciona cualquier texto para darle estilo. Haz clic en una ecuación para editarla.</p><kbd>Ctrl</kbd> + <kbd>B</kbd><span> para negrita</span></div></div>
    <div className="inspector-bottom"><span className="leaf">❧</span><p>Concéntrate en lo que quieres decir.<br/>Nosotros cuidamos cómo se ve.</p></div>
   </aside></div>
   <footer className="statusbar"><div><span className="status-green"/> {storageError ? 'Error al guardar: exporta una copia' : session ? sharedStatus : cloudStatus || (saved ? 'Guardado en este navegador' : 'Guardando cambios…')} <span className="footer-divider">|</span> {wordCount} palabras</div><div>Español <span className="footer-divider">|</span> {pageSize} <span className="footer-divider">|</span><button onClick={printDocument}><Maximize2 size={13}/> Imprimir</button></div></footer>
  </main>
  {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><section className={`modal ${modal === 'paste' || modal === 'equation' || modal === 'references' || modal === 'format' || modal === 'import' || modal === 'templates' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="close-modal icon-button" aria-label="Cerrar" onClick={() => setModal(null)}><X size={20}/></button><span className="modal-icon">{modal === 'paste' ? <Sparkles/> : modal === 'equation' ? <Sigma/> : modal === 'export' ? <ArrowDownToLine/> : <FileText/>}</span>
   {modal === 'import' && <Suspense fallback={<p role="status">Preparando importación…</p>}><ImportDocument schema={editor.schema} hasAccount={!!authSession} onImport={addImportedDocument}/></Suspense>}
   {modal === 'account' && <AccountPanel session={authSession} current={active} refreshKey={docs.map(doc => `${doc.id}:${doc.cloud?.revision || 0}`).join('|')} onOpen={openCloudDocument} onCopy={copyToAccount} onRemoved={id => {setDocs(prev => prev.map(doc => doc.id === id ? {...doc, cloud: undefined} : doc)); setToast('Documento eliminado de la nube. Conservas la copia abierta.');}} onSignOut={signOut} deviceDocuments={() => readDocs()}/>}
   {modal === 'share' && <ShareDocument key={activeId} document={active} editor={editor} session={session} onCreated={doc => { const next = applySharedDocument(latestDocs.current, doc); localStorage.setItem(storageKey, JSON.stringify(next)); setDocs(next); openDocument(doc); setModal('share'); }} onStopped={() => { const local = { ...active, shared: undefined, content: editor.getJSON(), updated: Date.now(), ...(active.cloud ? {cloud:{...active.cloud,dirty:true,stoppedSharing:active.shared}} : {}) }; const next = latestDocs.current.map(doc=>doc.id===activeId ? local : doc); setDocs(next); try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch { setStorageError(true); } openDocument(local); setModal(null); setToast('Enlace desactivado. Continúas en el mismo documento.'); }}/>}
   {modal === 'table' && <InsertTable onInsert={(rows,cols)=>{editor.chain().focus().insertTable({rows,cols,withHeaderRow:true}).run();setModal(null);setTab('edit');}}/>}
   {modal === 'format' && <><h2 id="modal-title">Un formato para todo tu documento.</h2><FormatControls value={format} onChange={updateFormat}/><button className="primary-button" onClick={()=>setModal(null)}>Listo</button></>}
   {modal === 'backup' && <><h2 id="modal-title">Conserva una copia editable.</h2><p>Incluye texto, tablas, ecuaciones, referencias y formato. Puedes abrirla en Texla desde otro navegador.</p><button className="export-option" onClick={downloadBackup}><ArrowDownToLine/><span><strong>Descargar copia editable</strong><small>Archivo .texla.json del documento actual</small></span></button><label className="field-label">Abrir copia de Texla<input type="file" accept=".json,.texla.json,application/json" onChange={e=>{void importBackup(e.target.files?.[0]);e.target.value='';}}/></label>{importError && <p role="alert" className="import-error">{importError}</p>}<p className="privacy-note">La copia se abre como un documento nuevo. Tus documentos actuales se conservan. Máximo 5 MB por archivo; el espacio total depende del navegador.</p></>}
   {modal === 'references' && <ReferenceManager library={references} cited={cited} style={citationStyle} onStyleChange={changeCitationStyle} onInsert={insertReference} onSave={saveReference}/>}
   {modal === 'new' && <><h2 id="modal-title">Un espacio para una nueva idea.</h2><p>Dale un nombre. Lo extraordinario viene después.</p><label className="field-label">Nombre del documento<input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createDocument()} placeholder="Mi próxima gran idea"/></label><button className="primary-button" onClick={() => createDocument()}>Crear documento <ArrowRight size={16}/></button></>}
   {modal === 'paste' && <><h2 id="modal-title">De la conversación a la página.</h2><p>Pega contenido de tu IA o Google Docs. Recuperamos fórmulas con LaTeX o MathML. También convertimos $$…$$, \[…\], \(…\) y $…$ en ecuaciones editables.</p><textarea autoFocus onPaste={event=>{if(!event.clipboardData.getData('text/html')&&!event.clipboardData.getData('application/mathml+xml'))return;try{const result=readMathClipboard(event.clipboardData,editor.schema);if(!result)return;event.preventDefault();const field=event.currentTarget;setPaste(paste.slice(0,field.selectionStart)+mathPasteText(result.document)+paste.slice(field.selectionEnd));setPasteNotice(result.warnings.join(' '));}catch(error){event.preventDefault();setPasteNotice(error instanceof Error?error.message:'No se pudo leer el portapapeles.');}}} className="paste-area" value={paste} onChange={e => setPaste(e.target.value)} placeholder={'Pega tu contenido aquí…\n\nPor ejemplo: la identidad de Euler\n$$e^{i\\pi} + 1 = 0$$'}/><div className="modal-footer"><button className="text-button" onClick={() => setPaste('La identidad de Euler conecta cinco constantes fundamentales:\n$$e^{i\\pi} + 1 = 0$$\nUna expresión sencilla para una idea extraordinaria.')}>Probar un ejemplo</button><button className="primary-button" disabled={!paste.trim()} onClick={() => { editor.chain().focus().insertContent(parseMathText(paste)).run(); setModal(null); setTab('edit'); setToast('Contenido insertado con sus ecuaciones'); }}>Insertar contenido <ArrowRight size={16}/></button></div><small className="privacy-note">El contenido se procesa en tu navegador. Si Google Docs copia solo una imagen, importa su archivo Word (.docx) o usa el editor de ecuaciones.</small>{pasteNotice && <p role="status" className="import-error">{pasteNotice}</p>}</>}
   {modal === 'equation' && <><h2 id="modal-title">Un lenguaje universal.</h2><p>Elige una fórmula y edítala visualmente. Usa el teclado matemático para insertar símbolos sin escribir código.</p><div className="equation-templates">{examples.map(ex => <button key={ex.name} onClick={() => setEquation(ex.tex)}><MathPreview value={ex.tex}/><span>{ex.name}</span></button>)}</div><label className="field-label">Tu ecuación<Suspense fallback={<p>Cargando teclado…</p>}><MathInput value={equation} onChange={setEquation}/></Suspense></label><details className="advanced-math"><summary>Editar código LaTeX (opcional)</summary><input aria-label="Código LaTeX" value={equation} onChange={e => setEquation(e.target.value)} placeholder="Escribe o pega una fórmula"/></details><MathPreview value={equation || '\\text{Tu ecuación aparecerá aquí}'}/><div className="modal-footer"><select aria-label="Tipo de ecuación" value={eqType} disabled={eqPos !== null} onChange={e => setEqType(e.target.value)}><option value="blockMath">En un bloque</option><option value="inlineMath">En la línea de texto</option></select><button className="primary-button" disabled={!equation.trim()} onClick={insertEquation}>{eqPos !== null ? 'Guardar ecuación' : 'Insertar ecuación'}<ArrowRight size={16}/></button></div></>}
   {modal === 'export' && <><h2 id="modal-title">Ideas listas para compartir.</h2><p>Tu documento, en el formato que necesitas.</p><button className="export-option" onClick={download}><Code2 size={25}/><span><strong>Documento LaTeX</strong><small>Archivo .tex · Ecuaciones y formato incluidos</small></span><ArrowDownToLine size={19}/></button><button className="export-option" onClick={printDocument}><FileText size={25}/><span><strong>Imprimir / guardar como PDF</strong><small>Usa «Guardar como PDF» en tu navegador</small></span><ArrowRight size={19}/></button><button className="export-option" onClick={downloadBackup}><ArrowDownToLine size={25}/><span><strong>Copia editable de Texla</strong><small>Archivo .texla.json · Para volver a abrir y editar</small></span></button><p className="privacy-note">{format.pageSize === 'Continuo' ? 'El modo continuo se imprime y exporta en hojas A4. ' : ''}El archivo .tex incluye el formato y la fuente elegidos. Para la fuente exacta, compila con XeLaTeX o LuaLaTeX y esa fuente instalada; pdfLaTeX usa una sustituta. El PDF se genera con la impresión del navegador.</p></>}
   {modal === 'templates' && <TemplatePicker onChoose={createDocument} onBlank={()=>{setTitle('');setModal('new');}}/>}
   {modal === 'help' && <><h2 id="modal-title">Escribir bien, sin complicaciones.</h2><p>Bienvenido a Texla Docs. Tu documento ya está listo para editar.</p><div className="help-steps"><div><span>01</span><p><strong>Escribe como siempre.</strong> Usa títulos, listas y negritas desde la barra de herramientas.</p></div><div><span>02</span><p><strong>Dale lugar a las fórmulas.</strong> Inserta una plantilla o pega fórmulas LaTeX desde tu IA.</p></div><div><span>03</span><p><strong>Llévate tus ideas.</strong> Exporta el archivo .tex o imprime el documento en PDF.</p></div></div><div className="local-note">Los documentos sin cuenta se guardan en este navegador. Al iniciar sesión, los documentos privados nuevos se guardan también en tu cuenta. Usa Copias editables para conservarlos y volver a abrirlos en otro dispositivo. Usa Compartir para editar el mismo documento en equipo mediante el servidor configurado. Cualquier persona con su enlace puede editarlo; conserva también copias descargadas.</div><button className="primary-button" onClick={() => setModal(null)}>Empezar a escribir <ArrowRight size={16}/></button></>}
  </section></div>}
 </div>;
}
