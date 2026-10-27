import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readArchive } from './archive';
import { readTex } from './tex';
import { pdfParagraphs } from './pdfLayout';
import { mathInDocument, protectMarkdownMath } from './richText';
describe('document conversion helpers', () => {
  it('preserves nested formatting, equations and list structure from LaTeX', () => {
    const { html,title } = readTex(String.raw`\documentclass{article}
\title{Mi tesis}\begin{document}\maketitle
\section{Resultados} Un \textbf{resultado \emph{importante}}.
\begin{equation}\frac{a}{b}\label{eq:test}\end{equation}
\begin{itemize}\item Primero\item Segundo\begin{itemize}\item Interior\end{itemize}\end{itemize}
\end{document}`);
    expect(title).toBe('Mi tesis'); expect(html).toContain('<strong>resultado <em>importante</em></strong>');
    expect(html).toContain('data-latex="\\frac{a}{b}"'); expect(html).toContain('<h2>Resultados</h2>');
    expect(html.match(/<ul>/g)).toHaveLength(2); expect(html).not.toContain('eq:test');
  });
  it('keeps unsupported LaTeX macros visible without loading files', () => {
    const {html,warnings}=readTex(String.raw`\section{Prueba} \input{secreto.tex} \begin{custom}contenido\end{custom}`);
    expect(html).toContain('\\input{secreto.tex}'); expect(html).toContain('contenido'); expect(warnings.length).toBeGreaterThan(1);
  });
  it('protects Markdown formulas but leaves code samples alone', () => {
    const source=String.raw`Valor $x_i^2$ y \(a+b\).`+'\n\n```tex\n$x$\n```';
    const protectedMath=protectMarkdownMath(source);
    expect(protectedMath.text).toContain('```tex\n$x$\n```');
    const restored=protectedMath.restore(protectedMath.text);
    expect(restored).toContain('data-latex="x_i^2"');expect(restored).toContain('data-latex="a+b"');
  });
  it('keeps bold text around a display equation and valid list-item structure', () => {
    const [doc]=mathInDocument({type:'doc',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'$$x^2$$ Luego',marks:[{type:'bold'}]}]}]}]});
    expect(doc.content?.[0].content?.map(n=>n.type)).toEqual(['paragraph','blockMath','paragraph']);
    expect(doc.content?.[0].content?.[2].content?.[0].marks).toEqual([{type:'bold'}]);
  });
  it('groups PDF fragments and wrapped lines without removing scientific hyphens', () => {
    const item=(str:string,x:number,y:number,width=70)=>({str,transform:[12,0,0,12,x,y],width,height:12});
    const nodes=pdfParagraphs([item('Ensayo',40,700),item('controlado',114,700),item('con datos.',40,684),item('Otro párrafo.',40,650)]);
    expect(nodes).toHaveLength(2);expect(nodes[0].content?.[0].text).toBe('Ensayo controlado con datos.');
  });
  it('reads office archives and rejects oversized decompressed payloads', () => {
    expect(readArchive(zipSync({'document.xml':strToU8('contenido')}))['document.xml']).toEqual(strToU8('contenido'));
    expect(()=>readArchive(zipSync({'bomb':new Uint8Array(33*1024*1024)}))).toThrow(/grande|32 MB/);
  });
});
