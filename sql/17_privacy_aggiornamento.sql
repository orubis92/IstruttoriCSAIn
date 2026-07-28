-- ============================================================================
--  17_privacy_aggiornamento.sql — aggiornamento del testo dell'informativa
--
--  Aggiunge all'informativa privacy due sezioni (Minori e Statistiche di
--  piattaforma) coerenti con le funzioni introdotte. Poiché l'informativa NON
--  è ancora stata distribuita agli utenti, il testo viene sostituito senza
--  aumentare la versione (nessun consenso già prestato da rinnovare).
--
--  ATTENZIONE: se in futuro modifichi l'informativa DOPO che è stata pubblicata
--  e già accettata, aumenta anche privacy_versione, così gli utenti riprestano
--  il consenso alla nuova versione.
--
--  Eseguire dopo 10. Sostituisce il testo corrente (id = 1).
-- ============================================================================

update impostazioni_piattaforma
   set privacy_testo = $md$INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI (art. 13 Reg. UE 2016/679 - GDPR)

Titolare del trattamento
La tua ASD, in qualità di titolare del trattamento, tratta i dati personali che ti riguardano per la gestione dell'attività sportiva, del tesseramento, dei corsi e degli adempimenti amministrativi e assicurativi connessi.

Dati trattati
Dati anagrafici e di contatto (nome, cognome, data di nascita, codice fiscale, numero di tessera, email, telefono), dati relativi alla partecipazione ai corsi e alle presenze, ed eventuali documenti caricati. I certificati medici costituiscono dati relativi alla salute (categoria particolare, art. 9 GDPR) e sono trattati esclusivamente per la verifica dell'idoneità alla pratica sportiva.

Finalità e base giuridica
I dati sono trattati per l'esecuzione del rapporto associativo e dei servizi richiesti, per adempiere a obblighi di legge e, per i dati sanitari, sulla base del consenso e per finalità di tutela della salute nell'ambito sportivo.

Minori
Per gli atleti minorenni il consenso al trattamento dei dati, compresi quelli sanitari, è prestato da chi esercita la responsabilità genitoriale (genitore o tutore), i cui dati anagrafici e di contatto sono raccolti a tale fine.

Conservazione
I dati sono conservati per il tempo necessario alle finalità indicate e agli obblighi di legge, e successivamente cancellati o anonimizzati.

Comunicazione
I dati non sono diffusi e sono comunicati solo ai soggetti autorizzati (staff della ASD) e, ove necessario, agli enti di affiliazione e assicurativi.

Statistiche di piattaforma
Il gestore tecnico della piattaforma può consultare dati statistici e operativi aggregati relativi ai corsi delle ASD (numero di corsi e di iscritti, date, stato del corso), a fini di funzionamento, assistenza e miglioramento del servizio. Tale consultazione riguarda esclusivamente dati aggregati e metadati dei corsi: non comprende i dati sanitari né le anagrafiche degli atleti, che restano accessibili unicamente allo staff della ASD di appartenenza, ed è registrata.

Diritti dell'interessato
Puoi in ogni momento esercitare i diritti di accesso, rettifica, cancellazione, limitazione e opposizione previsti dagli artt. 15-22 GDPR, contattando la ASD.

Prestando il consenso dichiari di aver letto la presente informativa.$md$
 where id = 1;
