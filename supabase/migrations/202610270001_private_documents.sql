-- Execute once in Supabase SQL Editor. This migration does not move or delete existing documents.
begin;

create table if not exists public.texla_documents (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  payload jsonb not null,
  version bigint not null default 1,
  size_bytes bigint generated always as (octet_length(payload::text)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint texla_payload_format check ((
    payload->>'application' = 'texla-docs' and payload->>'version' = '1'
    and jsonb_typeof(payload->'document') = 'object'
    and jsonb_typeof(payload#>'{document,content}') = 'object'
    and payload#>>'{document,content,type}' = 'doc'
    and jsonb_typeof(payload#>'{document,references}') = 'array'
    and jsonb_typeof(payload#>'{document,title}') = 'string'
    and length(payload#>>'{document,title}') <= 500
    and not ((payload->'document') ?| array['shared', 'cloud', 'ownerToken', 'token'])
  ) is true)
);
create index if not exists texla_documents_owner_updated on public.texla_documents(owner_id, updated_at desc);
alter table public.texla_documents enable row level security;
revoke all on public.texla_documents from anon, authenticated;
grant select, insert, update, delete on public.texla_documents to authenticated;

drop policy if exists texla_owner_read on public.texla_documents;
create policy texla_owner_read on public.texla_documents for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists texla_owner_insert on public.texla_documents;
create policy texla_owner_insert on public.texla_documents for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists texla_owner_update on public.texla_documents;
create policy texla_owner_update on public.texla_documents for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists texla_owner_delete on public.texla_documents;
create policy texla_owner_delete on public.texla_documents for delete to authenticated using (owner_id = (select auth.uid()));

-- A fixed search_path and fully qualified identifiers keep this definer trigger scoped.
-- Its only privileged read is a quota aggregate; no other user's document is returned.
create or replace function public.enforce_texla_document_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  current_count bigint;
  account_bytes bigint;
  all_bytes bigint;
  incoming_bytes bigint;
begin
  if account_id is null or new.owner_id <> account_id then raise exception 'Document owner does not match session' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (new.owner_id <> old.owner_id or new.id <> old.id) then raise exception 'Document identity is immutable' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(7810171);
  incoming_bytes := pg_catalog.octet_length(new.payload::text);
  select count(*), coalesce(sum(size_bytes), 0) into current_count, account_bytes from public.texla_documents where owner_id = account_id and id <> new.id;
  select coalesce(sum(size_bytes), 0) into all_bytes from public.texla_documents where id <> new.id;
  if incoming_bytes > 1048576 or current_count >= 50 or account_bytes + incoming_bytes > 10485760 or all_bytes + incoming_bytes > 262144000 then
    raise exception 'TEXLA_QUOTA: document/account/server quota reached' using errcode = 'P0001';
  end if;
  new.title := new.payload#>>'{document,title}';
  new.updated_at := pg_catalog.clock_timestamp();
  if tg_op = 'UPDATE' then new.version := old.version + 1; new.created_at := old.created_at;
  else new.version := 1; new.created_at := pg_catalog.clock_timestamp(); end if;
  return new;
end;
$$;
revoke all on function public.enforce_texla_document_limits() from public, anon, authenticated;
drop trigger if exists texla_document_limits on public.texla_documents;
create trigger texla_document_limits before insert or update on public.texla_documents for each row execute function public.enforce_texla_document_limits();

create or replace function public.save_texla_document(p_id uuid, p_payload jsonb, p_expected_version bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing_version bigint; existing_payload jsonb; saved_version bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Use the same ordering as the quota trigger to avoid competing writers' deadlocks.
  perform pg_catalog.pg_advisory_xact_lock(7810171);
  select version, payload into existing_version, existing_payload from public.texla_documents where id = p_id and owner_id = auth.uid() for update;
  if found then
    if existing_version <> p_expected_version then
      -- A lost acknowledgement can safely retry the exact same content.
      if existing_payload = p_payload then return pg_catalog.jsonb_build_object('version', existing_version); end if;
      raise exception 'Document changed in another session' using errcode = '40001';
    end if;
    update public.texla_documents set payload = p_payload where id = p_id and owner_id = auth.uid() returning version into saved_version;
  else
    if p_expected_version <> 0 then raise exception 'Document was removed or is unavailable' using errcode = 'P0002'; end if;
    insert into public.texla_documents(id, owner_id, title, payload) values (p_id, auth.uid(), '', p_payload) returning version into saved_version;
  end if;
  return pg_catalog.jsonb_build_object('version', saved_version);
end;
$$;
revoke all on function public.save_texla_document(uuid, jsonb, bigint) from public, anon;
grant execute on function public.save_texla_document(uuid, jsonb, bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
