-- ============================================================================
--  20_avvisi_notifiche.sql — avvisi, centro notifiche, preferenze ASD,
--                            notifica di prova e stato dell'invio
--
--  Contiene:
--    1. notifiche: la "casella" in-app di ogni utente (centro notifiche), con
--       stato letto/non letto. Ci finiscono avvisi, promemoria, avvisi sui
--       certificati e notifiche di prova (NON i messaggi di chat, che hanno
--       già il loro conteggio dei non letti).
--    2. avvisi: comunicazioni inviate dallo staff agli atleti di un corso, o
--       dai programmatori a tutte le ASD (staff o tutti). Possono essere
--       URGENTI: in quel caso arrivano in push anche a chi ha spento le push,
--       purché abbia un dispositivo iscritto. L'email resta solo opt-in.
--    3. preferenze_notifiche_asd: promemoria predefiniti decisi
--       dall'amministratore per gli atleti della ASD; l'atleta può usarli o
--       personalizzarli (preferenze_notifiche.usa_predefiniti).
--    4. app.notifica(): UNICO punto d'invio. Scrive nella casella in-app e
--       accoda push/email secondo le preferenze effettive, senza doppioni.
--    5. Promemoria e avvisi certificati riscritti su app.notifica, con orari
--       nel fuso Europe/Rome (niente push alle 2 di notte) e senza promemoria
--       per le giornate annullate.
--    6. invia_notifica_prova(), stato_invio_notifiche(), registra_push().
--
--  Eseguire dopo 00..19. Idempotente.
--  ATTENZIONE: non rieseguire 11_push_email.sql o 12_certificati_avvisi.sql
--  dopo questa migrazione: riscriverebbero accoda_promemoria() e
--  accoda_avvisi_certificati() con la logica precedente.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. AVVISI (prima delle notifiche, che vi fanno riferimento)
-- ----------------------------------------------------------------------------
create table if not exists avvisi (
  id             uuid primary key default gen_random_uuid(),
  asd_id         uuid references asd(id) on delete cascade,      -- NULL = piattaforma
  corso_id       uuid references corsi(id) on delete cascade,
  ambito         text not null
                 check (ambito in ('CORSO', 'PIATTAFORMA_STAFF', 'PIATTAFORMA_TUTTI')),
  mittente_id    uuid references utenti(id) on delete set null,
  mittente_nome  text,
  titolo         text not null,
  testo          text not null,
  urgente        boolean not null default false,
  n_destinatari  int not null default 0,
  creato_il      timestamptz not null default now(),
  constraint avvisi_ambito_coerente check (
       (ambito = 'CORSO' and asd_id is not null and corso_id is not null)
    or (ambito <> 'CORSO' and asd_id is null and corso_id is null)
  )
);
create index if not exists avvisi_corso_idx on avvisi (corso_id, creato_il desc);
create index if not exists avvisi_asd_idx on avvisi (asd_id, creato_il desc);

alter table avvisi enable row level security;

-- Storico visibile allo staff della ASD (avvisi dei corsi) e ai programmatori.
-- I destinatari leggono il contenuto dalla propria casella (notifiche).
drop policy if exists avvisi_select on avvisi;
create policy avvisi_select on avvisi for select to authenticated
  using ( app.is_programmatore() or (asd_id is not null and app.is_staff_di(asd_id)) );

-- Nessun insert/update/delete dal client: si invia solo tramite RPC.
grant select on avvisi to authenticated;

-- ----------------------------------------------------------------------------
--  2. CENTRO NOTIFICHE (casella in-app per utente)
-- ----------------------------------------------------------------------------
create table if not exists notifiche (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references utenti(id) on delete cascade,
  tipo       text not null,             -- AVVISO | PROMEMORIA | CERTIFICATO | TEST
  titolo     text not null,
  corpo      text,
  url        text,
  urgente    boolean not null default false,
  avviso_id  uuid references avvisi(id) on delete set null,
  chiave     text,                      -- per non creare doppioni
  letta_il   timestamptz,
  creato_il  timestamptz not null default now()
);
create unique index if not exists notifiche_chiave_unica
  on notifiche (utente_id, chiave) where chiave is not null;
