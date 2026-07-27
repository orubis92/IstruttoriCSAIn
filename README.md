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

### Notifiche in-app (obbligatorio per quella funzione)

Esegui `sql/09_notifiche.sql` (dopo 00, 01 e 05): aggiunge il conteggio dei
messaggi non letti e le preferenze di notifica per utente (canali e anticipo dei
promemoria). La campanella in alto a destra mostra messaggi non letti e prossime
lezioni. Le notifiche push/email verranno aggiunte in una fase successiva
(richiedono chiavi VAPID / un servizio email e funzioni schedulate). È ri-eseguibile.

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
