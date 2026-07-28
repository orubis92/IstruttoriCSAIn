# Configurazione notifiche push ed email

Le notifiche **in-app** (campanella) funzionano già senza nulla di tutto questo.
Questa guida serve solo per le notifiche **push** (di sistema) e **email**, che
richiedono alcuni servizi esterni. Segui i passi nell'ordine.

Ti servirà il **project ref** di Supabase (la parte prima di `.supabase.co`
nell'URL del progetto, es. `qrexvpfivhnoxsndebrj`).

---

## 1. Applica la migrazione

Nel SQL Editor di Supabase esegui `sql/11_push_email.sql` (dopo i file 00, 01,
05 e 09). Crea la coda delle notifiche, le iscrizioni push e la generazione dei
promemoria.

## 2. Abilita le estensioni

Supabase → Database → Extensions: attiva **`pg_cron`** e **`pg_net`**.

## 3. Genera le chiavi VAPID (per il push)

Sul tuo PC:

```
npx web-push generate-vapid-keys
```

Ti dà una **Public Key** e una **Private Key**. Tienile da parte.

## 4. Crea un account email (Resend)

1. Registrati su **resend.com** (piano gratuito).
2. Crea una **API Key** (la userai come `RESEND_API_KEY`).
3. Per l'indirizzo mittente: in fase di test puoi usare `onboarding@resend.dev`;
   per la produzione verifica un tuo dominio e usa un indirizzo tipo
   `notifiche@tuodominio.it`.

## 5. Scegli un segreto per il cron

Inventa una stringa lunga a caso (es. da un generatore di password): sarà
`CRON_SECRET`. Serve a far sì che solo il job programmato possa far partire l'invio.

## 6. Pubblica la funzione Edge

Installa la Supabase CLI e pubblica la funzione (dalla cartella del progetto):

```
npm install -g supabase
supabase login
supabase link --project-ref TUO_PROJECT_REF
supabase functions deploy invia-notifiche --no-verify-jwt
```

`--no-verify-jwt` è importante: la funzione è protetta dal nostro `CRON_SECRET`,
non dal login utente.

Imposta i segreti (una riga sola, sostituendo i valori):

```
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tuaemail@dominio.it RESEND_API_KEY=re_... RESEND_FROM="IstruttoriCSAIn <onboarding@resend.dev>" CRON_SECRET=il_tuo_segreto
supabase secrets set VAPID_PUBLIC_KEY=BLYuRFAOs6vTkTeZFDZ5D_R9C6TnhkYleWC0espvi_4lZdJASo8ty1eZKwtraGic6BCA5XxhxFtrP6e6vjyQ9jc VAPID_PRIVATE_KEY=hlXu5EuqOzAi4DWjBxTgru94hdKeGmuLI-rjI7jFgK4 VAPID_SUBJECT=mailto:orubis92@gmail.com CRON_SECRET=9&U18qeH5j4eYxTqPht@
```

select cron.schedule(
  'invia-notifiche',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://qrexvpfivhnoxsndebrj.functions.supabase.co/invia-notifiche',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','9&U18qeH5j4eYxTqPht@'),
    body    := '{}'::jsonb
  );
  $$
);

## 7. Programma l'invio con pg_cron

Nel SQL Editor, sostituisci `TUO_PROJECT_REF` e `IL_TUO_SEGRETO` ed esegui.
Questo fa girare l'invio ogni 5 minuti (genera i promemoria dovuti e svuota la coda):

```sql
select cron.schedule(
  'invia-notifiche',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://TUO_PROJECT_REF.functions.supabase.co/invia-notifiche',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','IL_TUO_SEGRETO'),
    body    := '{}'::jsonb
  );
  $$
);
```

Per cambiare pianificazione in seguito: `select cron.unschedule('invia-notifiche');`
e poi ripeti lo `schedule`.

## 8. Aggiungi la chiave pubblica VAPID al frontend

Su **Vercel** → Project → Settings → Environment Variables, aggiungi:

- `VITE_VAPID_PUBLIC_KEY` = la **Public Key** del punto 3

(NON marcarla “Sensitive”, come le altre.) Poi fai un **Redeploy**.
Aggiungila anche al tuo `.env` locale se sviluppi in locale.

## 9. Prova

1. Sul telefono/PC apri l'app, vai nel **profilo → Notifiche**, spunta
   «Notifiche push» e premi **«Attiva le push su questo dispositivo»**: accetta il
   permesso del browser. (Su iPhone: prima aggiungi l'app alla schermata Home.)
2. Spunta anche «Email» se vuoi le email, e **salva** le preferenze.
3. Con un altro account, mandati un messaggio in chat: entro pochi minuti dovrebbe
   arrivare la notifica push.
4. Per i promemoria: crea un corso con una giornata **domani** e iscrivi l'atleta;
   al giro successivo del cron (max 5 min) arriva il promemoria push/email.

Per un test immediato dell'invio (senza aspettare il cron) puoi lanciare a mano,
dal terminale, la stessa chiamata del punto 7 (con curl verso l'URL della funzione
e l'header `x-cron-secret`).

---

## Note

- **Email dei messaggi chat:** volutamente **non** vengono inviate via email (solo
  push), per non intasare la casella. Le email sono usate per i **promemoria**.
- **Costi:** Resend e il piano Supabase hanno generosi limiti gratuiti, ampiamente
  sufficienti per una ASD.
- **Privacy:** l'invio di email a scopo di promemoria rientra nelle finalità
  dell'informativa; valuta col tuo riferimento privacy se serve una spunta di
  consenso dedicata (la scelta del canale è già opt-in nel profilo).
- **Diagnostica:** la tabella `notifiche_coda` conserva lo stato di ogni notifica
  (`IN_ATTESA` / `INVIATA` / `ERRORE`) con l'eventuale messaggio d'errore: utile se
  qualcosa non parte.
