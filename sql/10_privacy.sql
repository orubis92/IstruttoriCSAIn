-- ============================================================================
--  10_privacy.sql — informativa privacy e consenso al primo accesso
--
--    - testo e versione dell'informativa privacy, gestiti dai PROGRAMMATORI
--      (a livello di piattaforma, in impostazioni_piattaforma);
--    - consensi_privacy: registra il consenso di ogni utente, con versione e
--      data, per la tracciabilità richiesta dal GDPR. Al primo accesso (o quando
--      esce una nuova versione) l'app mostra l'informativa e chiede il consenso.
--
--  Eseguire dopo 00,01,08. Idempotente.
-- ============================================================================

alter table impostazioni_piattaforma add column if not exists privacy_testo text;
alter table impostazioni_piattaforma add column if not exists privacy_versione int not null default 1;

-- Testo di default (modello da far verificare a un riferimento privacy).
update impostazioni_piattaforma
   set privacy_testo = $md$INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI (art. 13 Reg. UE 2016/679 - GDPR)

Titolare del trattamento
La tua ASD, in qualità di titolare del trattamento, tratta i dati personali che ti riguardano per la gestione dell'attività sportiva, del tesseramento, dei corsi e degli adempimenti amministrativi e assicurativi connessi.

Dati trattati
Dati anagrafici e di contatto (nome, cognome, data di nascita, codice fiscale, numero di tessera, email, telefono), dati relativi alla partecipazione ai corsi e alle presenze, ed eventuali documenti caricati. I certificati medici costituiscono dati relativi alla salute (categoria particolare, art. 9 GDPR) e sono trattati esclusivamente per la verifica dell'idoneità alla pratica sportiva.

Finalità e base giuridica
I dati sono trattati per l'esecuzione del rapporto associativo e dei servizi richiesti, per adempiere a obblighi di legge e, per i dati sanitari, sulla base del consenso e per finalità di tutela della salute nell'ambito sportivo.

Conservazione
I dati sono conservati per il tempo necessario alle finalità indicate e agli obblighi di legge, e successivamente cancellati o anonimizzati.

Comunicazione
I dati non sono diffusi e sono comunicati solo ai soggetti autorizzati (staff della ASD) e, ove necessario, agli enti di affiliazione e assicurativi.

Diritti dell'interessato
Puoi in ogni momento esercitare i diritti di accesso, rettifica, cancellazione, limitazione e opposizione previsti dagli artt. 15-22 GDPR, contattando la ASD.

Prestando il consenso dichiari di aver letto la presente informativa.$md$
 WHERE id = 1 AND privacy_testo IS NULL;

-- Registro dei consensi (uno per utente e per versione dell'informativa).
create table if not exists consensi_privacy (
  utente_id    uuid not null references utenti(id) on delete cascade,
  versione     int  not null,
  accettato_il timestamptz not null default now(),
  primary key (utente_id, versione)
);

alter table consensi_privacy enable row level security;

-- Ognuno gestisce (vede e registra) solo i propri consensi.
drop policy if exists consensi_select on consensi_privacy;
create policy consensi_select on consensi_privacy for select to authenticated
  using ( utente_id = app.mio_id() );

drop policy if exists consensi_insert on consensi_privacy;
create policy consensi_insert on consensi_privacy for insert to authenticated
  with check ( utente_id = app.mio_id() );

grant select, insert on consensi_privacy to authenticated;
