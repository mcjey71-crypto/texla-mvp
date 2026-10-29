import {describe,it,expect} from 'vitest';
import {applySharedDocument,joinSharedDocument,readAccountCollaboration} from './sharedDocumentIdentity';
import {cloudRecordPayload} from './cloudDocuments';
import {makeBackup,readBackup,type SavedDocument} from './backup';
const access={server:'https://example.com',room:'a'.repeat(32),token:'b'.repeat(64),ownerToken:'c'.repeat(64)};
const original:SavedDocument={id:'local-id',title:'Una tesis',content:{type:'doc',content:[{type:'paragraph'}]},updated:0};
describe('sharing one document identity',()=>{
 it('replaces the document in place and repeated link opens do not add copies',()=>{
  const shared={...original,shared:access};const result=applySharedDocument([original],shared);expect(result).toHaveLength(1);expect(result[0].id).toBe('local-id');
  const joined=joinSharedDocument(result,{server:access.server,room:access.room,token:access.token});expect(joined.documents).toHaveLength(1);expect(joined.document.id).toBe('local-id');expect(joined.document.shared?.ownerToken).toBe(access.ownerToken);
 });
 it('never confuses two documents with the same title',()=>{
  const other={...original,id:'other'};expect(applySharedDocument([original,other],{...original,shared:access})).toHaveLength(2);
 });
 it('keeps account capabilities separate from downloadable document backups',()=>{
  const shared={...original,shared:access};const record=cloudRecordPayload(shared);expect(record.collaboration).toEqual(access);expect(record.document).not.toHaveProperty('shared');
  expect(makeBackup(shared)).not.toContain(access.token);expect(readBackup(JSON.stringify(record))).not.toHaveProperty('shared');
  expect(()=>readAccountCollaboration({...access,ownerToken:'invalid'})).toThrow();expect(()=>readAccountCollaboration({...access,server:'javascript:alert(1)'})).toThrow();
 });
});
