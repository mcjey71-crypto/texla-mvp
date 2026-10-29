import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const filename = "10000000-0000-4000-8000-000000000001.bin";
async function user(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  await db.exec(
    `create role authenticated;create role anon;create schema auth;create schema storage;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated,anon;grant execute on all functions in schema storage,auth to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant usage on sequence storage.objects_id_seq to authenticated;`,
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202610290001_image_storage.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
}, 30000);
afterAll(() => db.close());
describe.sequential("encrypted image storage policies", () => {
  it("limits the bucket to bounded encrypted payloads", async () => {
    expect(
      (
        await db.query(
          "select public,file_size_limit,allowed_mime_types from storage.buckets",
        )
      ).rows[0],
    ).toMatchObject({
      public: true,
      file_size_limit: 1048640,
      allowed_mime_types: ["application/octet-stream"],
    });
  });
  it("only lets a signed-in owner upload to their own folder", async () => {
    await user(alice);
    await db.query(
      "insert into storage.objects(bucket_id,name) values($1,$2)",
      ["texla-images", `${alice}/${filename}`],
    );
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "texla-images",
        `${bob}/${filename}`,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "texla-images",
        `${alice}/file.svg`,
      ]),
    ).rejects.toThrow();
  });
  it("prevents another user from listing, replacing or deleting the file", async () => {
    await user(bob);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("delete from storage.objects returning id")).rows,
    ).toHaveLength(0);
    await user(alice);
    expect(
      (await db.query("update storage.objects set name='changed' returning id"))
        .rows,
    ).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
  });
  it("denies anonymous uploads and permits owner cleanup through Storage", async () => {
    await db.exec("reset role;set role anon;");
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "texla-images",
        `${alice}/${filename}`,
      ]),
    ).rejects.toThrow();
    await user(alice);
    expect(
      (await db.query("delete from storage.objects returning id")).rows,
    ).toHaveLength(1);
  });
});
