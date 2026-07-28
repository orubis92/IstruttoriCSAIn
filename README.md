# IstruttoriCSAIn — Frontend

PWA (Progressive Web App) per la gestione dei corsi di tiro con l'arco delle ASD affiliate CSAIN.
React + TypeScript + Vite, con backend Supabase.

## Requisiti

- Node.js 18 o superiore
- Un progetto Supabase con lo schema applicato (vedi cartella `sql/` del repository)

## Avvio in locale

```bash
npm install
cp .env.example .env      # poi inserisci le due chiavi Supabase
npm run dev
```

L'app parte su http://localhost:5173.

### Configurazione Supabase

In `.env` servono due valori, che trovi nel pannello Supabase alla voce
Project Settings → API:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Usa **solo** la chiave `anon` (pubblica). La chiave `service_role` non va mai
messa nel frontend: scavalca tutte le policy di sicurezza del database.

### Corsi standard e revisione (obbligatorio per quella funzione)

Esegui `sql/04_proposte.sql` (dopo 00, 01, 02): aggiunge la tabella e le funzioni
per proporre i corsi delle ASD come corsi standard e per la loro revisione da
parte dei programmatori. È ri-eseguibile senza problemi.

### Certificati medici e chat (obbligatorio per quelle funzioni)

Esegui `sql/05_chat_certificati.sql` (dopo 00, 01, 02): aggiunge i certificati
medici strutturati per atleta e la chat interna (conversazioni dirette e di
gruppo, con permessi per appartenenza). Le note per singola giornata usano una
colonna già presente e non richiedono migrazioni. È ri-eseguibile.

### Storico, commenti e diplomi (obbligatorio per quelle funzioni)

Esegui `sql/06_storico.sql` (dopo 00, 01, 02): aggiunge le valutazioni sulle
iscrizioni, i commenti su corso/giornata e gli istruttori del corso con firma
(per i diplomi). È ri-eseguibile.

### Impostazioni e logo (obbligatorio per quella funzione)

Esegui `sql/07_impostazioni.sql` (dopo 00): aggiunge il campo logo alla ASD,
usato nella barra dell'app e sui diplomi. È ri-eseguibile.

### Logo CSAIN di piattaforma (obbligatorio per quella funzione)

Esegui `sql/08_piattaforma.sql` (dopo 00, 01): aggiunge le impostazioni di
piattaforma con il logo CSAIN, gestito dai soli programmatori e mostrato a
sinistra del logo ASD e in alto a destra sui diplomi. È ri-eseguibile.

### Informativa privacy e consenso (obbligatorio per quella funzione)

Esegui `sql/10_privacy.sql` (dopo 00, 01, 08): aggiunge il testo/versione
dell'informativa privacy (gestita dai programmatori) e il registro dei consensi
per utente. Al primo accesso — e a ogni nuova versione — l'app mostra
l'informativa come schermata bloccante e chiede il consenso, che viene registrato
con data e versione. Il testo iniziale è un modello da far validare a un
riferimento privacy. È ri-eseguibile.

### Notifiche in-app (obbligatorio per quella funzione)

Esegui `sql/09_notifiche.sql` (dopo 00, 01 e 05): aggiunge il conteggio dei
messaggi non letti e le preferenze di notifica per utente (canali e anticipo dei
promemoria). La campanella in alto a destra mostra messaggi non letti e prossime
lezioni. È ri-eseguibile.

### Notifiche push ed email

Esegui `sql/11_push_email.sql` (dopo 00, 01, 05, 09): aggiunge la coda delle
notifiche, le iscrizioni push e la generazione dei promemoria. L'invio vero
(push + email) richiede una funzione Edge, chiavi VAPID, un servizio email
(Resend) e uno scheduler (pg_cron). **Segui la guida `NOTIFICHE_SETUP.md`** per
tutti i passaggi. La funzione Edge è in `supabase/functions/invia-notifiche/`.

### Certificati medici: avvisi e blocco (obbligatorio per quella funzione)

