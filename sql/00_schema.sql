-- ============================================================================
--  Piattaforma gestione corsi — ASD di tiro con l'arco (CSAIN)
--  00_schema.sql — tipi, tabelle, vincoli, funzioni di supporto, trigger, RPC
--  Target: PostgreSQL 15+ / Supabase
--
--  Modello multi-tenant: database UNICO condiviso.
--  Ogni tabella "di dominio" porta asd_id = il tenant proprietario.
--  L'isolamento tra ASD è garantito dalle policy RLS (file 01_rls.sql).
--
--  Ruoli: PROGRAMMATORE (piattaforma, senza ASD)
--         AMMINISTRATORE_ASD (più di uno per ASD è consentito)
--         ISTRUTTORE
--         ATLETA
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;          -- funzioni di supporto, non esposte all'API
comment on schema app is 'Funzioni interne di supporto a RLS e trigger.';


-- ============================================================================
--  1. TIPI ENUMERATI
-- ============================================================================

create type ruolo_utente as enum (
  'PROGRAMMATORE',        -- piattaforma: documentazione generale + amministrazione
  'AMMINISTRATORE_ASD',   -- amministratore interno della singola ASD
  'ISTRUTTORE',           -- gestisce corsi e documenti, crea atleti
  'ATLETA'
);

create type doc_scope      as enum ('GENERALE', 'ASD');
create type doc_visibilita as enum ('PUBBLICO', 'PRIVATO');

create type tipo_documento as enum (
  'GENERICO', 'CERTIFICATO_MEDICO', 'PRIVACY', 'ISCRIZIONE',
  'TESSERAMENTO', 'MATERIALE_CORSO', 'REGOLAMENTO'
);

create type stato_corso      as enum ('BOZZA','APERTO','IN_CORSO','CONCLUSO','ANNULLATO');
create type stato_giornata   as enum ('PIANIFICATA','SVOLTA','ANNULLATA');
create type stato_iscrizione as enum ('RICHIESTA','ATTIVA','SOSPESA','CONCLUSA','RITIRATA');
create type stato_presenza   as enum ('PRESENTE','ASSENTE','GIUSTIFICATO');
create type stato_modulo     as enum ('BOZZA','INVIATO','FIRMATO','RIFIUTATO');


-- ============================================================================
--  2. TENANT E UTENTI
-- ============================================================================

create table asd (
  id                        uuid primary key default gen_random_uuid(),
  nome                      text not null,
  codice_affiliazione_csain text,
  codice_fiscale            text,
  email                     text,
  telefono                  text,
  indirizzo                 text,
  attiva                    boolean not null default true,
  creata_il                 timestamptz not null default now(),
  aggiornata_il             timestamptz not null default now()
);
comment on table asd is 'Un record per ogni ASD iscritta alla piattaforma (tenant).';

create table utenti (
  id               uuid primary key default gen_random_uuid(),
  -- Collegamento all'account di autenticazione. NULL = anagrafica creata
  -- dall'istruttore ma non ancora rivendicata dall'atleta (vedi tabella inviti).
  auth_id          uuid unique references auth.users(id) on delete set null,
  ruolo            ruolo_utente not null,
  asd_id           uuid references asd(id) on delete cascade,

  nome             text not null,
  cognome          text not null,
  data_nascita     date,
  codice_fiscale   text,
  n_tessera_csain  text,
  email            text,
  telefono         text,

  attivo           boolean not null default true,
  creato_da        uuid references utenti(id) on delete set null,   -- tracciabilità GDPR
  creato_il        timestamptz not null default now(),
  aggiornato_il    timestamptz not null default now(),

  -- I PROGRAMMATORI non appartengono ad alcuna ASD; tutti gli altri sì.
  constraint utenti_asd_coerente check (
       (ruolo =  'PROGRAMMATORE' and asd_id is null)
    or (ruolo <> 'PROGRAMMATORE' and asd_id is not null)
  ),
  -- Necessario per le chiavi esterne composite che garantiscono la coerenza di tenant.
  constraint utenti_id_asd_unico unique (id, asd_id)
);
comment on column utenti.auth_id is 'NULL finché l''utente non attiva l''account tramite invito.';

