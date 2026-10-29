import { createServer } from 'vite';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = mkdtempSync(join(tmpdir(), 'texla-latex-'));
const server = await createServer({ configFile:false, optimizeDeps:{noDiscovery:true,include:[]}, cacheDir: join(directory,'vite-cache'), server: { middlewareMode: true }, logLevel: 'error' });
try {
  const { exportLatex } = await server.ssrLoadModule('/src/document.ts');
  const { createTemplate, TEMPLATES } = await server.ssrLoadModule('/src/formalDocument.ts');
  const { fromCrossref } = await server.ssrLoadModule('/src/doi.ts');
  const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/crossref.json', import.meta.url), 'utf8'));
  const reference = fromCrossref('10.1038/nphys1170', fixture.message);
  const p = text => ({ type: 'paragraph', content: [{type:'text',text}] });
  const cell = (text, attrs = {}, type = 'tableCell') => ({type,attrs,content:[p(text)]});
  const table = { type:'table',content:[
    {type:'tableRow',content:[{...cell('Medida & unidad',{colspan:2},'tableHeader'),content:[p('Medida & unidad'),p('Encabezado en dos párrafos')]}]},
    {type:'tableRow',content:[cell('50%',{rowspan:2}),cell('Resultado A')]},
    {type:'tableRow',content:[cell('Resultado B')]},
  ]};
  for (const style of ['apa','ieee','vancouver']) {
    const doc=createTemplate('thesis');doc.content.content.push(table,{type:'paragraph',content:[{type:'text',text:'Fuente de ejemplo '},{type:'citation',attrs:{reference}}]},{type:'blockMath',attrs:{latex:'E=mc^2'}});
    const filename=`${style}.tex`;
    writeFileSync(join(directory,filename),exportLatex(doc.title,doc.content,[reference],style,{...doc.format,pageSize:'Carta',margin:3}));
    for(let pass=0;pass<3;pass++) execFileSync('pdflatex',['-no-shell-escape','-halt-on-error','-interaction=nonstopmode',filename],{cwd:directory,stdio:'pipe',timeout:60000});
    const log=readFileSync(join(directory,`${style}.log`),'utf8');
    if (/Undefined control sequence|undefined references|multiply defined|Overfull|Table widths have changed/i.test(log)) throw new Error(`${style}: unresolved TeX references; see ${directory}`);
    console.log(`${style}: PDF generated successfully, including contents, merged table, citations and equation.`);
  }
  for (const template of TEMPLATES) {
    const doc=createTemplate(template.id); const filename=`template-${template.id}.tex`;
    writeFileSync(join(directory,filename),exportLatex(doc.title,doc.content,[],doc.citationStyle,doc.format));
    for(let pass=0;pass<2;pass++) execFileSync('pdflatex',['-no-shell-escape','-halt-on-error','-interaction=nonstopmode',filename],{cwd:directory,stdio:'pipe',timeout:60000});
    const log=readFileSync(join(directory,`template-${template.id}.log`),'utf8');
    if(/Undefined control sequence|undefined references|multiply defined|Overfull/i.test(log)) throw new Error(`${template.id}: unresolved template typesetting issue; see ${directory}`);
    console.log(`${template.id}: template PDF compiled with page settings and font fallback.`);
  }
  const utec=createTemplate('utec');
  writeFileSync(join(directory,'utec-xetex.tex'),exportLatex(utec.title,utec.content,[],utec.citationStyle,utec.format));
  execFileSync('xelatex',['-no-shell-escape','-halt-on-error','-interaction=nonstopmode','utec-xetex.tex'],{cwd:directory,stdio:'pipe',timeout:60000});
  console.log('UTEC: XeLaTeX font selection and fallback compiled successfully.');
  console.log(`Artifacts: ${directory}`);
} catch (error) {
  console.error(error.message);
  if (error.stdout) console.error(error.stdout.toString().slice(-5000));
  console.error(`LaTeX check failed. Requires pdflatex with Spanish babel, longtable, array, booktabs, multirow, xurl and setspace. Artifacts: ${directory}`);
  process.exitCode=1;
} finally { await server.close(); }
