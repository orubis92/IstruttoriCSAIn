-- ============================================================================
--  18_dpa.sql — accordo sul trattamento dei dati (DPA) firmato da ogni ASD
--
--  Il DPA (art. 28 GDPR) è un atto a livello di ASD: al primo accesso un
--  amministratore deve compilarlo (dati della propria ASD) e accettarlo. Finché
--  non è accettato, l'app mostra una schermata bloccante (gestita dal frontend).
--
--    - dpa_testo / dpa_versione in impostazioni_piattaforma: il testo del DPA
--      (gestito dai programmatori), con segnaposto per i dati della ASD;
--    - accettazioni_dpa: registro (immutabile) delle accettazioni per ASD e
--      versione, con i dati compilati e il nominativo del firmatario.
--
--  Eseguire dopo 00,01,08. Idempotente.
-- ============================================================================

alter table impostazioni_piattaforma add column if not exists dpa_testo text;
alter table impostazioni_piattaforma add column if not exists dpa_versione int not null default 1;

-- Testo di default (modello: i dati del RESPONSABILE vanno completati dai
-- programmatori da Impostazioni; i segnaposto [•_ASD] e [FORO] sono compilati
-- dalla ASD in fase di firma).
update impostazioni_piattaforma
   set dpa_testo = $dpa$ACCORDO SUL TRATTAMENTO DEI DATI PERSONALI (art. 28 Reg. UE 2016/679 - GDPR)

TRA
Il Titolare del trattamento: [DENOMINAZIONE_ASD]
Codice fiscale / P. IVA: [CF_ASD]
Sede: [SEDE_ASD]
Legale rappresentante: [LEGALE_RAPP_ASD]

E
Il Responsabile del trattamento, gestore della piattaforma IstruttoriCSAIn:
[Nome del gestore della piattaforma] — [dati di contatto del gestore]
(dati da completare a cura del gestore della piattaforma)

PREMESSE
Il Titolare tratta dati personali di associati, atleti, istruttori e staff. Il Responsabile mette a disposizione la piattaforma per la gestione dei corsi, delle anagrafiche, delle presenze, della documentazione e delle comunicazioni interne, trattando tali dati per conto del Titolare. Il presente Accordo disciplina i rispettivi obblighi ai sensi dell'art. 28 GDPR ed è parte integrante del rapporto di fornitura del servizio.

ART. 1 — OGGETTO E RUOLI
Il Responsabile tratta i dati esclusivamente per conto del Titolare e secondo le sue istruzioni documentate. L'uso della piattaforma secondo la documentazione e le configurazioni disponibili (ruoli, permessi, preferenze) costituisce istruzione documentata. La segregazione tra i dati di ASD diverse è garantita da misure tecniche (Allegato B).

ART. 2 — NATURA, FINALITÀ E DATI
Le operazioni comprendono raccolta, registrazione, organizzazione, conservazione, consultazione, aggiornamento, comunicazione ai soggetti autorizzati e cancellazione, per le finalità di gestione dell'attività sportiva. I dati comprendono dati anagrafici e di contatto, dati di partecipazione ai corsi e alle presenze, dati dei genitori/tutori dei minori e, quali categorie particolari (art. 9), dati relativi alla salute (certificati medici di idoneità sportiva). Il Responsabile non utilizza i dati per finalità proprie.

ART. 3 — OBBLIGHI DEL RESPONSABILE (art. 28, par. 3)
a) trattare i dati solo su istruzione documentata del Titolare;
b) garantire la riservatezza delle persone autorizzate al trattamento;
c) adottare le misure di sicurezza di cui all'art. 32 (Allegato B);
d) ricorrere a sub-responsabili solo alle condizioni dell'art. 4;
e) assistere il Titolare nel dare seguito alle richieste degli interessati (artt. 15-22), anche tramite le funzioni di esportazione e cancellazione;
f) assistere il Titolare negli adempimenti degli artt. 32-36 (sicurezza, violazioni, DPIA);
g) a scelta del Titolare, cancellare o restituire i dati al termine del servizio, salvo obblighi di legge;
h) mettere a disposizione le informazioni necessarie a dimostrare il rispetto degli obblighi e consentire audit, senza pregiudizio per la riservatezza dei dati di altri titolari.
Il Responsabile informa il Titolare se un'istruzione appare in contrasto con la normativa.