create index if not exists notifiche_utente_idx on notifiche (utente_id, creato_il desc);

alter table notifiche enable row level security;

drop policy if exists notifiche_proprie_select on notifiche;
create policy notifiche_proprie_select on notifiche for select to authenticated
  using ( utente_id = app.mio_id() );

drop policy if exists notifiche_proprie_update on notifiche;
create policy notifiche_proprie_update on notifiche for update to authenticated
  using ( utente_id = app.mio_id() ) with check ( utente_id = app.mio_id() );

drop policy if exists notifiche_proprie_delete on notifiche;
create policy notifiche_proprie_delete on notifiche for delete to authenticated
  using ( utente_id = app.mio_id() );

-- Il client può solo leggere, segnare come letta e cancellare le proprie.
grant select, delete on notifiche to authenticated;
grant update (letta_il) on notifiche to authenticated;

-- La coda push/email porta il flag urgente (la funzione Edge lo inoltra al
-- dispositivo, che tiene la notifica a schermo finché non viene aperta).
alter table notifiche_coda add column if not exists urgente boolean not null default false;

-- ----------------------------------------------------------------------------
--  3. PREFERENZE PREDEFINITE DELLA ASD
-- ----------------------------------------------------------------------------
create table if not exists preferenze_notifiche_asd (
  asd_id        uuid primary key references asd(id) on delete cascade,
  giorno_prima  boolean not null default true,
  mattina       boolean not null default false,
  ore_prima     int check (ore_prima is null or ore_prima between 1 and 48),
  aggiornato_il timestamptz not null default now()
);

alter table preferenze_notifiche_asd enable row level security;

drop policy if exists pref_asd_select on preferenze_notifiche_asd;
create policy pref_asd_select on preferenze_notifiche_asd for select to authenticated
  using ( app.is_programmatore() or app.is_membro_di(asd_id) );

drop policy if exists pref_asd_insert on preferenze_notifiche_asd;
create policy pref_asd_insert on preferenze_notifiche_asd for insert to authenticated
  with check ( app.is_admin_di(asd_id) );

drop policy if exists pref_asd_update on preferenze_notifiche_asd;
create policy pref_asd_update on preferenze_notifiche_asd for update to authenticated
  using ( app.is_admin_di(asd_id) ) with check ( app.is_admin_di(asd_id) );

grant select, insert, update on preferenze_notifiche_asd to authenticated;

-- L'utente sceglie se usare gli orari della ASD o i propri. Chi aveva già
-- salvato preferenze personali le mantiene (false); i nuovi ereditano (true).
alter table preferenze_notifiche add column if not exists usa_predefiniti boolean not null default false;
alter table preferenze_notifiche alter column usa_predefiniti set default true;

