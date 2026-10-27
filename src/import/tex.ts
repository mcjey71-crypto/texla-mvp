import { escapeHTML } from './common';
export function readTex(source: string): { html: string; title?: string; warnings: string[] } {
  const warnings = new Set<string>(); let title: string | undefined;
  // Strip unescaped comments, preserving escaped percent signs.
  source = source.replace(/(?<!\\)(?:\\\\)*%[^\n]*/g, match => match.slice(0, match.indexOf('%')));
  const titleMatch = /\\title\s*\{([^{}]*)\}/.exec(source); if (titleMatch) title = titleMatch[1];
  const document = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(source);
  if (document) source = document[1];
  function parse(input: string, depth = 0): string {
    if (depth > 30) throw new Error('El archivo LaTeX tiene demasiados niveles de anidación.');
    let i = 0, out = '';
    const group = (open = '{', close = '}') => {
      while (/\s/.test(input[i] || '') && i < input.length) i++;
      if (input[i] !== open) return '';
      const start = ++i; let count = 1;
      while (i < input.length) { if (input[i] === '\\') { i += 2; continue; } if (input[i] === open) count++; if (input[i] === close && --count === 0) return input.slice(start,i++); i++; }
      return input.slice(start);
    };
    // Balanced braces are handled separately to avoid interpreting macros.
    while (i < input.length) {
      const rest = input.slice(i);
      const math = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$)/.exec(rest);
      if (math) { const block = math[1] !== undefined || math[2] !== undefined; const tag = block ? 'div' : 'span'; out += `<${tag} data-type="${block ? 'block' : 'inline'}-math" data-latex="${escapeHTML(math[1] ?? math[2] ?? math[3] ?? math[4])}"></${tag}>`; i += math[0].length; continue; }
      if (rest.startsWith('\n\n')) { out += '</p><p>'; i += 2; continue; }
      if (rest.startsWith('\\\\')) { out += '<br>'; i += 2; continue; }
      if (input[i] !== '\\') { out += escapeHTML(input[i] === '\n' ? ' ' : input[i]); i++; continue; }
      const command = /^\\([a-zA-Z]+)\*?/.exec(rest);
      if (!command) { out += escapeHTML(input[i + 1] || ''); i += 2; continue; }
      i += command[0].length; const name = command[1];
      if (['textbf','textit','emph','underline','texttt','textrm','textnormal'].includes(name)) { const tags: Record<string,string> = {textbf:'strong',textit:'em',emph:'em',underline:'u',texttt:'code'}; const tag = tags[name] || 'span'; out += `<${tag}>${parse(group(),depth+1)}</${tag}>`; }
      else if (['chapter','section','subsection','subsubsection'].includes(name)) { if (input[i] === '[') group('[',']'); const level = name === 'chapter' ? 1 : name === 'section' ? 2 : 3; out += `</p><h${level}>${parse(group(),depth+1)}</h${level}><p>`; }
      else if (name === 'begin') {
        const environment = group(); const marker = `\\end{${environment}}`; const start = i; let end = i, nesting = 1;
        const tokens = new RegExp(`\\\\(begin|end)\\{${environment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\}`, 'g'); tokens.lastIndex = i;
        let match; while ((match = tokens.exec(input))) { nesting += match[1] === 'begin' ? 1 : -1; if (!nesting) { end = match.index; i = end + marker.length; break; } }
        if (nesting) { warnings.add('Hay entornos LaTeX incompletos; revisa el contenido recuperado.'); end = input.length; i = end; }
        let body = input.slice(start,end);
        if (['equation','equation*','align','align*','gather','gather*','displaymath','math'].includes(environment)) {
          body = body.replace(/\\label\{[^}]*\}/g,''); if (environment.startsWith('align')) body = `\\begin{aligned}${body}\\end{aligned}`; if (environment.startsWith('gather')) body = `\\begin{gathered}${body}\\end{gathered}`;
          out += `</p><div data-type="block-math" data-latex="${escapeHTML(body.trim())}"></div><p>`;
        } else if (environment === 'itemize' || environment === 'enumerate') {
          const tag = environment === 'itemize' ? 'ul' : 'ol'; out += `</p><${tag}><li><p>${parse(body.replace(/^\s*\\item\s*/,''),depth+1)}</p></li></${tag}><p>`;
        } else if (environment === 'quote' || environment === 'quotation') out += `</p><blockquote><p>${parse(body,depth+1)}</p></blockquote><p>`;
        else if (environment === 'center') out += `</p><p style="text-align:center">${parse(body,depth+1)}</p><p>`;
        else { warnings.add(`El entorno ${environment.slice(0,60)} se conservó como texto para revisión.`); out += escapeHTML(`\\begin{${environment}}${body}${marker}`); }
      }
      else if (name === 'item') out += '</p></li><li><p>';
      else if (name === 'href') { const url = group(); const label = group(); out += `<a href="${escapeHTML(url)}">${parse(label,depth+1)}</a>`; }
      else if (name === 'url') { const url = group(); out += `<a href="${escapeHTML(url)}">${escapeHTML(url)}</a>`; }
      else if (name === 'footnote') { out += ` (${parse(group(),depth+1)})`; warnings.add('Las notas al pie se incorporaron al texto entre paréntesis.'); }
      else if (name === 'label' || name === 'addcontentsline') { group(); if (name === 'addcontentsline') { group(); group(); } }
      else if (name === 'maketitle') out += title ? `</p><h1>${escapeHTML(title)}</h1><p>` : '';
      else if (['par','newline','clearpage','newpage'].includes(name)) { out += '</p><p>'; if (name.endsWith('page')) warnings.add('Los saltos de página LaTeX se convirtieron en separaciones de párrafo.'); }
      else if (name === 'cite' || name === 'ref' || name === 'eqref') { out += `[${escapeHTML(group())}]`; warnings.add('Las citas y referencias cruzadas quedan como texto. Añádelas en Referencias para vincularlas a la bibliografía de Texla.'); }
      else if (name === 'includegraphics') { if (input[i] === '[') group('[',']'); out += `[Imagen: ${escapeHTML(group())}]`; warnings.add('Las imágenes externas no se importan con el archivo .tex.'); }
      else { out += escapeHTML(command[0]); warnings.add('Algunos comandos o macros LaTeX se conservaron literalmente. Revisa el documento; no se ejecutan comandos ni archivos externos.'); }
    }
    return out;
  }
  const html = `<p>${parse(source)}</p>`;
  warnings.add('LaTeX: se convierten títulos, listas, formato y ecuaciones habituales. No se compila el proyecto ni se cargan archivos .bib, imágenes o macros externas.');
  return { html, title, warnings: [...warnings] };
}
