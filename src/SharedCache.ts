import * as Y from 'yjs';
import {sharedId,type SharedAccess} from '../shared/collaboration';

export const sharedCacheName=(access:SharedAccess)=>`texla-collaboration-v1:${sharedId(access)}`;
export function removeSharedCache(access:SharedAccess):Promise<void>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(sharedCacheName(access));
    const timeout=setTimeout(()=>reject(new Error('La copia de sincronización sigue ocupada en otra pestaña.')),4000);
    request.onsuccess=()=>{clearTimeout(timeout);resolve();};
    request.onerror=request.onblocked=()=>{clearTimeout(timeout);reject(new Error('No se pudo limpiar la copia de sincronización.'));};
  });
}

/** A transactional CRDT cache. Merge with the stored state so tabs cannot overwrite each other. */
export class SharedCache {
  readonly whenSynced: Promise<void>;
  private db?: IDBDatabase;
  private stopped = false;
  constructor(readonly name: string, private doc: Y.Doc, private onError: () => void) {
    this.whenSynced = new Promise((resolve, reject) => {
      const opening = indexedDB.open(name, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('updates');
      opening.onerror = () => { onError(); reject(opening.error); };
      opening.onblocked = () => { onError(); reject(new Error('Almacenamiento bloqueado.')); };
      opening.onsuccess = () => {
        const db = opening.result;
        if (this.stopped) { db.close(); resolve(); return; }
        this.db = db;
        db.onversionchange = () => { db.close(); this.db = undefined; onError(); };
        const tx = db.transaction('updates', 'readonly'); const request = tx.objectStore('updates').get('state');
        request.onsuccess = () => {
          try { if (request.result && !this.stopped) Y.applyUpdate(doc, new Uint8Array(request.result), this); }
          catch { onError(); reject(new Error('La copia local no se pudo leer.')); }
        };
        tx.onabort = tx.onerror = () => { onError(); reject(tx.error); };
        tx.oncomplete = () => {
          if (!this.stopped) { doc.on('update', this.save); this.save(Y.encodeStateAsUpdate(doc), undefined); }
          resolve();
        };
      };
    });
  }
  private save = (update: Uint8Array, origin: unknown) => {
    if (!this.db || this.stopped || origin === this) return;
    try {
      const tx = this.db.transaction('updates', 'readwrite'); const store = tx.objectStore('updates'); const request = store.get('state');
      tx.onabort = tx.onerror = () => this.onError();
      request.onsuccess = () => {
        const merged = new Y.Doc();
        try {
          if (request.result) Y.applyUpdate(merged, new Uint8Array(request.result));
          Y.applyUpdate(merged, update); store.put(Y.encodeStateAsUpdate(merged), 'state');
        } catch { tx.abort(); this.onError(); } finally { merged.destroy(); }
      };
    } catch { this.onError(); }
  };
  destroy() { this.stopped = true; this.doc.off('update', this.save); this.db?.close(); }
}