-- Preferenze EFFETTIVE per utente: orari dall'utente (se personalizzati),
-- altrimenti dalla ASD, altrimenti default; canali sempre dall'utente.
-- Vista interna nello schema app (non esposta all'API, nessun grant).
create or replace view app.preferenze_eff as
  select
    u.id as utente_id,
    case when p.utente_id is not null and not p.usa_predefiniti
         then p.giorno_prima else coalesce(a.giorno_prima, true) end  as giorno_prima,
    case when p.utente_id is not null and not p.usa_predefiniti
         then p.mattina      else coalesce(a.mattina, false) end      as mattina,
    case when p.utente_id is not null and not p.usa_predefiniti
         then p.ore_prima    else a.ore_prima end                     as ore_prima,
    coalesce(p.via_push, false)  as via_push,
    coalesce(p.via_email, false) as via_email
  from public.utenti u
  left join public.preferenze_notifiche p     on p.utente_id = u.id
  left join public.preferenze_notifiche_asd a on a.asd_id = u.asd_id;

revoke all on app.preferenze_eff from public;

-- ----------------------------------------------------------------------------
--  4. PUNTO UNICO D'INVIO
-- ----------------------------------------------------------------------------
-- Ritorna true se la notifica è nuova (false se esisteva già con la stessa
-- chiave: in quel caso non accoda nulla, così non si inviano doppioni).
create or replace function app.notifica(
  p_utente  uuid,
  p_tipo    text,
  p_titolo  text,
  p_corpo   text,
  p_url     text,
  p_chiave  text,
  p_urgente boolean default false,
  p_avviso  uuid default null
) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_nuove int;
  v_push  boolean;
  v_email boolean;
  v_mail  text;
begin
  insert into notifiche (utente_id, tipo, titolo, corpo, url, urgente, avviso_id, chiave)
  values (p_utente, p_tipo, p_titolo, p_corpo, p_url, p_urgente, p_avviso, p_chiave)
  on conflict (utente_id, chiave) where chiave is not null do nothing;
  get diagnostics v_nuove = row_count;
  if v_nuove = 0 then
    return false;
  end if;

  select pe.via_push, pe.via_email into v_push, v_email
    from app.preferenze_eff pe where pe.utente_id = p_utente;
  select u.email into v_mail from utenti u where u.id = p_utente;

  -- Push: se l'utente le vuole OPPURE se l'avviso è urgente, e solo se ha
  -- almeno un dispositivo iscritto.
  if (p_urgente or coalesce(v_push, false))
     and exists (select 1 from push_subscriptions s where s.utente_id = p_utente) then
    insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup, urgente)
    values (p_utente, p_tipo, 'PUSH', p_titolo, p_corpo, p_url,
            case when p_chiave is null then null else p_chiave || ':PUSH' end, p_urgente)
    on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;
  end if;

  -- Email: SOLO se scelta dall'utente (anche per gli urgenti).
  if coalesce(v_email, false) and v_mail is not null then
    insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup, urgente)
    values (p_utente, p_tipo, 'EMAIL', p_titolo, p_corpo, p_url,
            case when p_chiave is null then null else p_chiave || ':EMAIL' end, p_urgente)
    on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;
  end if;

  return true;
end $$;

-- Mai richiamabile dal client: chiunque potrebbe mandare notifiche a chiunque.
revoke all on function app.notifica(uuid, text, text, text, text, text, boolean, uuid) from public;

-- ----------------------------------------------------------------------------
--  5. PROMEMORIA E AVVISI CERTIFICATI (riscritti su app.notifica)
-- ----------------------------------------------------------------------------
-- p_adesso è parametrico per poter essere testato a orari precisi.
create or replace function app.genera_promemoria(p_adesso timestamptz) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_locale timestamp := p_adesso at time zone 'Europe/Rome';
  v_oggi   date      := (p_adesso at time zone 'Europe/Rome')::date;
  v_ora    int       := extract(hour from v_locale)::int;
  v_n      int       := 0;
  v_inizio timestamptz;
  r        record;