Esegui `sql/12_certificati_avvisi.sql` (dopo 00, 01, 05, 09, 11): aggiunge la
verifica di validità del certificato, la vista `v_certificati_atleti` con lo
stato (assente/scaduto/in scadenza/valido) e la funzione `accoda_avvisi_certificati`
che mette in coda un avviso push/email quando un certificato è scaduto o scade
entro 30 giorni. Nel cruscotto lo staff vede un riquadro con i certificati da
controllare; in «Membri» e negli iscritti a un corso compare un badge di stato.
È ri-eseguibile.

### Gestione dei minori (obbligatorio per quella funzione)

Esegui `sql/13_minori.sql` (dopo 00, 01, 10): aggiunge i dati del genitore/tutore
sull'anagrafica dell'atleta e i campi per registrare il consenso privacy prestato
per conto di un minore. Nei form di «Membri» i campi del genitore compaiono
automaticamente quando la data di nascita indica un minorenne; al primo accesso,
per un utente minorenne, l'informativa chiede il nominativo di chi presta il
consenso. È ri-eseguibile.

### Registro accessi ai dati sanitari — art. 9 GDPR (obbligatorio per quella funzione)

Esegui `sql/14_audit_art9.sql` (dopo 00, 01, 05): aggiunge il registro degli
accessi ai certificati medici. Le scritture sono tracciate da un trigger; le
letture dello staff sui dati di un altro atleta passano dalla RPC
`leggi_certificati_atleta`, che registra l'accesso. Il registro è consultabile
da «Impostazioni → Registro accessi ai dati sanitari» (solo amministratori e
programmatori). È ri-eseguibile.

### Eliminazione delle chat (obbligatorio per quella funzione)

Esegui `sql/15_chat_elimina.sql` (dopo 00, 01, 05): aggiunge le funzioni per
eliminare una conversazione o uscire da un gruppo. Nelle chat dirette può
eliminare ogni partecipante; nei gruppi solo chi l'ha creato o un amministratore,
mentre gli altri membri possono uscire. Dalla pagina Chat compaiono le icone
corrispondenti nell'intestazione della conversazione. È ri-eseguibile.

### Vista di piattaforma per i programmatori (obbligatorio per quella funzione)

Esegui `sql/16_piattaforma_statistiche.sql` (dopo 00, 01, 05, 14): aggiunge, per i
soli PROGRAMMATORI, le viste con i **metadati** dei corsi di tutte le ASD e gli
**aggregati** per ASD, più la RPC che registra ogni consultazione nel registro
accessi. La sezione «Piattaforma» (menu, solo programmatori) mostra riepiloghi,
un grafico dei corsi attivi per ASD, il dettaglio per ASD e l'elenco corsi con
filtri ed export CSV.

Per scelta etica/GDPR la vista espone **solo dati aggregati e metadati** (titolo,
stato, date, conteggi): nessuna anagrafica degli atleti e **nessun dato sanitario**.
Per trasparenza l'informativa privacy è già aggiornata con la sezione «Statistiche
di piattaforma» (vedi sotto).

### Aggiornamento dell'informativa privacy

Esegui `sql/17_privacy_aggiornamento.sql` (dopo 10): aggiorna il testo
dell'informativa aggiungendo le sezioni «Minori» e «Statistiche di piattaforma».
Poiché l'informativa non è ancora stata distribuita, il testo viene sostituito
senza aumentare la versione. Se un domani modifichi l'informativa DOPO averla
pubblicata e fatta accettare, ricordati di aumentare `privacy_versione` così gli
utenti riprestano il consenso.

### Accordo trattamento dati (DPA) firmato da ogni ASD (obbligatorio per quella funzione)

