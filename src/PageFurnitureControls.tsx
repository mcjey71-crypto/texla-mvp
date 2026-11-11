import type { DocumentFormat } from './formalDocument';
import { pageNumberExample } from './pageFurniture';

export default function PageFurnitureControls({ value, onChange, hasImportedHeader = false }: { value: DocumentFormat; onChange: (patch: Partial<DocumentFormat>) => void; hasImportedHeader?: boolean }) {
  const numbered = value.pageNumbers !== 'none';
  const examples = Array.from({length:3}, (_, i) => value.pageNumberPrefix + pageNumberExample(value.pageNumberStart + i, value.pageNumberStyle) + value.pageNumberSuffix);
  return <fieldset className="page-furniture-controls">
    <legend>Encabezado, pie y páginas</legend>
    <label>Encabezado<select aria-label="Contenido del encabezado" value={!hasImportedHeader && value.headerMode === 'none' ? 'auto' : value.headerMode} onChange={e => onChange({ headerMode:e.target.value as DocumentFormat['headerMode'] })}>
      <option value="auto">{hasImportedHeader ? 'Original importado' : 'En blanco'}</option><option value="custom">Texto personalizado</option>{hasImportedHeader && <option value="none">En blanco</option>}
    </select></label>
    {value.headerMode === 'custom' && <label className="furniture-wide">Texto del encabezado<input aria-label="Texto del encabezado" maxLength={120} value={value.headerText} placeholder="Institución o título abreviado" onChange={e => onChange({headerText:e.target.value})}/></label>}
    {hasImportedHeader && value.headerMode === 'auto' && <p>El encabezado importado se edita directamente sobre el documento. Puedes ocultarlo eligiendo «En blanco» sin eliminar su contenido.</p>}
    <label className="furniture-wide">Texto del pie de página<input aria-label="Texto del pie de página" maxLength={120} value={value.footerText} placeholder="Opcional" onChange={e => onChange({footerText:e.target.value})}/></label>
    <label className="check-label"><input type="checkbox" checked={value.footerBrand} onChange={e => onChange({footerBrand:e.target.checked})}/> Mostrar Texla Docs en el pie</label>
    <label>Numeración automática<select aria-label="Numeración de páginas" value={value.pageNumbers} onChange={e => onChange({pageNumbers:e.target.value as DocumentFormat['pageNumbers']})}>
      <option value="bottom">Abajo, centrada</option><option value="bottom-left">Abajo, a la izquierda</option><option value="bottom-right">Abajo, a la derecha</option><option value="top-right">Arriba, a la derecha</option><option value="none">Sin número</option>
    </select></label>
    {numbered && <>
      <label>Estilo de números<select aria-label="Estilo de números de página" value={value.pageNumberStyle} onChange={e => onChange({pageNumberStyle:e.target.value as DocumentFormat['pageNumberStyle']})}><option value="arabic">1, 2, 3</option><option value="roman">i, ii, iii</option><option value="Roman">I, II, III</option></select></label>
      <label>Empezar en<input aria-label="Número inicial de página" type="number" min={1} max={9999} value={value.pageNumberStart} onChange={e => { const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=9999)onChange({pageNumberStart:n}); }}/></label>
      <label className="check-label"><input type="checkbox" checked={value.numberFirstPage} onChange={e => onChange({numberFirstPage:e.target.checked})}/> Mostrar número en la primera página</label>
      <label>Antes del número<input aria-label="Texto antes del número de página" maxLength={30} value={value.pageNumberPrefix} placeholder="Ej.: Página " onChange={e => onChange({pageNumberPrefix:e.target.value})}/></label>
      <label>Después del número<input aria-label="Texto después del número de página" maxLength={30} value={value.pageNumberSuffix} onChange={e => onChange({pageNumberSuffix:e.target.value})}/></label>
      <p className="page-number-example">Ejemplo: {examples.join(' · ')}{!value.numberFirstPage && <span>La primera página se cuenta, pero su número queda oculto.</span>}</p>
    </>}
    <p>La numeración se actualiza automáticamente al imprimir, guardar como PDF o compilar LaTeX. El editor muestra un lienzo continuo; comprueba las páginas en la vista de impresión.</p>
  </fieldset>;
}
