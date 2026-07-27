# Schema database — Piattaforma gestione corsi ASD

Schema PostgreSQL/Supabase per la piattaforma multi-ASD di gestione corsi di tiro con l'arco.

## File

| File | Contenuto |
|---|---|
| `sql/00_schema.sql` | Tipi, 13 tabelle, vincoli, indici, funzioni di supporto, trigger, RPC, privilegi |
| `sql/01_rls.sql` | Row Level Security: isolamento tra ASD e permessi per ruolo |
| `sql/02_storage.sql` | Bucket privato dei file e policy di accesso |
| `test/00_stub_supabase.sql` | Finti `auth` e `storage` per provare lo schema in locale (**non** usare su Supabase) |
| `test/01_test_rls.sql` | 88 controlli automatici su isolamento, ruoli e tentativi di abuso |

## Come applicarlo

Su Supabase, dal SQL Editor o via CLI, esegui in ordine `00_schema.sql`, `01_rls.sql`, `02_storage.sql`. Gli oggetti `auth` e `storage` esistono già: lo stub serve solo in locale.

Per rieseguire i test su una macchina con PostgreSQL 15+:

```bash
createdb asd_test
psql -d asd_test -f test/00_stub_supabase.sql
psql -d asd_test -f sql/00_schema.sql
psql -d asd_test -f sql/01_rls.sql
psql -d asd_test -f sql/02_storage.sql
psql -d asd_test -f test/01_test_rls.sql   # deve terminare con "TUTTI I CONTROLLI SUPERATI"
```

Ogni controllo fallito interrompe l'esecuzione con un errore esplicito. Conviene rilanciarli a ogni modifica delle policy: sono la rete di sicurezza del modello dei permessi.

## Il principio da non perdere di vista

**Nessuna query del frontend sceglie la ASD.** È il database che filtra, sempre, in base a chi sta chiamando. Un bug dell'app non può quindi far trapelare i dati di un'altra ASD. Per questo ogni tabella porta `asd_id` e ogni accesso passa da una policy.

Corollario pratico: non usare mai la chiave `service_role` nel frontend. Quella chiave scavalca tutte le policy ed è pensata solo per il codice lato server (Edge Function, script di manutenzione).

## Ruoli

| Ruolo | Ambito | Può fare |
|---|---|---|
| `PROGRAMMATORE` | Piattaforma (senza ASD) | Pubblica la documentazione generale e le linee guida valide per tutte le ASD |
| `AMMINISTRATORE_ASD` | Una ASD | Tutto ciò che fa l'istruttore, più creare istruttori e amministratori e gestire l'ente |
| `ISTRUTTORE` | Una ASD | Corsi, giornate, documenti, creazione atleti |
| `ATLETA` | Una ASD | Sola lettura sul proprio corso; carica la propria documentazione |

Più amministratori per ASD sono consentiti, ma ogni ASD deve sempre conservarne almeno uno *attivabile* (con account collegato o con invito valido).

## I tre livelli di documentazione

| Livello | Carica | Vede |
|---|---|---|
| `GENERALE` | Solo `PROGRAMMATORE` | Tutte le ASD |
| `ASD` / `PUBBLICO` | Staff della ASD | Tutti i membri della ASD |
| `ASD` / `PRIVATO` | Staff della ASD, o l'atleta per i propri documenti | Staff della ASD + gli atleti elencati in `documento_atleti` |

## Convenzione dei percorsi dei file

Le policy dello Storage si basano su questa convenzione, e i vincoli `CHECK` la rendono obbligatoria:

```
generale/<uuid>.<ext>                          documentazione di piattaforma
asd/<asd_id>/staff/<uuid>.<ext>                caricato da amministratori e istruttori
asd/<asd_id>/atleti/<utente_id>/<uuid>.<ext>   caricato dall'atleta
asd/<asd_id>/moduli/<modulo_id>.pdf            modulistica compilata (percorso derivato)
```

Il bucket è privato: si accede solo tramite URL firmati generati dopo il controllo dei permessi.

## Funzioni chiamabili dal client (RPC)

- `registra_asd(nome_asd, nome, cognome, codice_csain, email)` — iscrive una nuova ASD e rende chi chiama il suo primo amministratore. **Nessun database viene creato**: è una riga in più.
- `accetta_invito(codice)` — collega l'account di login a un profilo creato dallo staff.
- `crea_corso_da_modello(modello, titolo, data_inizio, cadenza_giorni)` — modalità "guidata": genera il corso e tutte le giornate da una linea guida.
- `aggiorna_dati_anagrafici(utente, codice_fiscale, n_tessera_csain)` — riservata allo staff.

## Note operative

**Creazione degli account.** Su Supabase la creazione di un utente di autenticazione richiede la chiave di servizio, quindi va fatta da una Edge Function. Il flusso previsto è però più semplice: lo staff crea l'anagrafica (senza account), genera un invito e consegna il codice all'interessato, che si registra da solo e chiama `accetta_invito`.

**Un amministratore non può degradarsi, disattivarsi o cancellarsi da solo.** Deve farlo un altro amministratore. È voluto: è la strada più breve verso l'auto-promozione e verso una ASD senza amministratori.

**Cancellazione di un account (GDPR).** Cancellare l'account di login lascia in piedi l'anagrafica con il collegamento azzerato. Se l'account è quello dell'ultimo amministratore attivabile, l'operazione viene rifiutata: prima va nominato un successore.

**Certificati medici.** `documenti.data_scadenza` permette di costruire lo scadenzario. Ricorda che sono dati sanitari (art. 9 GDPR): vanno definiti tempi di conservazione e procedura di cancellazione.

## Verifiche di sicurezza già eseguite

Lo schema è stato sottoposto a tre giri di revisione avversariale su PostgreSQL 16, con exploit realmente eseguiti. Sono stati individuati e corretti, tra gli altri: l'auto-promozione di un amministratore a `PROGRAMMATORE`, l'accesso ai file di un'altra ASD registrandone il percorso, l'escalation di un istruttore ad amministratore tramite i codici di invito, la modificabilità di `auth_id` (impersonificazione), l'auto-attestazione della firma sui moduli e diversi casi di blocco o di fuga di informazioni. Ogni correzione ha un test di regressione dedicato in `test/01_test_rls.sql`.

Restano scelte di prodotto, non difetti, da confermare:

- `registra_asd` è aperta: chiunque abbia un account può iscrivere una nuova ASD. Se vuoi un'approvazione manuale, aggiungi un campo di stato sulla ASD e filtra le policy su quello.
- Gli atleti vedono i corsi a cui sono iscritti e quelli in stato `APERTO`. Se preferisci che non vedano i corsi aperti finché non sono iscritti, si modifica `corsi_select`.