ART. 4 — SUB-RESPONSABILI
Il Titolare autorizza in via generale i sub-responsabili elencati nell'Allegato C, imponendo loro obblighi equivalenti. Il Responsabile resta responsabile del loro operato e informa il Titolare, con ragionevole preavviso, di aggiunte o sostituzioni, consentendo al Titolare di opporsi per motivi legittimi.

ART. 5 — TRASFERIMENTI EXTRA-SEE
Eventuali trasferimenti fuori dallo SEE avvengono solo con garanzie adeguate (adeguatezza o Clausole Contrattuali Tipo). Ove possibile si selezionano regioni di trattamento nell'Unione Europea.

ART. 6 — VIOLAZIONE DEI DATI
Il Responsabile notifica al Titolare ogni violazione dei dati personali senza ingiustificato ritardo dalla conoscenza, con le informazioni utili. Restano in capo al Titolare le valutazioni sulla notifica all'Autorità (art. 33) e agli interessati (art. 34).

ART. 7 — DURATA E SORTE DEI DATI
L'Accordo ha efficacia per la durata del rapporto di fornitura e cessa con esso, fermo l'obbligo di cui all'art. 3(g). Il Titolare può esportare i propri dati in ogni momento.

ART. 8 — LEGGE APPLICABILE E FORO
L'Accordo è regolato dalla legge italiana; per le controversie è competente il Foro di [FORO].

ALLEGATO B — MISURE DI SICUREZZA (sintesi)
Isolamento tra titolari a livello di database (Row-Level Security); controllo accessi basato sui ruoli con privilegi minimi; protezione rafforzata dei dati sanitari (accesso limitato allo staff della ASD e registrazione degli accessi); vista di piattaforma del gestore limitata a dati aggregati e metadati, senza anagrafiche né dati sanitari, con accessi registrati; cifratura in transito e a riposo; autenticazione individuale e recupero password; registro dei consensi e gestione del consenso del genitore per i minori; backup e ripristino a livello di infrastruttura; funzioni di esportazione e cancellazione a supporto dei diritti degli interessati.

ALLEGATO C — SUB-RESPONSABILI
Supabase (database, autenticazione, archiviazione file); Vercel (hosting dell'applicazione); Resend (invio email, se attivato); Sentry (monitoraggio errori, se attivato). Per ciascuno vanno verificati il relativo DPA e le condizioni di trasferimento.

Nota: modello da far validare da un riferimento legale/privacy prima dell'uso.$dpa$
 where id = 1 and dpa_testo is null;

-- Registro delle accettazioni: una per ASD e versione del DPA. Immutabile
-- (nessun grant di update/delete): resta traccia certa della firma.
create table if not exists accettazioni_dpa (
  asd_id                uuid not null references asd(id) on delete cascade,
  versione              int  not null,
  accettato_da          uuid references utenti(id) on delete set null,
  firmatario_nome       text not null,
  firmatario_ruolo      text,
  denominazione         text,
  codice_fiscale        text,
  sede                  text,
  legale_rappresentante text,
  foro                  text,
  accettato_il          timestamptz not null default now(),
  primary key (asd_id, versione)
);

alter table accettazioni_dpa enable row level security;

drop policy if exists dpa_select on accettazioni_dpa;
create policy dpa_select on accettazioni_dpa for select to authenticated
  using ( app.is_programmatore() or app.is_staff_di(asd_id) );

-- Solo un amministratore della ASD può firmare, e solo a proprio nome.
drop policy if exists dpa_insert on accettazioni_dpa;
create policy dpa_insert on accettazioni_dpa for insert to authenticated
  with check ( app.is_admin_di(asd_id) and accettato_da = app.mio_id() );

grant select, insert on accettazioni_dpa to authenticated;
