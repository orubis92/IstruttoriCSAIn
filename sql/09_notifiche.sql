-- ============================================================================
--  09_notifiche.sql — notifiche in-app (messaggi non letti) e preferenze
--
--  Fase 1 (in-app):
--    - ogni membro di una conversazione tiene traccia di quando ha letto
--      l'ultima volta (ultimo_letto_il), così si possono contare i messaggi
--      non letti;
--    - funzione messaggi_non_letti() per il conteggio per conversazione;
--    - preferenze_notifiche: canali (email/push) e anticipo dei promemoria,
--      scelti dal singolo utente. Serviranno anche alle fasi push/email.
--
--  Eseguire dopo 00,01 e 05 (che crea la chat). Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Messaggi non letti
-- ----------------------------------------------------------------------------

alter table conversazione_membri
  add column if not exists ultimo_letto_il timestamptz not null default now();

-- Ogni utente può aggiornare SOLO la propria riga (per segnare "letto").
drop policy if exists conv_membri_update on conversazione_membri;
create policy conv_membri_update on conversazione_membri for update to authenticated
  using      ( utente_id = app.mio_id() )
  with check ( utente_id = app.mio_id() );

grant update (ultimo_letto_il) on conversazione_membri to authenticated;

-- Conteggio dei messaggi non letti per conversazione, per l'utente corrente.
create or replace function public.messaggi_non_letti()
  returns table (conversazione_id uuid, non_letti bigint)
  language sql stable security definer set search_path = public, pg_temp as $$
  select m.conversazione_id, count(*)
  from public.messaggi m
  join public.conversazione_membri cm on cm.conversazione_id = m.conversazione_id
  join public.utenti u on u.id = cm.utente_id
  where u.auth_id = auth.uid() and u.attivo
    and m.creato_il > cm.ultimo_letto_il
    and m.mittente_id is distinct from cm.utente_id
  group by m.conversazione_id;
$$;

grant execute on function public.messaggi_non_letti() to authenticated;


-- ----------------------------------------------------------------------------
--  Preferenze di notifica (per utente)
-- ----------------------------------------------------------------------------

create table if not exists preferenze_notifiche (
  utente_id     uuid primary key references utenti(id) on delete cascade,
  giorno_prima  boolean not null default true,   -- promemoria il giorno prima
  mattina       boolean not null default false,  -- promemoria la mattina stessa
  ore_prima     int,                             -- promemoria N ore prima (null = off)
  via_email     boolean not null default false,  -- (per la fase email)
  via_push      boolean not null default false,  -- (per la fase push)
  aggiornato_il timestamptz not null default now()
);

alter table preferenze_notifiche enable row level security;

drop policy if exists pref_notifiche_all on preferenze_notifiche;
create policy pref_notifiche_all on preferenze_notifiche for all to authenticated
  using      ( utente_id = app.mio_id() )
  with check ( utente_id = app.mio_id() );

grant select, insert, update, delete on preferenze_notifiche to authenticated;
