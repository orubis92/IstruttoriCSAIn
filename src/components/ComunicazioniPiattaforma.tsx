import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Send, Activity, RefreshCw } from 'lucide-react'
import {
  inviaAvvisoPiattaforma,
  listaAvvisiPiattaforma,
  statoInvioNotifiche,
  scartaNotificheScadute,
} from '@/api/notifiche'
import type { StatoInvioNotifiche } from '@/lib/database.types'
import { messaggioErrore } from '@/api/errors'
import { useToast } from '@/components/Toast'
import { Card, Field, Spinner, Badge, Alert } from '@/components/ui'
import { formatDataOra } from '@/lib/format'

/** Comunicazioni del programmatore a tutte le ASD (staff o tutti i membri). */
export function ComunicazioniPiattaforma() {
  const toast = useToast()
  const qc = useQueryClient()
  const storico = useQuery({ queryKey: ['avvisi-piattaforma'], queryFn: listaAvvisiPiattaforma })

  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [destinatari, setDestinatari] = useState<'STAFF' | 'TUTTI'>('STAFF')
  const [urgente, setUrgente] = useState(false)

  const invia = useMutation({
    mutationFn: () => inviaAvvisoPiattaforma(titolo.trim(), testo.trim(), destinatari, urgente),
    onSuccess: (n) => {
      toast.successo(`Comunicazione inviata a ${n} ${n === 1 ? 'utente' : 'utenti'}.`)
      setTitolo('')
      setTesto('')
      setUrgente(false)
      void qc.invalidateQueries({ queryKey: ['avvisi-piattaforma'] })
      void qc.invalidateQueries({ queryKey: ['stato-invio'] })
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invio(e: FormEvent) {
    e.preventDefault()
    if (!titolo.trim() || !testo.trim()) return
    const chi = destinatari === 'STAFF' ? 'allo staff (amministratori e istruttori) di tutte le ASD' : 'a TUTTI i membri di tutte le ASD, atleti compresi'
    if (confirm(`Inviare ${urgente ? 'un avviso URGENTE ' : 'la comunicazione '}${chi}?`)) invia.mutate()
  }

  return (
    <Card className="mt-4 p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <Megaphone className="h-4 w-4 text-brand-600" /> Comunicazioni alle ASD
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Manutenzioni, novità dell'app, scadenze CSAIN. Arriva nel centro notifiche e, a chi le ha attivate, in push.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={invio} className="space-y-3">
          <Field label="Destinatari">
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="radio" checked={destinatari === 'STAFF'} onChange={() => setDestinatari('STAFF')} />
                Solo staff
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={destinatari === 'TUTTI'} onChange={() => setDestinatari('TUTTI')} />
                Tutti i membri
              </label>
            </div>
          </Field>
          <Field label="Titolo" obbligatorio>
            <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Messaggio" obbligatorio>
            <textarea className="input min-h-[110px]" value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={1500} required />
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            <span>
              <b>Urgente</b>
              <span className="block text-xs text-slate-500">
                Solo per interruzioni del servizio o problemi di sicurezza: push anche a chi le ha spente e banner rosso.
              </span>
            </span>
          </label>
          <button type="submit" className="btn-primary" disabled={invia.isPending}>
            {invia.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Invia
          </button>
        </form>

        <div>
          <p className="label">Inviate di recente</p>
          {storico.isLoading ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : (storico.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna comunicazione inviata.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {(storico.data ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{a.titolo}</span>
                    <Badge tono="blu">{a.ambito === 'PIATTAFORMA_STAFF' ? 'Staff' : 'Tutti'}</Badge>
                    {a.urgente && <Badge tono="rosso">Urgente</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDataOra(a.creato_il)} · {a.n_destinatari} destinatari
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Durata leggibile a partire da un numero di minuti. */
function durata(minuti: number): string {
  if (minuti < 60) return `${minuti} minuti`
  const ore = Math.floor(minuti / 60)
  if (ore < 48) return `${ore} ore`
  return `${Math.floor(ore / 24)} giorni`
}

/** Traduce l'ultima risposta della funzione Edge in una diagnosi. */
function diagnosiHttp(r: NonNullable<StatoInvioNotifiche['ultima_risposta_http']>): { tono: 'verde' | 'rosso' | 'giallo'; testo: string } {
  const c = r.status_code
  if (r.timed_out) return { tono: 'giallo', testo: 'La funzione non ha risposto in tempo (timeout). Se capita spesso, la coda è troppo lunga o un servizio esterno è lento.' }
  if (c === 200) return { tono: 'verde', testo: 'La funzione Edge risponde correttamente.' }
  if (c === 401) return { tono: 'rosso', testo: 'La funzione risponde "Non autorizzato": il CRON_SECRET nel job pg_cron è diverso da quello impostato nei segreti della funzione.' }
  if (c === 404) return { tono: 'rosso', testo: 'Funzione non trovata: non è pubblicata oppure l\'indirizzo nel job pg_cron è sbagliato.' }
  if (c && c >= 500) return { tono: 'rosso', testo: 'La funzione va in errore all\'avvio o durante l\'invio: di solito mancano i segreti VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.' }
  return { tono: 'giallo', testo: c ? `Risposta inattesa (HTTP ${c}).` : 'Nessun codice di risposta: la chiamata non è partita (rete o indirizzo).' }
}

/** Salute del sistema di invio push/email (cron + funzione Edge). */
export function StatoInvio() {
  const toast = useToast()
  const q = useQuery({ queryKey: ['stato-invio'], queryFn: statoInvioNotifiche, refetchInterval: 60_000 })
  const scarta = useMutation({
    mutationFn: scartaNotificheScadute,
    onSuccess: (n) => {
      toast.successo(`${n} ${n === 1 ? 'notifica vecchia scartata' : 'notifiche vecchie scartate'}.`)
      void q.refetch()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })
  const d = q.data
  const minutiAttesa = d?.coda.piu_vecchia_in_attesa
    ? Math.floor((Date.now() - new Date(d.coda.piu_vecchia_in_attesa).getTime()) / 60_000)
    : 0
  const bloccato = minutiAttesa > 15
  const http = d?.ultima_risposta_http ?? null
  const diag = http ? diagnosiHttp(http) : null
  const run = d?.ultima_esecuzione_cron ?? null

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Activity className="h-4 w-4 text-brand-600" /> Stato dell'invio notifiche
        </h2>
        <button className="icon-btn" onClick={() => q.refetch()} aria-label="Aggiorna" title="Aggiorna">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {q.isLoading ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : q.isError || !d ? (
        <Alert tono="rosso">Impossibile leggere lo stato: le migrazioni 20 e 21 sono state eseguite?</Alert>
      ) : (
        <div className="space-y-3">
          {d.cron_programmato === false && (
            <Alert tono="rosso">
              Il job pianificato <code>invia-notifiche</code> non esiste: promemoria e push non partono. Segui il
              passo 7 di <code>NOTIFICHE_SETUP.md</code>.
            </Alert>
          )}
          {bloccato && (
            <Alert tono="giallo">
              La notifica più vecchia è in attesa da <b>{durata(minutiAttesa)}</b>: l'invio non sta funzionando.
              {diag ? ' Vedi la diagnosi qui sotto.' : ' Nessuna risposta recente della funzione Edge: il job potrebbe non chiamarla.'}
            </Alert>
          )}
          {d.coda.scadute_scartabili > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="text-slate-600">
                <b>{d.coda.scadute_scartabili}</b> push/email in coda da oltre 12 ore. Conviene scartarle prima di
                riattivare l'invio, per non mandare una raffica di notifiche vecchie (restano nel centro notifiche).
              </span>
              <button className="btn-secondary" onClick={() => scarta.mutate()} disabled={scarta.isPending}>
                {scarta.isPending && <Spinner className="h-4 w-4" />} Scarta le vecchie
              </button>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Dato etichetta="In attesa" valore={String(d.coda.in_attesa)} />
            <Dato etichetta="Inviate (24h)" valore={String(d.coda.inviate_24h)} />
            <Dato etichetta="Errori (24h)" valore={String(d.coda.errori_24h)} />
            <Dato etichetta="Dispositivi push" valore={String(d.coda.dispositivi)} />
            <Dato etichetta="Ultimo invio" valore={d.coda.ultimo_invio ? formatDataOra(d.coda.ultimo_invio) : 'mai'} />
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="label">Ultimo giro del job (pg_cron)</p>
              {run ? (
                <>
                  <p className="text-slate-700">
                    <Badge tono={run.status === 'succeeded' ? 'verde' : run.status === 'failed' ? 'rosso' : 'grigio'}>
                      {run.status}
                    </Badge>{' '}
                    {formatDataOra(run.start_time)}
                  </p>
                  {run.status === 'failed' && run.messaggio && (
                    <p className="mt-1 break-words text-xs text-red-700">{run.messaggio}</p>
                  )}
                </>
              ) : (
                <p className="text-slate-400">Nessuna esecuzione registrata.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="label">Ultima risposta della funzione Edge</p>
              {http && diag ? (
                <>
                  <p className="text-slate-700">
                    <Badge tono={diag.tono}>{http.status_code ?? '—'}</Badge> {formatDataOra(http.created)}
                  </p>
                  <p className={`mt-1 text-xs ${diag.tono === 'verde' ? 'text-green-700' : 'text-red-700'}`}>{diag.testo}</p>
                  {http.status_code !== 200 && http.messaggio && (
                    <p className="mt-1 break-words font-mono text-[11px] text-slate-500">{http.messaggio}</p>
                  )}
                </>
              ) : (
                <p className="text-slate-400">Nessuna risposta nelle ultime ore.</p>
              )}
            </div>
          </div>

          {d.ultimi_errori.length > 0 && (
            <div>
              <p className="label">Ultimi errori di invio</p>
              <ul className="space-y-1 text-xs text-slate-600">
                {d.ultimi_errori.map((e, i) => (
                  <li key={i} className="break-words">
                    <span className="text-slate-400">{formatDataOra(e.creato_il)}</span> · {e.canale} · {e.tipo} —{' '}
                    {e.errore}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Dato({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{etichetta}</dt>
      <dd className="font-semibold text-slate-800">{valore}</dd>
    </div>
  )
}
