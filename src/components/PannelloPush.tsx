import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, BellOff, CheckCircle2, AlertTriangle, Loader2, Smartphone } from 'lucide-react'
import {
  statoPushDispositivo,
  attivaPush,
  disattivaPush,
  notificaLocaleDiProva,
  type StatoPushDispositivo,
} from '@/api/push'
import { inviaNotificaProva, statoRigaCoda } from '@/api/notifiche'
import { messaggioErrore } from '@/api/errors'
import { useToast } from '@/components/Toast'
import { Alert, Badge, Spinner } from '@/components/ui'
import { formatDataOra } from '@/lib/format'

const ETICHETTA: Record<StatoPushDispositivo, { testo: string; tono: 'verde' | 'giallo' | 'rosso' | 'grigio' }> = {
  attivo: { testo: 'Attive su questo dispositivo', tono: 'verde' },
  non_attivo: { testo: 'Non attive su questo dispositivo', tono: 'grigio' },
  negato: { testo: 'Bloccate dal browser', tono: 'rosso' },
  non_supportato: { testo: 'Non supportate da questo browser', tono: 'giallo' },
  non_configurato: { testo: 'Non configurate sul server', tono: 'giallo' },
}

/** Stato delle push sul dispositivo corrente, attivazione e notifiche di prova. */
export function PannelloPush({ onCambio }: { onCambio?: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const stato = useQuery({ queryKey: ['push-dispositivo'], queryFn: statoPushDispositivo })
  const [lavoro, setLavoro] = useState(false)
  const [codaId, setCodaId] = useState<string | null>(null)
  const [inviataAlle, setInviataAlle] = useState<number | null>(null)

  // Segue la riga della notifica di prova finché la funzione di invio non la elabora.
  const riga = useQuery({
    queryKey: ['coda-prova', codaId],
    queryFn: () => statoRigaCoda(codaId!),
    enabled: !!codaId,
    refetchInterval: (q) => (q.state.data?.stato === 'IN_ATTESA' || !q.state.data ? 5_000 : false),
  })
  const inAttesaDaMinuti =
    inviataAlle && riga.data?.stato === 'IN_ATTESA' ? Math.floor((Date.now() - inviataAlle) / 60_000) : 0

  useEffect(() => {
    if (riga.data && riga.data.stato !== 'IN_ATTESA') void qc.invalidateQueries({ queryKey: ['notifiche'] })
  }, [riga.data, qc])

  async function esegui(fn: () => Promise<void>, ok: string) {
    setLavoro(true)
    try {
      await fn()
      toast.successo(ok)
    } catch (e) {
      toast.errore(messaggioErrore(e))
    } finally {
      setLavoro(false)
      await stato.refetch()
      onCambio?.()
    }
  }

  async function provaServer() {
    setLavoro(true)
    try {
      const r = await inviaNotificaProva()
      void qc.invalidateQueries({ queryKey: ['notifiche'] })
      if (r.dispositivi === 0) {
        toast.successo('Notifica di prova creata nel centro notifiche. Nessun dispositivo con le push attive.')
        setCodaId(null)
      } else {
        toast.successo(`Notifica di prova in coda per ${r.dispositivi} ${r.dispositivi === 1 ? 'dispositivo' : 'dispositivi'}.`)
        setCodaId(r.coda_id)
        setInviataAlle(Date.now())
      }
    } catch (e) {
      toast.errore(messaggioErrore(e))
    } finally {
      setLavoro(false)
    }
  }

  const s = stato.data
  const et = s ? ETICHETTA[s] : null

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Smartphone className="h-4 w-4 text-slate-400" /> Notifiche push
        </p>
        {stato.isLoading ? <Spinner className="h-4 w-4 text-brand-600" /> : et && <Badge tono={et.tono}>{et.testo}</Badge>}
      </div>

      {s === 'negato' && (
        <Alert tono="rosso">
          Le notifiche per questo sito sono bloccate. Sbloccale dalle impostazioni del browser (icona del
          lucchetto accanto all'indirizzo → Notifiche → Consenti), poi ricarica la pagina.
        </Alert>
      )}
      {s === 'non_supportato' && (
        <Alert tono="giallo">
          Questo browser non supporta le push. Su iPhone/iPad aggiungi prima l'app alla schermata Home
          (Condividi → Aggiungi alla schermata Home) e aprila da lì. Gli avvisi restano comunque visibili nel
          centro notifiche.
        </Alert>
      )}
      {s === 'non_configurato' && (
        <Alert tono="giallo">Manca la chiave pubblica VAPID nella build: le push non possono essere attivate.</Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {s === 'non_attivo' && (
          <button className="btn-primary" disabled={lavoro} onClick={() => esegui(attivaPush, 'Push attivate su questo dispositivo.')}>
            <BellRing className="h-4 w-4" /> Attiva su questo dispositivo
          </button>
        )}
        {s === 'attivo' && (
          <>
            <button className="btn-secondary" disabled={lavoro} onClick={() => esegui(notificaLocaleDiProva, 'Notifica locale mostrata.')}>
              Prova locale
            </button>
            <button className="btn-secondary" disabled={lavoro} onClick={provaServer}>
              Prova dal server
            </button>
            <button className="btn-ghost text-slate-500" disabled={lavoro} onClick={() => esegui(disattivaPush, 'Push disattivate su questo dispositivo.')}>
              <BellOff className="h-4 w-4" /> Disattiva qui
            </button>
          </>
        )}
      </div>

      {codaId && riga.data && (
        <div className="mt-3 text-sm">
          {riga.data.stato === 'IN_ATTESA' && (
            <p className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> In coda: l'invio avviene entro circa 5 minuti
              {inAttesaDaMinuti >= 7 && ' — sta impiegando più del previsto: il servizio di invio potrebbe essere fermo.'}
            </p>
          )}
          {riga.data.stato === 'INVIATA' && (
            <p className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Inviata dal server alle {formatDataOra(riga.data.inviata_il)}.
              Se non l'hai vista, controlla le notifiche del sistema.
            </p>
          )}
          {riga.data.stato === 'ERRORE' && (
            <p className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" /> Invio non riuscito: {riga.data.errore ?? 'errore sconosciuto'}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Le push vanno attivate su ogni dispositivo. Gli avvisi <b>urgenti</b> della tua ASD arrivano in push
        anche se hai disattivato le push ordinarie, purché il dispositivo sia attivo qui.
      </p>
    </div>
  )
}
