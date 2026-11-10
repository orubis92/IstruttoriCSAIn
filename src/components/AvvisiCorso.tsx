import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Send } from 'lucide-react'
import { inviaAvvisoCorso, listaAvvisiCorso } from '@/api/notifiche'
import { messaggioErrore } from '@/api/errors'
import { useToast } from '@/components/Toast'
import { Card, Field, Spinner, Badge, EmptyState, Alert } from '@/components/ui'
import { formatDataOra } from '@/lib/format'

/** Avvisi dello staff agli atleti iscritti al corso (tab "Avvisi"). */
export function AvvisiCorso({ corsoId, nIscritti }: { corsoId: string; nIscritti: number }) {
  const toast = useToast()
  const qc = useQueryClient()
  const storico = useQuery({ queryKey: ['avvisi-corso', corsoId], queryFn: () => listaAvvisiCorso(corsoId) })

  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [urgente, setUrgente] = useState(false)

  const invia = useMutation({
    mutationFn: () => inviaAvvisoCorso(corsoId, titolo.trim(), testo.trim(), urgente),
    onSuccess: (n) => {
      toast.successo(n === 0 ? 'Avviso salvato, ma nessun iscritto da avvisare.' : `Avviso inviato a ${n} ${n === 1 ? 'iscritto' : 'iscritti'}.`)
      setTitolo('')
      setTesto('')
      setUrgente(false)
      void qc.invalidateQueries({ queryKey: ['avvisi-corso', corsoId] })
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invio(e: FormEvent) {
    e.preventDefault()
    if (!titolo.trim() || !testo.trim()) return
    const msg = urgente
      ? `Inviare un avviso URGENTE a ${nIscritti} iscritti? Arriverà in push anche a chi ha disattivato le push ordinarie.`
      : `Inviare l'avviso a ${nIscritti} iscritti?`
    if (confirm(msg)) invia.mutate()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-2">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <Megaphone className="h-4 w-4 text-brand-600" /> Nuovo avviso
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Arriva nel centro notifiche di tutti gli iscritti (attivi e in attesa) e, a chi le ha attivate, come push.
        </p>
        <form onSubmit={invio} className="space-y-3">
          <Field label="Titolo" obbligatorio>
            <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={120} required placeholder="Es. Lezione spostata" />
          </Field>
          <Field label="Messaggio" obbligatorio>
            <textarea className="input min-h-[110px]" value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={1000} required placeholder="Es. Sabato ci vediamo alle 15:00 invece che alle 10:00." />
          </Field>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            <span>
              <b>Urgente</b>
              <span className="block text-xs text-slate-500">
                Push anche a chi ha spento quelle ordinarie, notifica che resta a schermo e banner rosso nell'app
                finché non viene letta. Da usare solo per cambi dell'ultimo minuto (lezione annullata, campo chiuso…).
              </span>
            </span>
          </label>
          {urgente && <Alert tono="giallo">Gli avvisi urgenti non arrivano via email a chi non l'ha scelta.</Alert>}
          <button type="submit" className="btn-primary" disabled={invia.isPending || nIscritti === 0}>
            {invia.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Invia a {nIscritti}{' '}
            {nIscritti === 1 ? 'iscritto' : 'iscritti'}
          </button>
        </form>
      </Card>

      <div className="lg:col-span-3">
        <h2 className="mb-2 font-semibold text-slate-900">Avvisi inviati</h2>
        {storico.isLoading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : (storico.data ?? []).length === 0 ? (
          <EmptyState titolo="Nessun avviso inviato" descrizione="Gli avvisi inviati agli iscritti compariranno qui." />
        ) : (
          <Card className="divide-y divide-slate-100">
            {(storico.data ?? []).map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{a.titolo}</span>
                  {a.urgente && <Badge tono="rosso">Urgente</Badge>}
                </div>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-600">{a.testo}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDataOra(a.creato_il)} · {a.mittente_nome ?? '—'} · {a.n_destinatari}{' '}
                  {a.n_destinatari === 1 ? 'destinatario' : 'destinatari'}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