begin
  for r in
    select i.atleta_id, g.id as gid, g.corso_id, g.titolo as gtit, co.titolo as ctit,
           g.data, g.ora_inizio, pe.giorno_prima, pe.mattina, pe.ore_prima
    from giornate g
    join corsi co       on co.id = g.corso_id and co.stato not in ('ANNULLATO', 'CONCLUSO')
    join iscrizioni i   on i.corso_id = g.corso_id and i.stato = 'ATTIVA'
    join utenti u       on u.id = i.atleta_id and u.attivo
    join app.preferenze_eff pe on pe.utente_id = u.id
    where g.stato = 'PIANIFICATA'
      and g.data in (v_oggi, v_oggi + 1)
  loop
    -- il giorno prima, dalle 18:00
    if r.data = v_oggi + 1 and r.giorno_prima and v_ora >= 18 then
      if app.notifica(r.atleta_id, 'PROMEMORIA', 'Promemoria lezione',
                      'Domani: ' || r.gtit || ' — ' || r.ctit,
                      '/corsi/' || r.corso_id, 'prom:' || r.gid || ':gp') then
        v_n := v_n + 1;
      end if;
    end if;

    if r.data = v_oggi then
      v_inizio := case when r.ora_inizio is null then null
                       else (r.data + r.ora_inizio) at time zone 'Europe/Rome' end;

      -- la mattina stessa, dalle 7:00 (e non a lezione già iniziata)
      if r.mattina and v_ora >= 7 and (v_inizio is null or v_inizio > p_adesso) then
        if app.notifica(r.atleta_id, 'PROMEMORIA', 'Promemoria lezione',
                        'Oggi: ' || r.gtit || ' — ' || r.ctit,
                        '/corsi/' || r.corso_id, 'prom:' || r.gid || ':mat') then
          v_n := v_n + 1;
        end if;
      end if;

      -- alcune ore prima dell'inizio
      if r.ore_prima is not null and v_inizio is not null
         and v_inizio > p_adesso
         and v_inizio - p_adesso <= make_interval(hours => r.ore_prima) then
        if app.notifica(r.atleta_id, 'PROMEMORIA', 'Promemoria lezione',
                        'Tra poco: ' || r.gtit || ' — ' || r.ctit,
                        '/corsi/' || r.corso_id, 'prom:' || r.gid || ':op') then
          v_n := v_n + 1;
        end if;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function app.genera_promemoria(timestamptz) from public;

-- Interfaccia invariata per la funzione Edge (rpc('accoda_promemoria')).
create or replace function public.accoda_promemoria() returns int
  language sql security definer set search_path = public, pg_temp as $$
  select app.genera_promemoria(now());
$$;
grant execute on function public.accoda_promemoria() to authenticated;

create or replace function app.genera_avvisi_certificati(p_adesso timestamptz) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_oggi date := (p_adesso at time zone 'Europe/Rome')::date;
  v_ora  int  := extract(hour from (p_adesso at time zone 'Europe/Rome'))::int;
  v_n    int  := 0;
  r      record;
begin
  -- solo in orario diurno
  if v_ora < 9 or v_ora >= 21 then
    return 0;
  end if;

  for r in
    select distinct on (cm.atleta_id) cm.atleta_id, cm.data_scadenza
    from certificati_medici cm
    join utenti u on u.id = cm.atleta_id and u.attivo and u.ruolo = 'ATLETA'
    where cm.data_scadenza is not null
    order by cm.atleta_id, cm.data_scadenza desc
  loop
    if r.data_scadenza <= v_oggi + 30 then
      if app.notifica(
           r.atleta_id, 'CERTIFICATO',
           case when r.data_scadenza < v_oggi then 'Certificato medico scaduto'
                else 'Certificato medico in scadenza' end,
           case when r.data_scadenza < v_oggi
                then 'Il tuo certificato medico è scaduto il ' || to_char(r.data_scadenza, 'DD/MM/YYYY') || '. Contatta la tua ASD per rinnovarlo.'
                else 'Il tuo certificato medico scade il ' || to_char(r.data_scadenza, 'DD/MM/YYYY') || '. Ricordati di rinnovarlo.' end,
           '/profilo',
           'cert:' || r.atleta_id || ':' || r.data_scadenza || ':'
             || case when r.data_scadenza < v_oggi then 'sca' else 'scad' end) then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function app.genera_avvisi_certificati(timestamptz) from public;

create or replace function public.accoda_avvisi_certificati() returns int
  language sql security definer set search_path = public, pg_temp as $$
  select app.genera_avvisi_certificati(now());
$$;
grant execute on function public.accoda_avvisi_certificati() to authenticated;

