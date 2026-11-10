import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Megaphone, CalendarClock, HeartPulse, FlaskConical, Trash2, CheckCheck, Settings } from 'lucide-react'
import { useNotifiche, CHIAVE_NOTIFICHE } from '@/hooks/useNotifiche'
import { segnaLetta, segnaTutteLette, eliminaNotifica, eliminaNotificheLette } from '@/api/notifiche'
import { messaggioErrore } from '@/api/errors'
import { useToast } from '@/components/Toast'
import { Card, PageHeader, EmptyState, PageLoader, Badge } from '@/components/ui'
import { formatDataOra } from '@/lib/format'
import type { Notifica, TipoNotifica } from '@/lib/database.types'

const ICONA: Record<TipoNotifica, typeof Bell> = {
  AVVISO: Megaphone,
  PROMEMORIA: CalendarClock,
  CERTIFICATO: HeartPulse,
  TEST: FlaskConical,
}
const TIPO_LABEL: Record<TipoNotifica, string> = {
  AVVISO: 'Avviso',
  PROMEMORIA: 'Promemoria',
  CERTIFICATO: 'Certificato',
  TEST: 'Prova',
}

export default function Notifiche() {
  const { tutte, nonLette, isLoading } = useNotifiche()
  const [filtro, setFiltro] = useState<'TUTTE' | 'NON_LETTE'>('TUTTE')
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const elenco = useMemo(() => (filtro === 'TUTTE' ? tutte : nonLette), [filtro, tutte, nonLette])
  const aggiorna = () => qc.invalidateQueries({ queryKey: CHIAVE_NOTIFICHE })

  const tutteLette = useMutation({ mutationFn: segnaTutteLette, onSuccess: aggiorna, onError: (e) => toast.errore(messaggioErrore(e)) })
  const pulisci = useMutation({
    mutationFn: eliminaNotificheLette,
    onSuccess: () => {
      void aggiorna()
      toast.successo('Notifiche lette eliminate.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })
  const elimina = useMutation({ mutationFn: eliminaNotifica, onSuccess: aggiorna, onError: (e) => toast.errore(messaggioErrore(e)) })

  async function apri(n: Notifica) {
    if (!n.letta_il) {
      try {
        await segnaLetta(n.id)
        void aggiorna()
      } catch {
        /* non bloccare la navigazione */
      }
    }
    if (n.url && n.url !== '/notifiche') navigate(n.url)
  }

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        titolo="Notifiche"
        sottotitolo={nonLette.length ? `${nonLette.length} da leggere` : 'Tutto letto'}
        azioni={
          <>
            {nonLette.length > 0 && (
              <button className="btn-secondary" onClick={() => tutteLette.mutate()} disabled={tutteLette.isPending}>
                <CheckCheck className="h-4 w-4" /> Segna tutte come lette
              </button>
            )}
            <Link to="/profilo" className="btn-ghost">
              <Settings className="h-4 w-4" /> Preferenze
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {(['TUTTE', 'NON_LETTE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-md px-3 py-1.5 font-medium ${filtro === f ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {f === 'TUTTE' ? `Tutte (${tutte.length})` : `Da leggere (${nonLette.length})`}
            </button>
          ))}
        </div>
        {tutte.length > nonLette.length && (
          <button
            className="btn-ghost text-sm text-slate-500"
            onClick={() => {
              if (confirm('Eliminare tutte le notifiche già lette?')) pulisci.mutate()
            }}
            disabled={pulisci.isPending}
          >
            <Trash2 className="h-4 w-4" /> Elimina le lette
          </button>
        )}
      </div>

      {elenco.length === 0 ? (
        <EmptyState
          icona={<Bell className="h-10 w-10" />}
          titolo={filtro === 'TUTTE' ? 'Nessuna notifica' : 'Nessuna notifica da leggere'}
          descrizione="Qui trovi gli avvisi della tua ASD, i promemoria delle lezioni e le scadenze del certificato medico."
        />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {elenco.map((n) => {
            const Icona = ICONA[n.tipo] ?? Bell
            return (
              <div
                key={n.id}
                className={`flex gap-3 px-4 py-3 ${n.letta_il ? '' : n.urgente ? 'bg-red-50/60' : 'bg-brand-50/40'}`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    n.urgente ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icona className="h-4 w-4" />
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => apri(n)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${n.letta_il ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>
                      {n.titolo}
                    </span>
                    {n.urgente && <Badge tono="rosso">Urgente</Badge>}
                    {!n.letta_il && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Da leggere" />}
                  </div>
                  {n.corpo && <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-600">{n.corpo}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {TIPO_LABEL[n.tipo] ?? n.tipo} · {formatDataOra(n.creato_il)}
                  </p>
                </button>
                <button
                  className="icon-btn shrink-0 self-start text-slate-400 hover:text-red-600"
                  title="Elimina"
                  aria-label="Elimina notifica"
                  onClick={() => elimina.mutate(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
