-- ============================================================================
--  Stub locale dei componenti Supabase (auth + storage), SOLO per i test.
--  Su Supabase questi oggetti esistono già: NON eseguire questo file in produzione.
-- ============================================================================

-- I ruoli sono globali al cluster: creali solo se mancano.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant anon, authenticated, service_role to postgres;

-- ---- auth -------------------------------------------------------------------
create schema auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Su Supabase legge il JWT; qui leggiamo una variabile di sessione.
create function auth.uid() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select on auth.users to authenticated;

-- ---- storage ----------------------------------------------------------------
create schema storage;

create table storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

grant usage on schema storage to authenticated;
grant select on storage.buckets to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