-- ----------------------------------------------------------------------------
--  6. INVIO AVVISI
-- ----------------------------------------------------------------------------
-- Staff → atleti di un corso (iscrizioni attive o richieste). Ritorna il numero
-- di destinatari raggiunti.
create or replace function public.invia_avviso_corso(
  p_corso   uuid,
  p_titolo  text,
  p_testo   text,
  p_urgente boolean default false
) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io    uuid := app.mio_id();
  v_asd   uuid;
  v_ctit  text;
  v_av    uuid;
  v_n     int := 0;
  r       record;
begin
  select asd_id, titolo into v_asd, v_ctit from corsi where id = p_corso;
  if v_asd is null or not app.is_staff_di(v_asd) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  if coalesce(trim(p_titolo), '') = '' or coalesce(trim(p_testo), '') = '' then
    raise exception 'Titolo e testo sono obbligatori' using errcode = '22023';
  end if;

  insert into avvisi (asd_id, corso_id, ambito, mittente_id, mittente_nome, titolo, testo, urgente)
  select v_asd, p_corso, 'CORSO', v_io, u.nome || ' ' || u.cognome, trim(p_titolo), trim(p_testo), p_urgente
    from utenti u where u.id = v_io
  returning id into v_av;

  for r in
    select distinct i.atleta_id
    from iscrizioni i
    join utenti u on u.id = i.atleta_id and u.attivo
    where i.corso_id = p_corso and i.stato in ('ATTIVA', 'RICHIESTA')
  loop
    if app.notifica(r.atleta_id, 'AVVISO', v_ctit || ': ' || trim(p_titolo), trim(p_testo),
                    '/corsi/' || p_corso, 'avviso:' || v_av, p_urgente, v_av) then
      v_n := v_n + 1;
    end if;
  end loop;

  update avvisi set n_destinatari = v_n where id = v_av;
  return v_n;
end $$;
grant execute on function public.invia_avviso_corso(uuid, text, text, boolean) to authenticated;

-- Programmatore → tutte le ASD: solo staff ('STAFF') o tutti i membri ('TUTTI').
create or replace function public.invia_avviso_piattaforma(
  p_titolo      text,
  p_testo       text,
  p_destinatari text,
  p_urgente     boolean default false
) returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io  uuid := app.mio_id();
  v_av  uuid;
  v_n   int := 0;
  r     record;
begin
  if not app.is_programmatore() then
    raise exception 'Riservato ai programmatori' using errcode = '42501';
  end if;
  if p_destinatari not in ('STAFF', 'TUTTI') then
    raise exception 'Destinatari non validi' using errcode = '22023';
  end if;
  if coalesce(trim(p_titolo), '') = '' or coalesce(trim(p_testo), '') = '' then
    raise exception 'Titolo e testo sono obbligatori' using errcode = '22023';
  end if;

  insert into avvisi (asd_id, corso_id, ambito, mittente_id, mittente_nome, titolo, testo, urgente)
  select null, null, 'PIATTAFORMA_' || p_destinatari, v_io, u.nome || ' ' || u.cognome,
         trim(p_titolo), trim(p_testo), p_urgente
    from utenti u where u.id = v_io
  returning id into v_av;

  for r in
    select u.id
    from utenti u
    join asd a on a.id = u.asd_id and a.attiva
    where u.attivo and u.ruolo <> 'PROGRAMMATORE'
      and (p_destinatari = 'TUTTI' or u.ruolo in ('AMMINISTRATORE_ASD', 'ISTRUTTORE'))
  loop
    if app.notifica(r.id, 'AVVISO', trim(p_titolo), trim(p_testo), '/notifiche',
                    'avviso:' || v_av, p_urgente, v_av) then
      v_n := v_n + 1;
    end if;
  end loop;

  update avvisi set n_destinatari = v_n where id = v_av;
  return v_n;
