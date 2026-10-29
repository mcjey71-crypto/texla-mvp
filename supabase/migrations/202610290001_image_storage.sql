-- Run once in the Supabase SQL Editor for the same project used by Texla.
-- Files are AES-GCM encrypted in the browser. The public endpoint serves only
-- ciphertext; the image key is kept in the private/shared document, not the URL.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('texla-images','texla-images',true,1048640,array['application/octet-stream'])
on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='texla-images' and public=true
    and file_size_limit=1048640 and allowed_mime_types=array['application/octet-stream']) then
    raise exception 'A bucket named texla-images already exists with different settings. Do not publish existing files: rename that bucket before running this script.';
  end if;
end $$;
drop policy if exists texla_images_owner_read on storage.objects;
create policy texla_images_owner_read on storage.objects for select to authenticated
using(bucket_id='texla-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists texla_images_owner_insert on storage.objects;
create policy texla_images_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='texla-images' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.bin$');
drop policy if exists texla_images_owner_delete on storage.objects;
create policy texla_images_owner_delete on storage.objects for delete to authenticated
using(bucket_id='texla-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No UPDATE policy: encrypted objects are immutable. A replacement is a new file.
commit;
