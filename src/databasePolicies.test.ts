import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const id = '10000000-0000-4000-8000-000000000001';
const payload = (title:string, text = 'Texto privado') => ({ application:'texla-docs',version:1,document:{title,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]},references:[],citationStyle:'ieee',format:{}} });
async function asUser(uid:string) { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`); }
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon; insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610270001_private_documents.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });
describe.sequential('database isolation and quotas using PostgreSQL', () => {
  it('stores only the authenticated owner and increments the revision', async () => {
    await asUser(alice); const result = await db.query<{save_texla_document:{version:number}}>('select public.save_texla_document($1,$2::jsonb,0)',[id,JSON.stringify(payload('Tesis de Ana'))]);
    expect(result.rows[0].save_texla_document.version).toBe(1);
    const retry = await db.query<{save_texla_document:{version:number}}>('select public.save_texla_document($1,$2::jsonb,0)',[id,JSON.stringify(payload('Tesis de Ana'))]); expect(retry.rows[0].save_texla_document.version).toBe(1);
    const rows = await db.query<{owner_id:string}>('select owner_id from public.texla_documents'); expect(rows.rows).toEqual([{owner_id:alice}]);
  });
  it('hides another account’s documents and prevents changing or deleting them', async () => {
    await asUser(bob);
    expect((await db.query('select * from public.texla_documents')).rows).toHaveLength(0);
    expect((await db.query('update public.texla_documents set title = $1 where id = $2 returning id',['Changed',id])).rows).toHaveLength(0);
    expect((await db.query('delete from public.texla_documents where id = $1 returning id',[id])).rows).toHaveLength(0);
    await expect(db.query('insert into public.texla_documents(id,owner_id,title,payload) values (gen_random_uuid(),$1,$2,$3::jsonb)',[alice,'Fake',JSON.stringify(payload('Fake'))])).rejects.toThrow();
    await expect(db.query('select public.save_texla_document($1,$2::jsonb,1)',[id,JSON.stringify(payload('Intrusión'))])).rejects.toThrow();
  });
  it('rejects stale writes rather than silently replacing another device’s work', async () => {
    await asUser(alice);
    await db.query('select public.save_texla_document($1,$2::jsonb,1)',[id,JSON.stringify(payload('Versión nueva'))]);
    await expect(db.query('select public.save_texla_document($1,$2::jsonb,1)',[id,JSON.stringify(payload('Versión antigua'))])).rejects.toThrow();
    expect((await db.query<{title:string}>('select title from public.texla_documents where id=$1',[id])).rows[0].title).toBe('Versión nueva');
  });
  it('denies anonymous reads and enforces payload validation, size and immutable owners', async () => {
    await db.exec('reset role; set role anon;'); await expect(db.query('select * from public.texla_documents')).rejects.toThrow();
    await asUser(alice);
    await expect(db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify({})])).rejects.toThrow();
    await expect(db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload('Grande','x'.repeat(1048576)))])).rejects.toThrow();
    await expect(db.query('update public.texla_documents set owner_id=$1 where id=$2',[bob,id])).rejects.toThrow();
    const invalid = payload('Token'); (invalid.document as Record<string,unknown>).shared = {token:'private'};
    await expect(db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(invalid)])).rejects.toThrow();
  });
  it('keeps collaboration access in the same owner-only account row', async () => {
    await asUser(alice);
    const shared = {...payload('Tesis con enlace'),collaboration:{server:'https://example.com',room:'a'.repeat(32),token:'b'.repeat(64),ownerToken:'c'.repeat(64)}};
    const result = await db.query<{save_texla_document:{version:number}}>('select public.save_texla_document($1,$2::jsonb,2)',[id,JSON.stringify(shared)]);
    expect(result.rows[0].save_texla_document.version).toBe(3);
    await asUser(bob);expect((await db.query('select payload from public.texla_documents where id=$1',[id])).rows).toHaveLength(0);
    await db.exec('reset role;set role anon;');await expect(db.query('select payload from public.texla_documents where id=$1',[id])).rejects.toThrow();
    await asUser(alice);expect((await db.query('select id from public.texla_documents where id=$1',[id])).rows).toHaveLength(1);
  });
  it('limits account document count and releases quota after deletion', async () => {
    await asUser(bob);
    for(let i=0;i<50;i++) await db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload(`Doc ${i}`))]);
    await expect(db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload('Extra'))])).rejects.toThrow();
    await db.exec('delete from public.texla_documents where id = (select id from public.texla_documents limit 1)');
    await db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload('Reemplazo'))]);
    expect((await db.query<{count:number}>('select count(*)::int as count from public.texla_documents')).rows[0].count).toBe(50);
  });
  it('enforces total bytes per account independently of the document count', async () => {
    await asUser(alice);
    for(let i=0;i<11;i++) await db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload(`Capítulo ${i}`,'x'.repeat(900000)))]);
    await expect(db.query('select public.save_texla_document(gen_random_uuid(),$1::jsonb,0)',[JSON.stringify(payload('Sin espacio','x'.repeat(900000)))])).rejects.toThrow();
  }, 20000);
});