end $$;
grant execute on function public.invia_avviso_piattaforma(text, text, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
--  7. DISPOSITIVI PUSH, NOTIFICA DI PROVA, STATO DELL'INVIO
-- ----------------------------------------------------------------------------
-- Registra il dispositivo corrente per l'utente collegato. Un endpoint
-- appartiene al browser: se prima era di un altro utente (dispositivo
-- condiviso), passa a chi si è collegato ora. Attivare il push su un
-- dispositivo equivale anche a sceglierlo come canale.
create or replace function public.registra_push(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io uuid := app.mio_id();
begin
  if v_io is null then
    raise exception 'Non autenticato' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Iscrizione push non valida' using errcode = '22023';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (utente_id, endpoint, p256dh, auth)
  values (v_io, p_endpoint, p_p256dh, p_auth);

  insert into preferenze_notifiche (utente_id, via_push)
  values (v_io, true)
  on conflict (utente_id) do update set via_push = true, aggiornato_il = now();
end $$;
grant execute on function public.registra_push(text, text, text) to authenticated;

-- Notifica di prova all'utente corrente: sempre nella casella in-app, e in
-- push sui suoi dispositivi iscritti (anche se ha spento le push: è un test).
-- Al massimo una al minuto.
create or replace function public.invia_notifica_prova() returns json
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io   uuid := app.mio_id();
  v_disp int;
  v_coda uuid;
begin
  if v_io is null then
    raise exception 'Non autenticato' using errcode = '42501';
  end if;
  if exists (select 1 from notifiche
              where utente_id = v_io and tipo = 'TEST'
                and creato_il > now() - interval '1 minute') then
    raise exception 'Hai appena inviato una notifica di prova: attendi un minuto' using errcode = '22023';
  end if;

  select count(*) into v_disp from push_subscriptions where utente_id = v_io;

  insert into notifiche (utente_id, tipo, titolo, corpo, url)
  values (v_io, 'TEST', 'Notifica di prova',
          'Se la vedi sul dispositivo, le notifiche push funzionano.', '/notifiche');

  if v_disp > 0 then
    insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, urgente)
    values (v_io, 'TEST', 'PUSH', 'Notifica di prova',
            'Se la vedi sul dispositivo, le notifiche push funzionano.', '/notifiche', true)
    returning id into v_coda;
  end if;

  return json_build_object('dispositivi', v_disp, 'coda_id', v_coda);
end $$;
grant execute on function public.invia_notifica_prova() to authenticated;

-- Stato complessivo dell'invio (solo programmatori): serve a capire dall'app
-- se il cron e la funzione Edge stanno lavorando.
create or replace function public.stato_invio_notifiche() returns json
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_base   json;
  v_errori json;
  v_cron   boolean;
begin
  if not app.is_programmatore() then
    raise exception 'Riservato ai programmatori' using errcode = '42501';
  end if;

  select json_build_object(
           'in_attesa',            count(*) filter (where stato = 'IN_ATTESA'),
           'piu_vecchia_in_attesa', min(creato_il) filter (where stato = 'IN_ATTESA'),
           'inviate_24h',          count(*) filter (where stato = 'INVIATA' and inviata_il > now() - interval '24 hours'),
           'errori_24h',           count(*) filter (where stato = 'ERRORE' and creato_il > now() - interval '24 hours'),
           'ultimo_invio',         max(inviata_il),
           'dispositivi',          (select count(*) from push_subscriptions)
         )
    into v_base
    from notifiche_coda;

  select coalesce(json_agg(e), '[]'::json) into v_errori
  from (
    select creato_il, canale, tipo, errore, stato
    from notifiche_coda
    where errore is not null and errore <> 'nessun dispositivo'
    order by creato_il desc
    limit 5
  ) e;

  -- pg_cron potrebbe non essere installato: in quel caso NULL (sconosciuto).
  begin
    execute 'select exists (select 1 from cron.job where jobname = ''invia-notifiche'')' into v_cron;
  exception when others then
    v_cron := null;
  end;

  return json_build_object('coda', v_base, 'ultimi_errori', v_errori, 'cron_programmato', v_cron);
end $$;
grant execute on function public.stato_invio_notifiche() to authenticated;
