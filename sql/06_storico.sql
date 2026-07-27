-- ============================================================================
--  06_storico.sql — valutazioni, commenti e diplomi
--
--  Contiene:
--    1. iscrizioni: due nuovi campi per la valutazione finale dell'atleta
--       (esito + valutazione testuale). Servono allo storico dei corsi.
--    2. commenti: note libere su un corso o su una singola giornata, scrivibili
--       dallo staff e dagli atleti iscritti; utili per tracciare storici e
--       problemi ricorrenti da migliorare nei corsi successivi.
--    3. corso_istruttori: gli istruttori che hanno partecipato a un corso, con
--       l'eventuale firma (immagine PNG come data URL) da stampare sui diplomi.
--
--  Eseguire dopo 00,01,02. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. VALUTAZIONI SULLE ISCRIZIONI
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'esito_corso') then
    create type esito_corso as enum ('SUPERATO', 'NON_SUPERATO');
  end if;
end $$;

alter table iscrizioni add column if not exists esito esito_corso;
alter table iscrizioni add column if not exists valutazione text;

-- (le policy esistenti su iscrizioni bastano: solo lo staff aggiorna, quindi
--  solo lo staff può impostare esito e valutazione.)


-- ----------------------------------------------------------------------------
--  2. COMMENTI (corso / giornata)
-- ----------------------------------------------------------------------------

create table if not exists commenti (
  id           uuid primary key default gen_random_uuid(),
  asd_id       uuid not null references asd(id) on delete cascade,
  corso_id     uuid not null,
  giornata_id  uuid,                 -- se valorizzato: commento sulla giornata
  autore_id    uuid references utenti(id) on delete set null,
  testo        text not null,
  creato_il    timestamptz not null default now(),
  foreign key (corso_id, asd_id)    references corsi    (id, asd_id) on delete cascade,
  foreign key (giornata_id, asd_id) references giornate (id, asd_id) on delete cascade
);
create index if not exists commenti_corso_idx on commenti (corso_id, creato_il);
create index if not exists commenti_giornata_idx on commenti (giornata_id);

alter table commenti enable row level security;

-- Visibili allo staff della ASD e agli atleti iscritti al corso.
drop policy if exists commenti_select on commenti;
create policy commenti_select on commenti for select to authenticated
  using ( app.is_staff_di(asd_id) or app.e_iscritto_a(corso_id) );

-- Scrivibili dallo staff e dagli atleti iscritti; autore = se stessi.
drop policy if exists commenti_insert on commenti;
create policy commenti_insert on commenti for insert to authenticated
  with check (
    autore_id = app.mio_id()
    and (app.is_staff_di(asd_id) or app.e_iscritto_a(corso_id))
  );

-- Cancellabili dall'autore o dallo staff.
drop policy if exists commenti_delete on commenti;
create policy commenti_delete on commenti for delete to authenticated
  using ( app.is_staff_di(asd_id) or autore_id = app.mio_id() );

grant select, insert, delete on commenti to authenticated;


-- ----------------------------------------------------------------------------
--  3. ISTRUTTORI DEL CORSO (per i diplomi, con firma)
-- ----------------------------------------------------------------------------

create table if not exists corso_istruttori (
  id            uuid primary key default gen_random_uuid(),
  corso_id      uuid not null,
  asd_id        uuid not null,
  istruttore_id uuid not null,
  firma         text,               -- immagine della firma come data URL (PNG), opzionale
  creato_il     timestamptz not null default now(),
  unique (corso_id, istruttore_id),
  foreign key (corso_id, asd_id)      references corsi  (id, asd_id) on delete cascade,
  foreign key (istruttore_id, asd_id) references utenti (id, asd_id) on delete cascade
);
create index if not exists corso_istruttori_corso_idx on corso_istruttori (corso_id);

alter table corso_istruttori enable row level security;

-- Visibili allo staff e agli atleti iscritti (per stampare/vedere il diploma).
drop policy if exists corso_istruttori_select on corso_istruttori;
create policy corso_istruttori_select on corso_istruttori for select to authenticated
  using ( app.is_staff_di(asd_id) or app.e_iscritto_a(corso_id) );

-- Gestiti solo dallo staff della ASD.
drop policy if exists corso_istruttori_write on corso_istruttori;
create policy corso_istruttori_write on corso_istruttori for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );

grant select, insert, update, delete on corso_istruttori to authenticated;
