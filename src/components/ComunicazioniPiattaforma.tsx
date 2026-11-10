import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Send, Activity, RefreshCw } from 'lucide-react'
import { inviaAvvisoPiattaforma, listaAvvisiPiattaforma, statoInvioNotifiche } from '@/api/notifiche'
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

/** Salute del sistema di invio push/email (cron + funzione Edge). */
export function StatoInvio() {
  const q = useQuery({ queryKey: ['stato-invio'], queryFn: statoInvioNotifiche, refetchInterval: 60_000 })
  const d = q.data
  const minutiAttesa = d?.coda.piu_vecchia_in_attesa
    ? Math.floor((Date.now() - new Date(d.coda.piu_vecchia_in_attesa).getTime()) / 60_000)
    : 0
  const bloccato = minutiAttesa > 15

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
        <Alert tono="rosso">Impossibile leggere lo stato: la migrazione 20 è stata eseguita?</Alert>
      ) : (
        <>
          {d.cron_programmato === false && (
            <div className="mb-3">
              <Alert tono="rosso">
                Il job pianificato <code>invia-notifiche</code> non esiste: promemoria e push non partono. Esegui la
                il passo 7 di <code>NOTIFICHE_SETUP.md</code>.
              </Alert>
            </div>
          )}
          {bloccato && (
            <div className="mb-3">
              <Alert tono="giallo">
                Ci sono notifiche in attesa da {minutiAttesa} minuti: la funzione Edge <code>invia-notifiche</code>{' '}
                potrebbe non essere pubblicata o i segreti (VAPID, CRON_SECRET) non essere impostati.
              </Alert>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Dato etichetta="In attesa" valore={String(d.coda.in_attesa)} />
            <Dato etichetta="Inviate (24h)" valore={String(d.coda.inviate_24h)} />
            <Dato etichetta="Errori (24h)" valore={String(d.coda.errori_24h)} />
            <Dato etichetta="Dispositivi push" valore={String(d.coda.dispositivi)} />
            <Dato etichetta="Ultimo invio" valore={d.coda.ultimo_invio ? formatDataOra(d.coda.ultimo_invio) : '—'} />
          </dl>
          {d.ultimi_errori.length > 0 && (
            <div className="mt-4">
              <p className="label">Ultimi errori</p>
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
        </>
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
