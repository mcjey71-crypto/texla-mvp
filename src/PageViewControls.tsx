import {useEffect, useState} from 'react';
import type {DocumentFormat} from './formalDocument';
import {pageFormat, type PageSize} from './pageFormats';

const ZOOM_LEVELS = [25, 50, 75, 80, 90, 100, 110, 120, 125, 150, 175, 200, 250, 300, 400, 500, 600];
const PX_PER_MM = 96 / 25.4;

// Keep the layout width independent of magnification, including on narrow screens.
export function usePreviewWidth(canvas: HTMLElement | null, size: PageSize) {
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvas]);
  const naturalWidth = pageFormat(size).width * PX_PER_MM;
  return size === 'Continuo' ? available || naturalWidth : Math.min(available || naturalWidth, naturalWidth);
}

// Use the same typography and print rules as export in an isolated, noninteractive
// layout. CSS columns approximate page fragmentation; this is intentionally labelled
// an estimate, since browser print engines can handle tables and nested columns differently.
function printStyles() {
  function rules(list: CSSRuleList): string {
    return Array.from(list, rule => {
      if (rule instanceof CSSMediaRule) {
        if (rule.conditionText.includes('print')) return rules(rule.cssRules);
        if (rule.conditionText.includes('screen')) return '';
      }
      return rule.cssText;
    }).join('\n');
  }
  return Array.from(document.styleSheets, sheet => {
    try { return rules(sheet.cssRules); } catch { return ''; }
  }).join('\n');
}

export default function PageViewControls({paper, format, zoom, onZoom}: {
  paper: HTMLElement | null; format: DocumentFormat; zoom: string; onZoom: (zoom: string) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const formatKey = JSON.stringify(format);
  const continuous = format.pageSize === 'Continuo';
  useEffect(() => {
    if (!paper || continuous) return;
    setCount(null);
    const settings = JSON.parse(formatKey) as DocumentFormat;
    const page = pageFormat(settings.pageSize);
    const width = (page.width - settings.margin * 20) * PX_PER_MM;
    const height = (page.height - settings.margin * 20) * PX_PER_MM;
    const frame = document.createElement('iframe');
    frame.className = 'page-count-measurement';
    frame.title = 'Cálculo del tamaño del documento';
    frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('inert', '');
    frame.setAttribute('sandbox', 'allow-same-origin'); frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${page.width * PX_PER_MM}px;height:${page.height * PX_PER_MM}px;visibility:hidden;pointer-events:none;border:0`;
    document.body.append(frame);
    const doc = frame.contentDocument!;
    const style = doc.createElement('style');
    style.textContent = printStyles() + `
      html,body{margin:0!important;padding:0!important;overflow:visible!important}
      #root{width:${width}px;height:${height}px;column-width:${width}px;column-gap:0;column-fill:auto}
      .app-shell,.main,.work-area,.canvas{display:contents!important}
      .paper{width:auto!important;max-width:none!important;min-height:0!important;zoom:1!important;margin:0!important;padding:0!important}
      .tiptap{min-height:0!important}
      .running-header-editor,.paper-footer,.figure-actions{display:none!important}
      .page-break{break-after:column!important}
    `;
    doc.head.append(style);
    const root = doc.createElement('div'); root.id = 'root'; doc.body.append(root);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let revision = 0;
    const measure = () => {
      if (disposed) return;
      const current = ++revision;
      const clone = paper.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      clone.querySelectorAll('[id],[contenteditable],[autofocus]').forEach(el => {
        el.removeAttribute('id'); el.removeAttribute('contenteditable'); el.removeAttribute('autofocus');
      });
      // A Word page section starts a new simulated sheet, not a new inner text column.
      clone.querySelectorAll<HTMLElement>('[data-texla-section]').forEach(section => {
        if (section.style.breakBefore === 'page') section.style.breakBefore = 'column';
      });
      let parent: HTMLElement = root;
      root.replaceChildren();
      for (const name of ['app-shell', 'main', 'work-area', 'canvas']) {
        const container = doc.createElement('div'); container.className = name;
        parent.append(container); parent = container;
      }
      parent.append(clone);
      const read = () => {
        if (disposed || revision !== current) return;
        setCount(Math.max(1, Math.ceil((root.scrollWidth - 1) / width)));
      };
      read();
      void doc.fonts.ready.then(read);
      clone.querySelectorAll('img').forEach(img => img.addEventListener('load', read, {once:true}));
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(measure, 500); };
    const observer = new MutationObserver(schedule);
    observer.observe(paper, {childList:true, subtree:true, characterData:true, attributes:true});
    schedule();
    return () => { disposed = true; clearTimeout(timer); observer.disconnect(); frame.remove(); };
  }, [paper, continuous, formatKey]);

  return <div className="page-view-controls">
    <span className="page-count" aria-label="Total de páginas" title={continuous ? 'Lienzo continuo, sin división en páginas.' : 'Total estimado según el papel, los márgenes, el contenido y los saltos de página. El total definitivo aparece al exportar a PDF.'}>
      {continuous ? 'Sin páginas' : count === null ? 'Calculando páginas…' : `${count} ${count === 1 ? 'página' : 'páginas'} aprox.`}
    </span>
    <div className="zoom"><select aria-label="Zoom" value={zoom} onChange={event => onZoom(event.target.value)}>
      {ZOOM_LEVELS.map(level => <option key={level} value={level}>{level}%</option>)}
    </select></div>
  </div>;
}
