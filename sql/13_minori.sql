-- ============================================================================
--  13_minori.sql — gestione degli atleti minorenni e del genitore/tutore
--
--  Nel tiro con l'arco molti allievi sono minorenni: per loro il consenso al
--  trattamento dei dati (compresi quelli sanitari) è prestato da chi esercita la
--  responsabilità genitoriale, non dal minore. Qui aggiungiamo:
--    - i dati del genitore/tutore sull'anagrafica dell'atleta;
--    - un helper per capire se una data di nascita indica un minorenne;
--    - i campi sul registro dei consensi per tracciare che il consenso è stato
--      prestato per conto di un minore, da chi e con quale relazione.
--
--  Eseguire dopo 00,01,10. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Dati del genitore/tutore sull'anagrafica dell'atleta
-- ----------------------------------------------------------------------------
alter table utenti add column if not exists genitore_nome            text;
alter table utenti add column if not exists genitore_cognome         text;
alter table utenti add column if not exists genitore_codice_fiscale  text;
alter table utenti add column if not exists genitore_email           text;
alter table utenti add column if not exists genitore_telefono        text;
alter table utenti add column if not exists genitore_relazione       text;   -- es. 'Genitore', 'Tutore'

comment on column utenti.genitore_nome is
  'Dati di chi esercita la responsabilità genitoriale, per gli atleti minorenni.';

-- IMPORTANTE: le colonne di utenti hanno privilegi PER COLONNA (vedi 00_schema
-- sezione 10). Le colonne appena aggiunte NON sarebbero scrivibili dal client
-- senza riconcedere insert/update includendole. Ripetiamo qui le concessioni
-- complete (idempotente: revoke + grant).
revoke insert on utenti from authenticated;
grant insert (nome, cognome, data_nascita, codice_fiscale, n_tessera_csain,
              email, telefono, ruolo, asd_id, attivo, creato_da,
              genitore_nome, genitore_cognome, genitore_codice_fiscale,
              genitore_email, genitore_telefono, genitore_relazione)
   on utenti to authenticated;

revoke update on utenti from authenticated;
grant update (nome, cognome, data_nascita, email, telefono,
              ruolo, asd_id, attivo, aggiornato_il,
              genitore_nome, genitore_cognome, genitore_codice_fiscale,
              genitore_email, genitore_telefono, genitore_relazione)
   on utenti to authenticated;

-- ----------------------------------------------------------------------------
--  2. È minorenne? (compie 18 anni dopo oggi)
-- ----------------------------------------------------------------------------
create or replace function app.e_minorenne(p_data date) returns boolean
  language sql stable set search_path = pg_catalog, pg_temp as $$
  select p_data is not null and p_data > (current_date - interval '18 years');
$$;
grant execute on function app.e_minorenne(date) to authenticated;

-- ----------------------------------------------------------------------------
--  3. Consenso prestato per conto di un minore
-- ----------------------------------------------------------------------------
alter table consensi_privacy add column if not exists per_minore           boolean not null default false;
alter table consensi_privacy add column if not exists firmatario_nome      text;
alter table consensi_privacy add column if not exists firmatario_relazione text;

comment on column consensi_privacy.firmatario_nome is
  'Per i minori: nome e cognome di chi ha prestato il consenso (genitore/tutore).';
