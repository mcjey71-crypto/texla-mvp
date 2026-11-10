import type { DocNode } from './document';
import {blockAppearance} from './richFormatting';
/** Export rectangular and merged cells without losing their grid positions. */
export function tableToLatex(table: DocNode, render: (node: DocNode) => string): string {
  type Cell = { node?: DocNode; cols: number; rows: number };
  const grid: (Cell | null)[][] = [];
  const rows = table.content || [];
  rows.forEach((row, y) => {
    grid[y] ||= []; let x = 0;
    for (const node of row.content || []) {
      while (grid[y][x] !== undefined) x++;
      const cols = Math.max(1, Math.min(20, Number(node.attrs?.colspan) || 1));
      const span = Math.max(1, Math.min(rows.length-y, Number(node.attrs?.rowspan) || 1));
      for (let dy=0;dy<span;dy++) { grid[y+dy] ||= []; grid[y+dy][x] = { node:dy===0?node:undefined,cols,rows:span-dy }; for(let dx=1;dx<cols;dx++) grid[y+dy][x+dx]=null; }
      x+=cols;
    }
  });
  const columns = Math.max(1, ...grid.map(row=>row.length));
  const weights=Array(columns).fill(0) as number[];
  for(const row of grid)for(let x=0;x<row.length;x++){
    const cell=row[x];if(!cell?.node)continue;
    const widths=cell.node.attrs?.colwidth;
    if(Array.isArray(widths))for(let k=0;k<cell.cols;k++)if(Number.isFinite(widths[k])&&widths[k]>0)weights[x+k]||=widths[k];
  }
  const custom=weights.some(n=>n>0);const average=weights.filter(n=>n>0).reduce((a,b)=>a+b,0)/Math.max(1,weights.filter(n=>n>0).length);
  for(let i=0;i<columns;i++)weights[i]||=average||1;
  const total=weights.reduce((a,b)=>a+b,0);
  const width = (span=1,start=0) => custom?`\\dimexpr${(weights.slice(start,start+span).reduce((a,b)=>a+b,0)/total).toFixed(6)}\\linewidth-2\\tabcolsep\\relax`:`\\dimexpr${span}\\linewidth/${columns}-2\\tabcolsep\\relax`;
  const lines = grid.map((row,y)=>{
    const cells:string[]=[];
    for(let x=0;x<columns;){
      const cell=row[x];if(cell===null){x++;continue;}
      let value=cell?.node ? (cell.node.content||[]).map(render).join('').trim() : '';
      if(cell?.node?.type==='tableHeader') value=`{\\bfseries ${value}}`;
      const background=blockAppearance(cell?.node?.attrs?.layout).background;
      if(background)value=`\\cellcolor[HTML]{${background}}${value}`;
      if(cell?.node && cell.rows>1) value=`\\multirow{${cell.rows}}{${width(cell.cols,x)}}{${value}}`;
      if(cell && cell.cols>1) value=`\\multicolumn{${cell.cols}}{>{\\raggedright\\arraybackslash}p{${width(cell.cols,x)}}}{${value}}`;
      cells.push(value);x+=cell?.cols||1;
    }
    const header = y===0 && rows[0]?.content?.every(c=>c.type==='tableHeader');
    return cells.join(' & ')+' \\\\'+(row.some(c=>c && c.rows>1)?'*':'')+(header?'\n\\midrule':'');
  });
  const changesCounters = (node: DocNode): boolean => ['blockMath','heading'].includes(node.type) || (node.content || []).some(changesCounters);
  const hasHeader = !rows[0]?.content?.some(changesCounters) && rows[0]?.content?.length && rows[0].content.every(c=>c.type==='tableHeader' && (!c.attrs?.rowspan || c.attrs.rowspan===1));
  const body = hasHeader ? [lines[0], '\\endfirsthead', lines[0], '\\endhead', ...lines.slice(1)].join('\n') : lines.join('\n');
  const spec=custom?weights.map((_,i)=>`>{\\raggedright\\arraybackslash}p{${width(1,i)}}`).join(''):`*{${columns}}{>{\\raggedright\\arraybackslash}p{${width()}}}`;
  return `\n\\begin{longtable}{${spec}}\n\\toprule\n${body}\n\\bottomrule\n\\end{longtable}\n`;
}
