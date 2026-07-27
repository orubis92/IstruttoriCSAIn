-- ============================================================================
--  05_chat_certificati.sql — certificati medici strutturati e chat interna
--
--  Contiene:
--    1. certificati_medici: dati del certificato medico di ogni atleta (dati
--       sanitari, art. 9 GDPR) — gestiti dallo staff, visibili all'atleta.
--    2. chat interna: conversazioni dirette e di gruppo, con permessi per
--       appartenenza. Un utente vede solo le conversazioni di cui è membro.
--       Consente anche di scrivere ai programmatori (attraversa le ASD, ma solo
--       tramite messaggi espliciti: nessun dato di una ASD è esposto a un'altra).
--
--  La colonna note delle giornate esiste già in giornate.note (00_schema.sql):
--  qui non serve alcuna modifica, la usa il frontend.
--
--  Eseguire dopo 00,01,02 (03,04 opzionali). Idempotente su enum e funzioni.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. CERTIFICATI MEDICI
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_certificato_medico') then
    create type tipo_certificato_medico as enum ('AGONISTICO', 'NON_AGONISTICO');
  end if;
end $$;

create table if not exists certificati_medici (
  id             uuid primary key default gen_random_uuid(),
  atleta_id      uuid not null,
  asd_id         uuid not null,
  tipo           tipo_certificato_medico,
  data_rilascio  date,
  data_scadenza  date,
  ente_rilascio  text,
  medico         text,
  note           text,
  documento_id   uuid references documenti(id) on delete set null,
  creato_da      uuid references utenti(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  foreign key (atleta_id, asd_id) references utenti (id, asd_id) on delete cascade
);

create index if not exists certificati_atleta_idx on certificati_medici (atleta_id);
create index if not exists certificati_scadenza_idx on certificati_medici (asd_id, data_scadenza);

drop trigger if exists t_certificati_touch on certificati_medici;
create trigger t_certificati_touch before update on certificati_medici
  for each row execute function app.tocca_timestamp();

alter table certificati_medici enable row level security;

drop policy if exists certificati_select on certificati_medici;
create policy certificati_select on certificati_medici for select to authenticated
  using ( app.is_staff_di(asd_id) or atleta_id = app.mio_id() );

drop policy if exists certificati_write on certificati_medici;
create policy certificati_write on certificati_medici for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );

grant select, insert, update, delete on certificati_medici to authenticated;


-- ----------------------------------------------------------------------------
--  2. CHAT
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_conversazione') then
    create type tipo_conversazione as enum ('DIRETTA', 'GRUPPO');
  end if;
end $$;

create table if not exists conversazioni (
  id                  uuid primary key default gen_random_uuid(),
  tipo                tipo_conversazione not null,
  nome                text,                                  -- per i gruppi
  asd_id              uuid references asd(id) on delete set null,
  creato_da           uuid references utenti(id) on delete set null,
  creato_il           timestamptz not null default now(),
  ultimo_messaggio_il timestamptz not null default now()
);

create table if not exists conversazione_membri (
  conversazione_id uuid not null references conversazioni(id) on delete cascade,
  utente_id        uuid not null references utenti(id) on delete cascade,
  aggiunto_il      timestamptz not null default now(),
  primary key (conversazione_id, utente_id)
);
create index if not exists conv_membri_utente_idx on conversazione_membri (utente_id);

create table if not exists messaggi (
  id               uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references conversazioni(id) on delete cascade,
  mittente_id      uuid references utenti(id) on delete set null,
  testo            text not null,
  creato_il        timestamptz not null default now()
);
create index if not exists messaggi_conv_idx on messaggi (conversazione_id, creato_il);

-- Sono membro della conversazione indicata? SECURITY DEFINER per evitare la
-- ricorsione tra le policy (le policy leggono conversazione_membri).
create or replace function app.e_membro(p_conv uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.conversazione_membri m
    join public.utenti u on u.id = m.utente_id
    where m.conversazione_id = p_conv and u.auth_id = auth.uid() and u.attivo
  );
$$;

-- Il destinatario è un contatto ammesso per l'utente corrente?
create or replace function app.contatto_ammesso(p_utente uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.utenti u
    where u.id = p_utente and u.attivo
      and (app.is_programmatore() or u.ruolo = 'PROGRAMMATORE' or u.asd_id = app.mia_asd())
  );
$$;

-- Aggiorna l'ora dell'ultimo messaggio (per ordinare le conversazioni).
create or replace function app.bump_conversazione() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversazioni set ultimo_messaggio_il = now() where id = new.conversazione_id;
  return new;
end $$;

drop trigger if exists t_messaggi_bump on messaggi;
create trigger t_messaggi_bump after insert on messaggi
  for each row execute function app.bump_conversazione();

alter table conversazioni enable row level security;
alter table conversazione_membri enable row level security;
alter table messaggi enable row level security;

drop policy if exists conversazioni_select on conversazioni;
create policy conversazioni_select on conversazioni for select to authenticated
  using ( app.e_membro(id) );

drop policy if exists conv_membri_select on conversazione_membri;
create policy conv_membri_select on conversazione_membri for select to authenticated
  using ( app.e_membro(conversazione_id) );

drop policy if exists messaggi_select on messaggi;
create policy messaggi_select on messaggi for select to authenticated
  using ( app.e_membro(conversazione_id) );

drop policy if exists messaggi_insert on messaggi;
create policy messaggi_insert on messaggi for insert to authenticated
  with check ( app.e_membro(conversazione_id) and mittente_id = app.mio_id() );

-- (creazione conversazioni e gestione membri: solo tramite le RPC qui sotto)

-- Vista dei contatti con cui l'utente può avviare una chat: i programmatori
-- (per tutti) e i membri della propria ASD. Espone solo nome/cognome/ruolo,
-- mai dati sensibili. security_invoker=false: gira come proprietario.
create or replace view v_contatti with (security_invoker = false, security_barrier = true) as
  select u.id, u.nome, u.cognome, u.ruolo, u.asd_id
  from utenti u
  where u.attivo
    and (app.is_programmatore() or u.ruolo = 'PROGRAMMATORE' or u.asd_id = app.mia_asd());

grant select on v_contatti to authenticated;

-- Crea (o riusa) una conversazione diretta tra l'utente corrente e un altro.
create or replace function public.crea_conversazione_diretta(p_altro uuid)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io   uuid := app.mio_id();
  v_conv uuid;
begin
  if v_io is null then raise exception 'Non autenticato' using errcode = '42501'; end if;
  if p_altro = v_io then raise exception 'Non puoi chattare con te stesso' using errcode = '22023'; end if;
  if not app.contatto_ammesso(p_altro) then
    raise exception 'Destinatario non valido' using errcode = '42501';
  end if;

  select c.id into v_conv
  from conversazioni c
  where c.tipo = 'DIRETTA'
    and exists (select 1 from conversazione_membri m where m.conversazione_id = c.id and m.utente_id = v_io)
    and exists (select 1 from conversazione_membri m where m.conversazione_id = c.id and m.utente_id = p_altro)
    and (select count(*) from conversazione_membri m where m.conversazione_id = c.id) = 2
  limit 1;

  if v_conv is not null then return v_conv; end if;

  insert into conversazioni (tipo, creato_da) values ('DIRETTA', v_io) returning id into v_conv;
  insert into conversazione_membri (conversazione_id, utente_id) values (v_conv, v_io), (v_conv, p_altro);
  return v_conv;
end $$;

-- Crea una conversazione di gruppo con i membri indicati (più il creatore).
create or replace function public.crea_gruppo(p_nome text, p_membri uuid[])
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io   uuid := app.mio_id();
  v_conv uuid;
  v_m    uuid;
begin
  if v_io is null then raise exception 'Non autenticato' using errcode = '42501'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Il gruppo deve avere un nome' using errcode = '22023'; end if;

  insert into conversazioni (tipo, nome, asd_id, creato_da)
       values ('GRUPPO', p_nome, app.mia_asd(), v_io)
    returning id into v_conv;
  insert into conversazione_membri (conversazione_id, utente_id) values (v_conv, v_io);

  if p_membri is not null then
    foreach v_m in array p_membri loop
      if v_m <> v_io and app.contatto_ammesso(v_m) then
        insert into conversazione_membri (conversazione_id, utente_id)
             values (v_conv, v_m)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_conv;
end $$;

grant select on conversazioni, conversazione_membri, messaggi to authenticated;
grant insert on messaggi to authenticated;
grant execute on function public.crea_conversazione_diretta(uuid) to authenticated;
grant execute on function public.crea_gruppo(text, uuid[]) to authenticated;