create unique index utenti_cf_per_asd
  on utenti (asd_id, lower(codice_fiscale)) where codice_fiscale is not null;
create index utenti_asd_idx   on utenti (asd_id);
create index utenti_ruolo_idx on utenti (asd_id, ruolo) where attivo;

-- Inviti: l'amministratore/istruttore crea l'anagrafica, poi consegna il codice
-- all'interessato che, registrandosi, lo usa per collegare il proprio account.
create table inviti (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references utenti(id) on delete cascade,
  codice     text not null unique default encode(gen_random_bytes(12), 'hex'),
  scade_il   timestamptz not null default now() + interval '30 days',
  usato_il   timestamptz,
  creato_da  uuid references utenti(id) on delete set null,
  creato_il  timestamptz not null default now()
);


-- ============================================================================
--  3. DOCUMENTAZIONE
-- ============================================================================

create table documenti (
  id                 uuid primary key default gen_random_uuid(),
  titolo             text not null,
  descrizione        text,
  tipo               tipo_documento not null default 'GENERICO',

  -- GENERALE = documentazione di piattaforma, visibile a TUTTE le ASD.
  -- ASD      = documentazione della singola ASD, PUBBLICO o PRIVATO.
  scope              doc_scope not null,
  asd_id             uuid references asd(id) on delete cascade,
  visibilita         doc_visibilita,

  file_path          text not null,          -- percorso nel bucket Storage
  mime_type          text,
  dimensione_byte    bigint,
  data_scadenza      date,                   -- utile per i certificati medici

  -- Atleta a cui il documento si riferisce (es. il suo certificato medico).
  atleta_riferimento uuid,

  caricato_da        uuid references utenti(id) on delete set null,
  creato_il          timestamptz not null default now(),
  aggiornato_il      timestamptz not null default now(),

  constraint doc_scope_coerente check (
       (scope = 'GENERALE' and asd_id is null     and visibilita is null)
    or (scope = 'ASD'      and asd_id is not null and visibilita is not null)
  ),
  -- Il percorso del file DEVE stare nella cartella del proprio tenant: impedisce
  -- di "rivendicare" il file di un'altra ASD registrandone il path.
  constraint doc_path_coerente check (
       (scope = 'GENERALE' and file_path like 'generale/%')
    or (scope = 'ASD'      and file_path like 'asd/' || asd_id::text || '/%')
  ),
  constraint doc_id_asd_unico unique (id, asd_id),
  -- L'atleta di riferimento deve appartenere alla stessa ASD del documento.
  constraint doc_atleta_stessa_asd
    foreign key (atleta_riferimento, asd_id) references utenti (id, asd_id) on delete cascade
);
comment on table documenti is
  'Tre livelli: GENERALE (solo PROGRAMMATORE, per tutte le ASD), ASD/PUBBLICO (tutta l''ASD), ASD/PRIVATO (elenco atleti indicato + staff).';

-- Unicità del percorso all'interno del tenant. Volutamente NON globale: un
-- indice unico globale sarebbe un oracolo (permetterebbe di dedurre l'esistenza
-- di un file di un'altra ASD dall'errore di chiave duplicata).
create unique index documenti_file_path_unico on documenti (asd_id, file_path) nulls not distinct;
create index documenti_asd_idx   on documenti (asd_id, scope, visibilita);
create index documenti_atleta_idx on documenti (atleta_riferimento);
create index documenti_scadenza_idx on documenti (data_scadenza) where data_scadenza is not null;

-- Elenco degli atleti abilitati a vedere un documento PRIVATO.
create table documento_atleti (
  documento_id uuid not null,
  atleta_id    uuid not null,
  asd_id       uuid not null references asd(id) on delete cascade,
  primary key (documento_id, atleta_id),
  foreign key (documento_id, asd_id) references documenti (id, asd_id) on delete cascade,
  foreign key (atleta_id,    asd_id) references utenti   (id, asd_id) on delete cascade
);
create index documento_atleti_atleta_idx on documento_atleti (atleta_id);


