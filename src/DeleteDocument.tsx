import { useState } from 'react';
import type { SavedDocument } from './backup';
export default function DeleteDocument({document,busy,onDelete,onCancel,onDownload}:{document:SavedDocument;busy:boolean;onDelete:()=>Promise<void>;onCancel:()=>void;onDownload:()=>void}){
  const [error,setError]=useState('');
  const guest=!!document.shared&&!document.shared.ownerToken;
  return <>
    <h2 id="modal-title">{guest?'Quitar documento de mi lista':'Borrar documento'}</h2>
    <p className="delete-document-title">{document.title||'Documento sin título'}</p>
    {guest ? <p>Se quitará de tu lista en este navegador{document.cloud?' y de tu biblioteca en la nube':''}. El documento del equipo y su enlace seguirán funcionando. Podrás volver a abrirlo con el enlace.</p> : <>
      <p>{document.cloud?'Se borrará de tu cuenta y de este navegador.':'Se borrará de este navegador.'} No hay papelera para recuperarlo.</p>
      {document.shared && <p>También se desactivará el enlace y se eliminará el documento del servidor de colaboración. Las demás personas perderán el acceso compartido.</p>}
    </>}
    {(document.shared||document.cloud)&&<p className="privacy-note">Las copias descargadas o ya abiertas en otros dispositivos pueden conservarse.</p>}
    <button className="text-button" disabled={busy} onClick={onDownload}>Descargar copia antes de borrar</button>
    <div className="modal-footer"><button className="text-button" disabled={busy} onClick={onCancel}>Cancelar</button><button className="danger-button" disabled={busy} onClick={async()=>{setError('');try{await onDelete();}catch(error){setError(error instanceof Error?error.message:'No se pudo borrar el documento.');}}}>{busy?'Borrando…':guest?'Confirmar: quitar de mi lista':'Confirmar: borrar documento'}</button></div>
    {error&&<p role="alert" className="import-error">{error}</p>}
  </>;
}
