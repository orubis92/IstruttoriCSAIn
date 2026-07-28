-- ============================================================================
--  16_piattaforma_statistiche.sql — vista d'insieme per i PROGRAMMATORI
--
--  Consente ai soli PROGRAMMATORI di consultare, a fini gestionali/statistici,
--  i corsi di TUTTE le ASD e alcuni aggregati per ASD. Scelte etiche/GDPR:
--    - SOLO aggregati e metadati dei corsi (titolo, stato, date, conteggi):
--      NESSUNA anagrafica di atleti, NESSUN dato personale, e in particolare
--      NESSUN dato sanitario (i certificati medici restano totalmente fuori).
--    - accesso tracciato: la RPC registra_consultazione_piattaforma() registra
--      la consultazione nel registro accessi (art. 9 / accountability).
--    - trasparenza: va aggiunto all'informativa privacy un paragrafo che dichiara
--      che il gestore della piattaforma può consultare dati statistici e operativi
--      (testo suggerito in fondo a questo file e nel README).
--
--  Eseguire dopo 00,01,05,14. Idempotente.
-- ============================================================================

-- Metadati dei corsi di tutte le ASD (nessun dato personale). Gated ai soli
-- programmatori: per chiunque altro la vista non restituisce righe.
create or replace view v_programmatore_corsi
  with (security_invoker = false, security_barrier = true) as
  select
    c.id            as corso_id,
    c.asd_id        as asd_id,
    a.nome          as asd_nome,
    c.titolo        as titolo,
    c.stato         as stato,
    c.data_inizio   as data_inizio,
    c.data_fine     as data_fine,
    c.posti_massimi as posti_massimi,
    c.creato_il     as creato_il,
    (select count(*) from iscrizioni i where i.corso_id = c.id)                      as n_iscritti,
    (select count(*) from iscrizioni i where i.corso_id = c.id and i.stato = 'ATTIVA') as n_iscritti_attivi
  from corsi c
  join asd a on a.id = c.asd_id
  where app.is_programmatore();

grant select on v_programmatore_corsi to authenticated;

-- Aggregati per ASD (solo conteggi, nessun nominativo). Gated ai programmatori.
create or replace view v_programmatore_asd
  with (security_invoker = false, security_barrier = true) as
  select
    a.id     as asd_id,
    a.nome   as asd_nome,
    a.attiva as attiva,
    (select count(*) from corsi c where c.asd_id = a.id)                                        as n_corsi_totali,
    (select count(*) from corsi c where c.asd_id = a.id and c.stato in ('APERTO','IN_CORSO'))   as n_corsi_attivi,
    (select count(*) from corsi c where c.asd_id = a.id and c.stato = 'CONCLUSO')               as n_corsi_conclusi,
    (select count(*) from iscrizioni i where i.asd_id = a.id and i.stato = 'ATTIVA')            as n_iscrizioni_attive,
    (select count(*) from utenti u where u.asd_id = a.id and u.attivo and u.ruolo = 'ATLETA')   as n_atleti,
    (select count(*) from utenti u where u.asd_id = a.id and u.attivo
        and u.ruolo in ('AMMINISTRATORE_ASD','ISTRUTTORE'))                                     as n_staff
  from asd a
  where app.is_programmatore();

grant select on v_programmatore_asd to authenticated;

-- Registra nel registro accessi una consultazione della vista di piattaforma.
-- Il frontend la chiama all'apertura della pagina statistiche. asd_id è NULL
-- perché è un accesso "di piattaforma", non a una singola ASD.
create or replace function public.registra_consultazione_piattaforma() returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io uuid := app.mio_id();
begin
  if not app.is_programmatore() then
    raise exception 'Riservato ai programmatori' using errcode = '42501';
  end if;
  insert into audit_accessi (asd_id, attore_id, attore_nome, oggetto_tipo, azione)
  select null, v_io,
         (select nome || ' ' || cognome from utenti where id = v_io),
         'PIATTAFORMA', 'CONSULTAZIONE';
end $$;

grant execute on function public.registra_consultazione_piattaforma() to authenticated;

-- ----------------------------------------------------------------------------
--  Paragrafo suggerito da aggiungere all'informativa privacy (da pubblicare
--  tramite Impostazioni, aumentando la versione così gli utenti riprestano il
--  consenso). NON viene applicato automaticamente qui per non sovrascrivere un
--  testo eventualmente personalizzato:
--
--  «Statistiche di piattaforma. Il gestore della piattaforma (amministratore
--   tecnico) può consultare dati statistici e operativi aggregati relativi ai
--   corsi delle ASD (numero di corsi e di iscritti, date, stato), a fini di
--   funzionamento, assistenza e miglioramento del servizio. Tale consultazione
--   non riguarda i dati sanitari, che restano accessibili unicamente allo staff
--   della ASD di appartenenza, ed è registrata.»
-- ----------------------------------------------------------------------------
