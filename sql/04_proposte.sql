-- ============================================================================
--  04_proposte.sql — proposte di corso standard e loro revisione
--
--  Flusso:
--    1. lo staff di una ASD "propone" un proprio corso come corso standard:
--       viene creata una riga in proposte_corso con uno SNAPSHOT del corso e
--       delle sue giornate (titolo, obiettivi, argomenti, durata).
--    2. i PROGRAMMATORI vedono tutte le proposte e possono accettarle o
--       rifiutarle.
--    3. all'accettazione, lo snapshot diventa un modello_corso di piattaforma
--       (asd_id NULL) con le relative modelli_giornata: da quel momento è una
--       linea guida disponibile a TUTTE le ASD in modalita "guidata".
--
--  Lo snapshot serve a non richiedere ai programmatori l'accesso ai corsi delle
--  singole ASD (che l'isolamento multi-tenant vieta): la proposta e' autonoma.
--
--  Eseguire dopo 00_schema.sql, 01_rls.sql, 02_storage.sql (03_seed.sql è
--  opzionale). Idempotente per l'enum e le funzioni; la tabella usa IF NOT EXISTS.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'stato_proposta') then
    create type stato_proposta as enum ('IN_REVISIONE', 'ACCETTATA', 'RIFIUTATA');
  end if;
end $$;

create table if not exists proposte_corso (
  id             uuid primary key default gen_random_uuid(),
  asd_id         uuid not null references asd(id) on delete cascade,
  corso_id       uuid,                 -- corso di origine (facoltativo, solo riferimento)
  titolo         text not null,
  descrizione    text,
  livello        text,
  -- snapshot delle giornate: [{ordine, titolo, obiettivi, argomenti[], durata_minuti}]
  giornate       jsonb not null default '[]'::jsonb,
  stato          stato_proposta not null default 'IN_REVISIONE',
  note_revisione text,                 -- feedback del programmatore (soprattutto se rifiutata)
  modello_id     uuid references modelli_corso(id) on delete set null, -- valorizzato se accettata
  proposto_da    uuid references utenti(id) on delete set null,
  proposto_il    timestamptz not null default now(),
  revisionato_da uuid references utenti(id) on delete set null,
  revisionato_il timestamptz
);

create index if not exists proposte_asd_idx on proposte_corso (asd_id, stato);
create index if not exists proposte_stato_idx on proposte_corso (stato);
-- Un corso non può avere due proposte pendenti contemporaneamente.
create unique index if not exists proposte_corso_pendente
  on proposte_corso (corso_id) where stato = 'IN_REVISIONE' and corso_id is not null;

alter table proposte_corso enable row level security;

-- Lettura: lo staff vede le proposte della propria ASD, i programmatori tutte.
drop policy if exists proposte_select on proposte_corso;
create policy proposte_select on proposte_corso for select to authenticated
  using ( app.is_programmatore() or app.is_staff_di(asd_id) );

-- Inserimento: lo staff propone per la propria ASD, sempre in stato IN_REVISIONE.
drop policy if exists proposte_insert on proposte_corso;
create policy proposte_insert on proposte_corso for insert to authenticated
  with check ( app.is_staff_di(asd_id) and stato = 'IN_REVISIONE' );

-- Cancellazione (ritiro): lo staff può ritirare una propria proposta ancora in
-- revisione; i programmatori possono rimuovere qualsiasi proposta.
drop policy if exists proposte_delete on proposte_corso;
create policy proposte_delete on proposte_corso for delete to authenticated
  using (
       app.is_programmatore()
    or (app.is_staff_di(asd_id) and stato = 'IN_REVISIONE')
  );

-- L'aggiornamento (accetta/rifiuta) passa dalle funzioni dedicate qui sotto,
-- che girano come proprietario; nessuna policy di UPDATE per i client.

-- ----------------------------------------------------------------------------
--  RPC
-- ----------------------------------------------------------------------------

-- Accetta una proposta: crea il modello_corso di piattaforma + le giornate e
-- segna la proposta come ACCETTATA. Solo PROGRAMMATORE.
create or replace function public.accetta_proposta(p_proposta uuid)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r          proposte_corso%rowtype;
  v_modello  uuid;
begin
  if not app.is_programmatore() then
    raise exception 'Solo un programmatore può accettare una proposta' using errcode = '42501';
  end if;

  select * into r from proposte_corso where id = p_proposta for update;
  if not found then
    raise exception 'Proposta non trovata' using errcode = '22023';
  end if;
  if r.stato <> 'IN_REVISIONE' then
    raise exception 'La proposta è già stata gestita' using errcode = '22023';
  end if;

  insert into modelli_corso (asd_id, titolo, descrizione, livello, creato_da)
       values (null, r.titolo, r.descrizione, r.livello, app.mio_id())
    returning id into v_modello;

  insert into modelli_giornata (modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti)
  select
    v_modello,
    coalesce((g->>'ordine')::int, (row_number() over ())::int),
    coalesce(g->>'titolo', 'Giornata'),
    nullif(g->>'obiettivi', ''),
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(g->'argomenti', '[]'::jsonb)) x),
      '{}'
    ),
    nullif(g->>'durata_minuti', '')::int
  from jsonb_array_elements(r.giornate) with ordinality as t(g, ord)
  order by ord;

  update proposte_corso
     set stato = 'ACCETTATA',
         modello_id = v_modello,
         revisionato_da = app.mio_id(),
         revisionato_il = now()
   where id = p_proposta;

  return v_modello;
end $$;

-- Rifiuta una proposta con una nota di motivazione. Solo PROGRAMMATORE.
create or replace function public.rifiuta_proposta(p_proposta uuid, p_note text default null)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_programmatore() then
    raise exception 'Solo un programmatore può rifiutare una proposta' using errcode = '42501';
  end if;

  update proposte_corso
     set stato = 'RIFIUTATA',
         note_revisione = p_note,
         revisionato_da = app.mio_id(),
         revisionato_il = now()
   where id = p_proposta and stato = 'IN_REVISIONE';

  if not found then
    raise exception 'Proposta non trovata o già gestita' using errcode = '22023';
  end if;
end $$;

grant select, insert, delete on proposte_corso to authenticated;
grant execute on function public.accetta_proposta(uuid) to authenticated;
grant execute on function public.rifiuta_proposta(uuid, text) to authenticated;