-- ============================================================================
--  4. MODELLI DI CORSO  (alimentano la modalità "guidata")
-- ============================================================================

-- asd_id NULL = linea guida di piattaforma, disponibile a tutte le ASD.
create table modelli_corso (
  id            uuid primary key default gen_random_uuid(),
  asd_id        uuid references asd(id) on delete cascade,
  titolo        text not null,
  descrizione   text,
  livello       text,
  creato_da     uuid references utenti(id) on delete set null,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create table modelli_giornata (
  id               uuid primary key default gen_random_uuid(),
  modello_corso_id uuid not null references modelli_corso(id) on delete cascade,
  ordine           int  not null,
  titolo           text not null,
  obiettivi        text,
  argomenti        text[] not null default '{}',
  durata_minuti    int,
  unique (modello_corso_id, ordine)
);


-- ============================================================================
--  5. CORSI, GIORNATE, ISCRIZIONI, PRESENZE
-- ============================================================================

create table corsi (
  id             uuid primary key default gen_random_uuid(),
  asd_id         uuid not null references asd(id) on delete cascade,
  titolo         text not null,
  descrizione    text,
  stato          stato_corso not null default 'BOZZA',
  data_inizio    date,
  data_fine      date,
  posti_massimi  int,
  responsabile   uuid,
  creato_da      uuid references utenti(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  constraint corsi_id_asd_unico unique (id, asd_id),
  constraint corsi_responsabile_stessa_asd
    foreign key (responsabile, asd_id) references utenti (id, asd_id) on delete set null
);
create index corsi_asd_idx on corsi (asd_id, stato);

create table giornate (
  id            uuid primary key default gen_random_uuid(),
  corso_id      uuid not null,
  asd_id        uuid not null,                    -- denormalizzato: serve a RLS
  ordine        int  not null,
  titolo        text not null,
  obiettivi     text,
  argomenti     text[] not null default '{}',
  data          date,
  ora_inizio    time,
  durata_minuti int,
  luogo         text,
  note          text,
  stato         stato_giornata not null default 'PIANIFICATA',
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (corso_id, ordine),
  constraint giornate_id_asd_unico unique (id, asd_id),
  foreign key (corso_id, asd_id) references corsi (id, asd_id) on delete cascade
);
create index giornate_asd_idx on giornate (asd_id, data);

create table iscrizioni (
  id            uuid primary key default gen_random_uuid(),
  corso_id      uuid not null,
  atleta_id     uuid not null,
  asd_id        uuid not null,
  stato         stato_iscrizione not null default 'RICHIESTA',
  iscritto_il   timestamptz not null default now(),
  note          text,
  aggiornato_il timestamptz not null default now(),
  unique (corso_id, atleta_id),
  foreign key (corso_id,  asd_id) references corsi  (id, asd_id) on delete cascade,
  foreign key (atleta_id, asd_id) references utenti (id, asd_id) on delete cascade
);
create index iscrizioni_atleta_idx on iscrizioni (atleta_id);

create table presenze (
  id            uuid primary key default gen_random_uuid(),
  giornata_id   uuid not null,
  atleta_id     uuid not null,
  asd_id        uuid not null,
  stato         stato_presenza not null default 'PRESENTE',
  note          text,
  registrata_da uuid references utenti(id) on delete set null,
  registrata_il timestamptz not null default now(),
  unique (giornata_id, atleta_id),
  foreign key (giornata_id, asd_id) references giornate (id, asd_id) on delete cascade,
  foreign key (atleta_id,   asd_id) references utenti   (id, asd_id) on delete cascade
);
create index presenze_atleta_idx on presenze (atleta_id);


-- ============================================================================
--  6. MODULISTICA
-- ============================================================================

-- asd_id NULL = modulo di piattaforma (iscrizione, privacy, ...) per tutte le ASD.
create table modelli_modulo (
  id            uuid primary key default gen_random_uuid(),
  asd_id        uuid references asd(id) on delete cascade,
  codice        text not null,               -- es. 'ISCRIZIONE_CORSO', 'PRIVACY'
  titolo        text not null,
  descrizione   text,
  versione      int  not null default 1,
  schema_campi  jsonb not null default '[]'::jsonb,   -- definizione dei campi del modulo
  testo_legale  text,                                  -- informativa/clausole da mostrare
  richiede_firma boolean not null default true,
  attivo        boolean not null default true,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint modelli_modulo_univoco unique nulls not distinct (asd_id, codice, versione)
);

create table moduli_compilati (
  id            uuid primary key default gen_random_uuid(),
  modello_id    uuid not null references modelli_modulo(id) on delete restrict,
  asd_id        uuid not null references asd(id) on delete cascade,
  atleta_id     uuid not null,
  corso_id      uuid,
  dati          jsonb not null default '{}'::jsonb,
  stato         stato_modulo not null default 'BOZZA',
  firmato_il    timestamptz,
  firma_path    text,                        -- immagine della firma nel bucket
  pdf_path      text,                        -- PDF generato del modulo compilato
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  foreign key (atleta_id, asd_id) references utenti (id, asd_id) on delete cascade,
  foreign key (corso_id,  asd_id) references corsi  (id, asd_id) on delete set null,
  -- I percorsi dei file sono DERIVATI dalla riga, non scelti dal client: così
  -- nessuno può far puntare un modulo al file riservato di un altro utente.
  constraint mc_pdf_path_derivato check (
    pdf_path is null or pdf_path = 'asd/' || asd_id::text || '/moduli/' || id::text || '.pdf'),
  constraint mc_firma_path_derivato check (
    firma_path is null or firma_path = 'asd/' || asd_id::text || '/moduli/' || id::text || '-firma.png')
);
create index moduli_compilati_atleta_idx on moduli_compilati (atleta_id, stato);


-- ============================================================================
--  7. FUNZIONI DI SUPPORTO PER RLS
--
--  SECURITY DEFINER: eseguono con i privilegi del proprietario e quindi NON
--  ricadono sotto RLS. È ciò che evita la ricorsione infinita quando una
--  policy sulla tabella utenti ha bisogno di leggere la tabella utenti.
--  IMPORTANTE: non attivare MAI "force row level security" su utenti.
-- ============================================================================

-- Cast "sicuro": restituisce NULL invece di sollevare un errore su testo non
-- valido. Serve nelle policy dello Storage: un solo oggetto con nome fuori
-- convenzione (es. i placeholder di cartella creati da Supabase) manderebbe
-- altrimenti in errore ogni operazione sull'intero bucket.
create or replace function app.uuid_o_null(p_testo text) returns uuid
  language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
begin
  return p_testo::uuid;
exception when others then
  return null;
end $$;

create or replace function app.mio_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select u.id from public.utenti u where u.auth_id = auth.uid() and u.attivo limit 1;
$$;

create or replace function app.mia_asd() returns uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select u.asd_id from public.utenti u where u.auth_id = auth.uid() and u.attivo limit 1;
$$;

create or replace function app.mio_ruolo() returns ruolo_utente
  language sql stable security definer set search_path = public, pg_temp as $$
  select u.ruolo from public.utenti u where u.auth_id = auth.uid() and u.attivo limit 1;
$$;

create or replace function app.is_programmatore() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.utenti u
                 where u.auth_id = auth.uid() and u.attivo and u.ruolo = 'PROGRAMMATORE');
$$;

-- Amministratore della ASD indicata.
create or replace function app.is_admin_di(p_asd uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_asd is not null and exists (
    select 1 from public.utenti u
    where u.auth_id = auth.uid() and u.attivo
      and u.ruolo = 'AMMINISTRATORE_ASD' and u.asd_id = p_asd);
$$;

create or replace function app.is_istruttore_di(p_asd uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_asd is not null and exists (
    select 1 from public.utenti u
    where u.auth_id = auth.uid() and u.attivo
      and u.ruolo = 'ISTRUTTORE' and u.asd_id = p_asd);
$$;

-- "Staff" = amministratore OPPURE istruttore della ASD.
-- Confermato: lo staff vede TUTTI i documenti della propria ASD, privati inclusi.
create or replace function app.is_staff_di(p_asd uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_asd is not null and exists (
    select 1 from public.utenti u
    where u.auth_id = auth.uid() and u.attivo
      and u.ruolo in ('AMMINISTRATORE_ASD','ISTRUTTORE') and u.asd_id = p_asd);
$$;

create or replace function app.is_membro_di(p_asd uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select p_asd is not null and exists (
    select 1 from public.utenti u
    where u.auth_id = auth.uid() and u.attivo and u.asd_id = p_asd);
$$;

-- L'utente corrente è nell'elenco dei destinatari di un documento PRIVATO?
-- SECURITY DEFINER anche per rompere il ciclo documenti <-> documento_atleti.
create or replace function app.e_destinatario(p_documento uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.documento_atleti da
    join public.utenti u on u.id = da.atleta_id
    where da.documento_id = p_documento and u.auth_id = auth.uid() and u.attivo);
$$;

-- L'utente corrente è iscritto al corso indicato?
create or replace function app.e_iscritto_a(p_corso uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.iscrizioni i
    join public.utenti u on u.id = i.atleta_id
    where i.corso_id = p_corso and u.auth_id = auth.uid() and u.attivo
      and i.stato in ('ATTIVA','SOSPESA','CONCLUSA'));
$$;


-- ============================================================================
--  8. TRIGGER
-- ============================================================================

-- 8.1 aggiornamento automatico di aggiornato_il / aggiornata_il
create or replace function app.tocca_timestamp() returns trigger
  language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if to_jsonb(new) ? 'aggiornato_il' then
    new.aggiornato_il := now();
  elsif to_jsonb(new) ? 'aggiornata_il' then
    new.aggiornata_il := now();
  end if;
  return new;
end $$;

create trigger t_asd_touch              before update on asd              for each row execute function app.tocca_timestamp();
create trigger t_utenti_touch           before update on utenti           for each row execute function app.tocca_timestamp();
create trigger t_documenti_touch        before update on documenti        for each row execute function app.tocca_timestamp();
create trigger t_corsi_touch            before update on corsi            for each row execute function app.tocca_timestamp();
create trigger t_giornate_touch         before update on giornate         for each row execute function app.tocca_timestamp();
create trigger t_iscrizioni_touch       before update on iscrizioni       for each row execute function app.tocca_timestamp();
create trigger t_modelli_corso_touch    before update on modelli_corso    for each row execute function app.tocca_timestamp();
create trigger t_modelli_modulo_touch   before update on modelli_modulo   for each row execute function app.tocca_timestamp();
create trigger t_moduli_compilati_touch before update on moduli_compilati for each row execute function app.tocca_timestamp();

-- 8.2 eredita asd_id dalla riga padre, così il client non deve passarlo
create or replace function app.eredita_asd_id() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tabella_padre text := tg_argv[0];
  v_colonna_fk    text := tg_argv[1];
  v_fk uuid;
  v_asd uuid;
begin
  if new.asd_id is not null then
    return new;
  end if;
  v_fk := (to_jsonb(new) ->> v_colonna_fk)::uuid;
  if v_fk is null then
    return new;
  end if;
  execute format('select asd_id from public.%I where id = $1', v_tabella_padre)
    into v_asd using v_fk;
  new.asd_id := v_asd;
  return new;
end $$;

create trigger t_giornate_asd    before insert on giornate
  for each row execute function app.eredita_asd_id('corsi', 'corso_id');
create trigger t_iscrizioni_asd  before insert on iscrizioni
  for each row execute function app.eredita_asd_id('corsi', 'corso_id');
create trigger t_presenze_asd    before insert on presenze
  for each row execute function app.eredita_asd_id('giornate', 'giornata_id');
create trigger t_doc_atleti_asd  before insert on documento_atleti
  for each row execute function app.eredita_asd_id('documenti', 'documento_id');

-- 8.3 protezione dell'identità e dei privilegi.
--
--     Tre regole, in ordine:
--     a) auth_id (il legame con l'account di login) si stabilisce SOLO tramite
--        registra_asd() e accetta_invito(). Altrimenti chiunque potrebbe
--        agganciare il proprio login al profilo di un altro — impersonificazione.
--     b) NESSUNO modifica ruolo/ASD/attivo sulla PROPRIA riga, nemmeno un
--        amministratore: è la strada più breve per l'auto-promozione.
--     c) Sulle righe altrui, solo programmatori e amministratori della stessa
--        ASD possono toccare quelle colonne.
--
--     Con auth.uid() nullo siamo in un contesto fidato (service_role,
--     migrazioni, script di manutenzione): il trigger non interviene.
create or replace function app.protegge_identita() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.auth_id is not null and new.auth_id <> auth.uid() then
      raise exception 'Non è consentito collegare un profilo all''account di un altro utente'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- (a) l'unico cambiamento ammesso di auth_id è la RIVENDICAZIONE di un profilo
  --     ancora libero da parte del proprio account (è ciò che fa accetta_invito).
  --     Volutamente NON si usa un flag di sessione: un client potrebbe
  --     impostarselo da solo prima di una UPDATE e aggirare il controllo.
  if new.auth_id is distinct from old.auth_id
     and not (old.auth_id is null and new.auth_id = auth.uid())
     -- eccezione: l'account di login è stato cancellato (diritto all'oblio),
     -- la chiave esterna azzera il collegamento. Va consentito.
     and not (new.auth_id is null
              and not exists (select 1 from auth.users a where a.id = old.auth_id)) then
    raise exception 'Il collegamento all''account non è modificabile'
      using errcode = '42501';
  end if;

  -- (b) mai su se stessi
  if old.auth_id = auth.uid()
     and (new.ruolo  is distinct from old.ruolo
       or new.asd_id is distinct from old.asd_id
       or new.attivo is distinct from old.attivo) then
    raise exception 'Non è consentito modificare ruolo, ASD o attivazione del proprio profilo'
      using errcode = '42501';
  end if;

  -- (c) sulle righe altrui servono i privilegi
  if app.is_programmatore() or app.is_admin_di(old.asd_id) then
    return new;
  end if;
  if new.ruolo is distinct from old.ruolo
     or new.asd_id is distinct from old.asd_id
     or new.attivo is distinct from old.attivo then
    raise exception 'Non autorizzato a modificare ruolo, ASD o stato di attivazione'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger t_utenti_identita before insert or update on utenti
  for each row execute function app.protegge_identita();

-- 8.3-ter nessuno cancella il proprio profilo. Oltre a essere sensato di per sé,
--         chiude un aggiramento sottile: con "DELETE ... RETURNING" e INSERT in
--         un'unica istruzione si potrebbe ricreare la propria riga da capo,
--         riscrivendo id e dati di tracciabilità.
create or replace function app.vieta_autocancellazione() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and old.auth_id = auth.uid() then
    raise exception 'Non è consentito cancellare il proprio profilo: deve farlo un altro amministratore'
      using errcode = '42501';
  end if;
  return old;
end $$;

create trigger t_utenti_no_autocancellazione before delete on utenti
  for each row execute function app.vieta_autocancellazione();

-- 8.3-bis la data di firma di un modulo è generata dal server, mai dichiarata
--         dal client: altrimenti un atleta potrebbe auto-attestarsi la firma.
create or replace function app.timbra_firma_modulo() returns trigger
  language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if new.stato = 'FIRMATO' then
    new.firmato_il := coalesce(
      case when tg_op = 'UPDATE' and old.stato = 'FIRMATO' then old.firmato_il end,
      now());
  else
    new.firmato_il := null;
  end if;
  return new;
end $$;

create trigger t_moduli_firma before insert or update on moduli_compilati
  for each row execute function app.timbra_firma_modulo();

-- 8.4 ogni ASD attiva deve conservare almeno un amministratore.
--     Più amministratori per ASD sono consentiti (scelta confermata): il vincolo
--     impedisce solo di rimanere con zero. Trigger DEFERRED, così è possibile
--     sostituire un amministratore con un altro nella stessa transazione.
create or replace function app.assicura_almeno_un_amministratore() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asd uuid := old.asd_id;
  v_n int;
begin
  if v_asd is null then
    return null;
  end if;
  -- se l'intera ASD è stata cancellata (cascata), non c'è nulla da proteggere
  if not exists (select 1 from public.asd a where a.id = v_asd) then
    return null;
  end if;
  -- Conta gli amministratori ATTIVABILI: chi ha già un account collegato,
  -- oppure chi ha un invito ancora valido da usare. Un profilo creato e mai
  -- invitato non è un amministratore effettivo e non soddisfa il vincolo.
  select count(*) into v_n
    from public.utenti u
   where u.asd_id = v_asd and u.ruolo = 'AMMINISTRATORE_ASD' and u.attivo
     and (u.auth_id is not null
          or exists (select 1 from public.inviti i
                      where i.utente_id = u.id and i.usato_il is null and i.scade_il > now()));
  if v_n = 0 then
    raise exception 'La ASD % deve avere almeno un amministratore attivo', v_asd
      using errcode = '23514';
  end if;
  return null;
end $$;

--     Il controllo scatta SOLO quando la modifica riduce davvero il numero di
--     amministratori effettivi. Senza questa condizione, una ASD rimasta con un
--     amministratore il cui account viene cancellato resterebbe bloccata per
--     sempre: ogni successiva modifica, anche innocua, fallirebbe.
create constraint trigger t_admin_cancellazione
  after delete on utenti
  deferrable initially deferred
  for each row when (old.ruolo = 'AMMINISTRATORE_ASD' and old.attivo and old.auth_id is not null)
  execute function app.assicura_almeno_un_amministratore();

create constraint trigger t_admin_modifica
  after update on utenti
  deferrable initially deferred
  for each row when (
    old.ruolo = 'AMMINISTRATORE_ASD' and old.attivo and old.auth_id is not null
    and (new.ruolo   is distinct from old.ruolo
      or new.asd_id  is distinct from old.asd_id
      or new.attivo  is distinct from old.attivo
      or new.auth_id is distinct from old.auth_id))
  execute function app.assicura_almeno_un_amministratore();


-- ============================================================================
--  9. RPC — funzioni chiamabili dal client
-- ============================================================================

-- 9.1 Onboarding di una nuova ASD: NON crea un database, crea una riga.
--     Chi la chiama diventa il primo AMMINISTRATORE_ASD di quella ASD.
create or replace function public.registra_asd(
  p_nome_asd     text,
  p_nome         text,
  p_cognome      text,
  p_codice_csain text default null,
  p_email        text default null
) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asd uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticazione richiesta' using errcode = '42501';
  end if;
  if exists (select 1 from public.utenti u where u.auth_id = auth.uid()) then
    raise exception 'Questo account è già associato a un profilo' using errcode = '23505';
  end if;

  insert into public.asd (nome, codice_affiliazione_csain, email)
       values (p_nome_asd, p_codice_csain, p_email)
    returning id into v_asd;

  insert into public.utenti (auth_id, ruolo, asd_id, nome, cognome, email)
       values (auth.uid(), 'AMMINISTRATORE_ASD', v_asd, p_nome, p_cognome, p_email);

  return v_asd;
end $$;

-- 9.2 Attivazione di un account creato da amministratore/istruttore.
create or replace function public.accetta_invito(p_codice text) returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_utente uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticazione richiesta' using errcode = '42501';
  end if;
  if exists (select 1 from public.utenti u where u.auth_id = auth.uid()) then
    raise exception 'Questo account è già associato a un profilo' using errcode = '23505';
  end if;

  select i.utente_id into v_utente
    from public.inviti i
   where i.codice = p_codice and i.usato_il is null and i.scade_il > now()
   for update;

  if v_utente is null then
    raise exception 'Invito non valido o scaduto' using errcode = '22023';
  end if;

  update public.utenti set auth_id = auth.uid() where id = v_utente and auth_id is null;
  if not found then
    raise exception 'Profilo già collegato a un altro account' using errcode = '23505';
  end if;

  update public.inviti set usato_il = now() where codice = p_codice;
  return v_utente;
end $$;

-- 9.3 Modalità "guidata": crea un corso a partire da un modello/linea guida,
--     generando automaticamente le giornate con cadenza regolare.
--     SECURITY INVOKER: le policy RLS decidono se chi chiama può creare il corso.
create or replace function public.crea_corso_da_modello(
  p_modello       uuid,
  p_titolo        text,
  p_data_inizio   date default null,
  p_cadenza_giorni int default 7
) returns uuid
  language plpgsql set search_path = public, pg_temp as $$
declare
  v_corso uuid;
  v_asd   uuid := app.mia_asd();
  g       record;
begin
  if v_asd is null then
    raise exception 'Utente non associato ad alcuna ASD' using errcode = '42501';
  end if;

  insert into public.corsi (asd_id, titolo, stato, data_inizio, creato_da)
       values (v_asd, p_titolo, 'BOZZA', p_data_inizio, app.mio_id())
    returning id into v_corso;

  for g in
    select mg.* from public.modelli_giornata mg
     where mg.modello_corso_id = p_modello
     order by mg.ordine
  loop
    insert into public.giornate
      (corso_id, asd_id, ordine, titolo, obiettivi, argomenti, durata_minuti, data)
    values
      (v_corso, v_asd, g.ordine, g.titolo, g.obiettivi, g.argomenti, g.durata_minuti,
       case when p_data_inizio is null then null
            else p_data_inizio + ((g.ordine - 1) * p_cadenza_giorni) end);
  end loop;

  return v_corso;
end $$;


-- 9.4 Correzione dei dati anagrafici sensibili, riservata allo staff della ASD.
--     Passa da qui e non da una UPDATE diretta: vedi la nota sui privilegi di
--     colonna nella sezione 10.
create or replace function public.aggiorna_dati_anagrafici(
  p_utente          uuid,
  p_codice_fiscale  text default null,
  p_n_tessera_csain text default null
) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asd uuid;
begin
  select u.asd_id into v_asd from public.utenti u where u.id = p_utente;
  if v_asd is null or not app.is_staff_di(v_asd) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;
  update public.utenti
     set codice_fiscale  = coalesce(p_codice_fiscale,  codice_fiscale),
         n_tessera_csain = coalesce(p_n_tessera_csain, n_tessera_csain)
   where id = p_utente;
end $$;


-- ============================================================================
--  10. PRIVILEGI
-- ============================================================================

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
grant execute on all functions in schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema public to authenticated;

-- Privilegi per COLONNA sulla tabella utenti. Servono perché alcune colonne non
-- devono essere scrivibili dal client in nessun caso:
--   auth_id     → il legame con l'account nasce solo da registra_asd()/accetta_invito()
--   id, creato_il, creato_da → tracciabilità: non riscrivibili a posteriori
--   codice_fiscale, n_tessera_csain → si aggiornano tramite RPC (vedi sotto):
--       l'indice unico sul codice fiscale, scrivibile liberamente, permetterebbe
--       di dedurre per tentativi il CF di un altro socio dalla chiave duplicata.
-- Nota: revocare il solo privilegio di colonna NON basta, perché il GRANT a
-- livello di tabella prevale. Occorre revocare e riconcedere per colonna.
revoke update on utenti from authenticated;
grant update (nome, cognome, data_nascita, email, telefono,
              ruolo, asd_id, attivo, aggiornato_il)
   on utenti to authenticated;

revoke insert on utenti from authenticated;
grant insert (nome, cognome, data_nascita, codice_fiscale, n_tessera_csain,
              email, telefono, ruolo, asd_id, attivo, creato_da)
   on utenti to authenticated;
