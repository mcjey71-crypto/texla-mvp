import { describe, expect, it } from 'vitest';
import { resolveFormat } from './formalDocument';
import { cssContent, runningPageCss, pageNumberExample, footerPositions } from './pageFurniture';
import { exportLatex } from './document';
describe('running page furniture',()=>{
  it('defaults to a blank header, branding and automatic decimal numbering',()=>{
    const f=resolveFormat();expect(f).toMatchObject({headerMode:'auto',headerText:'',footerBrand:true,pageNumbers:'bottom',pageNumberStart:1,pageNumberStyle:'arabic'});
    expect(runningPageCss(f)).toContain('counter(page, decimal)');expect(runningPageCss(f)).toContain('counter-increment: page 1');expect(pageNumberExample(14,'roman')).toBe('xiv');expect(pageNumberExample(14,'Roman')).toBe('XIV');
  });
  it('normalizes unsafe shared settings and escapes CSS text without adding declarations',()=>{
    const f=resolveFormat({headerMode:'custom',headerText:'";} </style>\nbody{color:red}',pageNumberStart:Infinity,pageNumberPrefix:'x'.repeat(100)});
    expect(f.pageNumberStart).toBe(1);expect(f.pageNumberPrefix).toHaveLength(30);expect(f.headerText).not.toContain('\n');
    expect(cssContent(f.headerText)).toContain('\\22 ');expect(runningPageCss(f)).not.toContain('</style>');
    expect(resolveFormat({pageNumberStart:-3})).toHaveProperty('pageNumberStart',1);
  });
  it('keeps brand, custom footer and the number in distinct positions and escapes LaTeX',()=>{
    expect(footerPositions(resolveFormat({pageNumbers:'bottom-left'}))).toEqual({brand:'right',text:'center'});
    const tex=exportLatex('Informe',{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Contenido'}]}]},[], 'ieee',{headerMode:'custom',headerText:'I+D & 50%',footerText:'Reporte_1',pageNumberStart:7,pageNumberStyle:'Roman',numberFirstPage:false,pageNumbers:'bottom-right',pageNumberPrefix:'Pág. '});
    expect(tex).toContain('I+D \\& 50\\%');expect(tex).toContain('Reporte\\_1');expect(tex).toContain('\\setcounter{page}{7}');expect(tex).toContain('\\pagenumbering{Roman}');expect(tex).toContain('\\fancyfoot[R]');expect(tex).toContain('\\thispagestyle{texlafirst}');
  });
});
