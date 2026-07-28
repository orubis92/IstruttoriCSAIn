-- ============================================================================
--  11_push_email.sql — coda notifiche, iscrizioni push, generazione promemoria
--
--  Architettura:
--    - push_subscriptions: le iscrizioni push dei dispositivi degli utenti;
--    - notifiche_coda: coda delle notifiche da inviare (push/email);
--    - un trigger sui messaggi accoda una notifica PUSH per gli altri membri
--      (solo se hanno attivato il push);
--    - accoda_promemoria(): genera i promemoria delle lezioni in base alle
--      preferenze degli atleti (giorno prima / mattina / ore prima), evitando
--      duplicati;
--    - una funzione Edge esterna svuota la coda e invia davvero (push + email),
--      richiamata da pg_cron (vedi NOTIFICHE_SETUP.md).
--
--  Eseguire dopo 00,01,05,09. Idempotente.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'canale_notifica') then
    create type canale_notifica as enum ('PUSH', 'EMAIL');
  end if;
  if not exists (select 1 from pg_type where typname = 'stato_notifica') then
    create type stato_notifica as enum ('IN_ATTESA', 'INVIATA', 'ERRORE');
  end if;
end $$;

-- ----------------------------------------------------------------------------
--  Iscrizioni push (un record per dispositivo/browser)
-- ----------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references utenti(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  creato_il  timestamptz not null default now()
);
create index if not exists push_sub_utente_idx on push_subscriptions (utente_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_sub_all on push_subscriptions;
create policy push_sub_all on push_subscriptions for all to authenticated
  using ( utente_id = app.mio_id() ) with check ( utente_id = app.mio_id() );

grant select, insert, delete on push_subscriptions to authenticated;

-- ----------------------------------------------------------------------------
--  Coda delle notifiche
-- ----------------------------------------------------------------------------
create table if not exists notifiche_coda (
  id          uuid primary key default gen_random_uuid(),
  utente_id   uuid not null references utenti(id) on delete cascade,
  tipo        text not null,                 -- 'MESSAGGIO' | 'PROMEMORIA'
  canale      canale_notifica not null,
  titolo      text not null,
  corpo       text,
  url         text,
  chiave_dedup text,                         -- per non generare doppioni
  stato       stato_notifica not null default 'IN_ATTESA',
  tentativi   int not null default 0,
  errore      text,
  creato_il   timestamptz not null default now(),
  inviata_il  timestamptz
);
create unique index if not exists notifiche_dedup
  on notifiche_coda (utente_id, chiave_dedup) where chiave_dedup is not null;
create index if not exists notifiche_stato_idx on notifiche_coda (stato, creato_il);

alter table notifiche_coda enable row level security;

-- L'utente può vedere le proprie (per un eventuale centro notifiche in-app).
-- L'invio è gestito dalla funzione Edge con la service key (che scavalca RLS).
drop policy if exists notifiche_select on notifiche_coda;
create policy notifiche_select on notifiche_coda for select to authenticated
  using ( utente_id = app.mio_id() );

grant select on notifiche_coda to authenticated;

-- ----------------------------------------------------------------------------
--  Accoda una notifica push a ogni nuovo messaggio (per chi ha attivato il push)
-- ----------------------------------------------------------------------------
create or replace function app.accoda_notifica_messaggio() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_mittente text;
begin
  select nome || ' ' || cognome into v_mittente from public.utenti where id = new.mittente_id;

  insert into public.notifiche_coda (utente_id, tipo, canale, titolo, corpo, url)
  select cm.utente_id, 'MESSAGGIO', 'PUSH',
         coalesce(v_mittente, 'Nuovo messaggio'),
         left(new.testo, 140),
         '/chat'
  from public.conversazione_membri cm
  join public.utenti u on u.id = cm.utente_id
  left join public.preferenze_notifiche p on p.utente_id = cm.utente_id
  where cm.conversazione_id = new.conversazione_id
    and cm.utente_id <> new.mittente_id
    and u.attivo
    and coalesce(p.via_push, false);

  return new;
end $$;

drop trigger if exists t_messaggi_notifica on messaggi;
create trigger t_messaggi_notifica after insert on messaggi
  for each row execute function app.accoda_notifica_messaggio();

-- ----------------------------------------------------------------------------
--  Genera i promemoria delle lezioni in base alle preferenze degli atleti.
--  Da richiamare periodicamente da pg_cron. Idempotente grazie a chiave_dedup.
-- ----------------------------------------------------------------------------
create or replace function public.accoda_promemoria() returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prima int;
begin
  select count(*) into v_prima from notifiche_coda where stato = 'IN_ATTESA';

  -- Blocco generico: per ciascun anticipo attivo genera righe push/email.
  -- (a) il giorno prima
  insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup)
  select i.atleta_id, 'PROMEMORIA', ch.canale,
         'Promemoria lezione',
         'Domani: ' || g.titolo || ' — ' || co.titolo,
         '/corsi/' || g.corso_id,
         'prom:' || g.id || ':gp:' || ch.canale
  from giornate g
  join corsi co on co.id = g.corso_id
  join iscrizioni i on i.corso_id = g.corso_id and i.stato = 'ATTIVA'
  join utenti u on u.id = i.atleta_id and u.attivo
  join preferenze_notifiche p on p.utente_id = i.atleta_id
  cross join lateral (values
      ('PUSH'::canale_notifica, coalesce(p.via_push, false)),
      ('EMAIL'::canale_notifica, coalesce(p.via_email, false))
  ) as ch(canale, attivo)
  where g.data = current_date + 1 and p.giorno_prima and ch.attivo
    and (ch.canale <> 'EMAIL' or u.email is not null)
  on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;

  -- (b) la mattina stessa
  insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup)
  select i.atleta_id, 'PROMEMORIA', ch.canale,
         'Promemoria lezione',
         'Oggi: ' || g.titolo || ' — ' || co.titolo,
         '/corsi/' || g.corso_id,
         'prom:' || g.id || ':mat:' || ch.canale
  from giornate g
  join corsi co on co.id = g.corso_id
  join iscrizioni i on i.corso_id = g.corso_id and i.stato = 'ATTIVA'
  join utenti u on u.id = i.atleta_id and u.attivo
  join preferenze_notifiche p on p.utente_id = i.atleta_id
  cross join lateral (values
      ('PUSH'::canale_notifica, coalesce(p.via_push, false)),
      ('EMAIL'::canale_notifica, coalesce(p.via_email, false))
  ) as ch(canale, attivo)
  where g.data = current_date and p.mattina and ch.attivo
    and (ch.canale <> 'EMAIL' or u.email is not null)
  on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;

  -- (c) alcune ore prima (richiede ora_inizio; con cron orario scatta una volta)
  insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup)
  select i.atleta_id, 'PROMEMORIA', ch.canale,
         'Promemoria lezione',
         'Tra poco: ' || g.titolo || ' — ' || co.titolo,
         '/corsi/' || g.corso_id,
         'prom:' || g.id || ':op:' || ch.canale
  from giornate g
  join corsi co on co.id = g.corso_id
  join iscrizioni i on i.corso_id = g.corso_id and i.stato = 'ATTIVA'
  join utenti u on u.id = i.atleta_id and u.attivo
  join preferenze_notifiche p on p.utente_id = i.atleta_id
  cross join lateral (values
      ('PUSH'::canale_notifica, coalesce(p.via_push, false)),
      ('EMAIL'::canale_notifica, coalesce(p.via_email, false))
  ) as ch(canale, attivo)
  where g.data = current_date and g.ora_inizio is not null
    and p.ore_prima is not null and ch.attivo
    and (g.data + g.ora_inizio) > now()
    and (g.data + g.ora_inizio) - now() <= make_interval(hours => p.ore_prima)
    and (ch.canale <> 'EMAIL' or u.email is not null)
  on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;

  return (select count(*) from notifiche_coda where stato = 'IN_ATTESA') - v_prima;
end $$;

grant execute on function public.accoda_promemoria() to authenticated;
