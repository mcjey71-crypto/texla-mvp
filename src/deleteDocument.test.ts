import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {Session} from '@supabase/supabase-js';
import type {SavedDocument} from './backup';
vi.mock('./cloudDocuments',()=>({loadCloudDocument:vi.fn(),removeCloudDocument:vi.fn()}));
import {loadCloudDocument,removeCloudDocument} from './cloudDocuments';
import {deleteRemoteDocument} from './deleteDocument';
const session={user:{id:'owner'}} as Session;
const access={server:'https://example.com',room:'a'.repeat(32),token:'b'.repeat(64),ownerToken:'c'.repeat(64)};
const document:SavedDocument={id:'document',title:'Prueba',content:{type:'doc',content:[{type:'paragraph'}]},updated:0,cloud:{ownerId:'owner',revision:2,dirty:false}};
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:200})));vi.mocked(loadCloudDocument).mockResolvedValue(document);});
describe('document deletion permissions and failure ordering',()=>{
 it('never sends a revoke request for a guest or a local private document',async()=>{
  await deleteRemoteDocument(()=>({...document,cloud:undefined,shared:{...access,ownerToken:undefined}}),null,vi.fn());
  await deleteRemoteDocument(()=>({...document,cloud:undefined}),null,vi.fn());expect(fetch).not.toHaveBeenCalled();expect(removeCloudDocument).not.toHaveBeenCalled();
 });
 it('rejects deletion when another device changed a private document',async()=>{
  vi.mocked(loadCloudDocument).mockResolvedValue({...document,cloud:{...document.cloud!,revision:3}});
  await expect(deleteRemoteDocument(()=>document,session,vi.fn())).rejects.toMatchObject({code:'40001'});expect(removeCloudDocument).not.toHaveBeenCalled();
 });
 it('does not delete the account record when revoking the link fails',async()=>{
  const shared={...document,shared:access};vi.mocked(loadCloudDocument).mockResolvedValue(shared);vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:503}));
  const revoked=vi.fn();await expect(deleteRemoteDocument(()=>shared,session,revoked)).rejects.toThrow('No se pudo desactivar');expect(revoked).not.toHaveBeenCalled();expect(removeCloudDocument).not.toHaveBeenCalled();
 });
 it('revokes owner links before account deletion and reports the intermediate state',async()=>{
  const shared={...document,shared:access};vi.mocked(loadCloudDocument).mockResolvedValue(shared);vi.mocked(removeCloudDocument).mockRejectedValue({code:'40001'});const revoked=vi.fn();
  await expect(deleteRemoteDocument(()=>shared,session,revoked)).rejects.toMatchObject({code:'40001'});expect(revoked).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/rooms/'),expect.objectContaining({method:'DELETE',credentials:'omit'}));
 });
 it('allows cleanup of already missing records and refuses a different account',async()=>{
  vi.mocked(loadCloudDocument).mockRejectedValue({code:'PGRST116'});await deleteRemoteDocument(()=>document,session,vi.fn());expect(removeCloudDocument).not.toHaveBeenCalled();
  await expect(deleteRemoteDocument(()=>document,{user:{id:'stranger'}} as Session,vi.fn())).rejects.toThrow('propietaria');
 });
});