Esegui `sql/18_dpa.sql` (dopo 00, 01, 08): aggiunge il testo/versione del DPA
(gestito dai programmatori) e il registro immutabile delle accettazioni per ASD.
Al primo accesso, un **amministratore** di ogni ASD deve compilare i dati della
propria ASD e accettare il DPA tramite una schermata bloccante; finché non è
firmato, l'ASD non può usare l'app. Lo stato e il PDF del documento firmato sono
disponibili nella sezione **Modulistica**. Il testo di default contiene segnaposto
`[•_ASD]`/`[FORO]` compilati dalla ASD in fase di firma; i dati del **responsabile**
(gestore) vanno completati nel testo (`impostazioni_piattaforma.dpa_testo`). È
ri-eseguibile. Il modello va comunque validato da un riferimento legale/privacy.

### Monitoraggio errori (facoltativo)

Imposta `VITE_SENTRY_DSN` (Vercel + `.env`) con il DSN di un progetto Sentry per
inviare gli errori di produzione. Senza DSN l'app funziona normalmente e non
invia nulla. Il DSN è pubblico per natura, come la chiave anon.

### Export e PDF

Da «Membri» si esporta l'elenco in CSV; da un corso si scaricano il **report
presenze** (PDF e CSV) e i **diplomi in PDF** (oltre alla stampa). Non serve
alcuna configurazione.

### Dati di base (opzionale ma consigliato)

Dopo aver applicato i file `sql/00`, `01`, `02`, esegui anche `sql/03_seed.sql`
nel SQL Editor di Supabase: aggiunge due linee guida di corso (Base e Intermedio,
con le relative giornate) e tre moduli pronti (iscrizione, privacy,
autocertificazione salute), così l'app non parte vuota. È ri-eseguibile senza
creare duplicati.

### Guida in linea

Dentro l'app, in alto a destra, il pulsante con l'icona di supporto («?») apre una
guida rapida alle funzioni, adattata al ruolo di chi è collegato.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia il server di sviluppo con hot reload |
| `npm run build` | Type-check + build di produzione in `dist/` |
| `npm run preview` | Anteprima locale della build di produzione |
| `npm run lint` | Solo controllo dei tipi TypeScript |

## Struttura

```
src/
  api/          funzioni verso Supabase (tabelle e RPC), una per area
  components/   Layout, rotte protette, controllo ruoli, componenti UI, toast
  context/      AuthContext (sessione, profilo, ruolo)
  lib/          client Supabase, tipi del database, helper di formato
  pages/        una pagina per schermata
```

## Ruoli e cosa vede ciascuno

- **Programmatore** — pubblica la documentazione generale valida per tutte le ASD.
- **Amministratore ASD** — gestisce la propria ASD: crea istruttori e atleti, corsi, documenti.
- **Istruttore** — gestisce corsi, giornate, documenti; crea atleti.
- **Atleta** — vede i propri corsi, carica la propria documentazione, compila i moduli.

L'accesso ai dati è deciso dal database (Row Level Security): il frontend non
sceglie mai la ASD, la filtra automaticamente il backend in base a chi è loggato.

## Flussi principali

1. **Registrazione ASD.** Crei un account, poi dalla schermata di benvenuto scegli
   «Registra la tua ASD»: diventi il primo amministratore.
2. **Attivazione da invito.** Lo staff crea l'anagrafica di un membro e genera un
   codice invito; il membro crea l'account e inserisce il codice in «Ho un codice invito».
3. **Corsi.** Creazione guidata (da una linea guida, con generazione automatica delle
   giornate) o manuale. Gestione di iscrizioni e presenze.
4. **Documenti.** Tre livelli: generale, ASD pubblico, ASD privato (con elenco atleti).
5. **Modulistica.** Compilazione dei moduli definiti come modelli; firma da parte dello staff.

## Note

- I moduli (iscrizione, privacy, ecc.) vanno definiti come record in `modelli_modulo`
  sul database; l'app li mostra e li rende compilabili automaticamente in base al loro
  `schema_campi`.
- Le linee guida dei corsi vanno definite in `modelli_corso` / `modelli_giornata`.
- La generazione dei PDF firmati dei moduli è predisposta lato dati (`pdf_path`,
  `firma_path`) ma l'editor di firma grafica non è incluso in questa prima versione.
