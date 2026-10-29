import { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { TEMPLATES, resolveFormat, type TemplateId } from './formalDocument';
import { fontDefinition } from './fonts';
export default function TemplatePicker({onChoose,onBlank}:{onChoose:(id:TemplateId)=>void;onBlank:()=>void}) {
 const [category,setCategory]=useState('Todas');
 return <><h2 id="modal-title">Una estructura para cada idea.</h2><p>Empieza con el formato, las secciones y las referencias adecuados para tu trabajo.</p>
 <div className="template-filters" aria-label="Tipos de plantilla">{['Todas',...new Set(TEMPLATES.map(template=>template.category))].map(value=><button key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div>
 <div className="template-grid">{TEMPLATES.filter(template=>category==='Todas'||template.category===category).map(template=>{
  const format=resolveFormat(template.format);
  return <div className="template-card" key={template.id}><button className="template-choose" onClick={()=>onChoose(template.id)}><span className="template-sheet" aria-hidden="true"><span style={{fontFamily:fontDefinition(format.fontFamily).css}}>Aa</span><i/><i/><i/></span><strong>{template.title}</strong><span>{template.description}</span><small>{format.fontFamily} · {format.fontSize} pt<br/>{format.pageSize} · {format.margin.toLocaleString('es')} cm · Interlineado {format.lineSpacing.toLocaleString('es')}<br/>{template.citationStyle==='apa'?'APA 7':template.citationStyle==='ieee'?'IEEE':'Vancouver'}</small><span className="template-start">Usar plantilla <ArrowRight size={13}/></span></button><details><summary>Criterios de esta plantilla</summary><p>{template.note}</p></details></div>;
 })}</div>
 <button className="template-blank" onClick={onBlank}><Plus size={16}/> Empezar con una página en blanco</button>
 <p className="privacy-note">Todos los ajustes son editables. Las normas de tu universidad, revista o destinatario tienen prioridad. Los índices de tablas, figuras y anexos de UTEC se completan manualmente.</p></>;
}
