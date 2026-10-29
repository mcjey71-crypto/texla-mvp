import type { Session } from '@supabase/supabase-js';
import type { SavedDocument } from './backup';
import { loadCloudDocument, removeCloudDocument } from './cloudDocuments';
import { sameSharedDocument } from './sharedDocumentIdentity';

export async function deleteRemoteDocument(getDocument:()=>SavedDocument,session:Session|null,onRevoked:()=>void):Promise<void> {
  let doc=getDocument();
  let remote:SavedDocument|undefined;
  if(doc.cloud){
    if(!session||session.user.id!==doc.cloud.ownerId)throw new Error('Inicia sesión con la cuenta propietaria para borrar este documento.');
    try{remote=await loadCloudDocument(session,doc.id);}catch(error){if((error as {code?:string}).code!=='PGRST116')throw error;}
    doc=getDocument();
    if(remote && (remote.shared || doc.shared) && !sameSharedDocument(remote.shared,doc.shared||doc.cloud?.stoppedSharing)) throw {code:'40001'};
    if(remote && !doc.shared && !doc.cloud?.stoppedSharing && remote.cloud?.revision!==doc.cloud?.revision) throw {code:'40001'};
  }
  if(doc.shared?.ownerToken){
    const response=await fetch(`${doc.shared.server}/rooms/${doc.shared.room}`,{method:'DELETE',headers:{Authorization:`Bearer ${doc.shared.ownerToken}`},signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'no-referrer'});
    // A room already revoked by this owner is also safe to remove locally.
    if(!response.ok && response.status!==404)throw new Error('No se pudo desactivar el enlace compartido. El documento se conserva; revisa tu conexión e inténtalo otra vez.');
    onRevoked();
  }
  if(remote && session) await removeCloudDocument(session,{id:remote.id,version:remote.cloud!.revision,title:remote.title,size_bytes:0,updated_at:new Date(remote.updated).toISOString()});
}
