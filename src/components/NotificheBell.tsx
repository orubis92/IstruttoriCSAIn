import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { Bell, MessageCircle, CalendarClock, Megaphone } from 'lucide-react'
import { messaggiNonLetti } from '@/api/chat'
import { listaGiornateTutte, listaCorsi } from '@/api/corsi'
import { formatData, formatDataOra } from '@/lib/format'
import { useNotifiche, CHIAVE_NOTIFICHE } from '@/hooks/useNotifiche'
import { segnaLetta } from '@/api/notifiche'
import type { Notifica } from '@/lib/database.types'

export function NotificheBell() {
  const [aperto, setAperto] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const casella = useNotifiche()

  const nonLetti = useQuery({
    queryKey: ['non-letti'],
    queryFn: messaggiNonLetti,
    refetchInterval: 20_000,
  })
  const giornate = useQuery({ queryKey: ['giornate-tutte'], queryFn: listaGiornateTutte })
  const corsi = useQuery({ queryKey: ['corsi'], queryFn: listaCorsi })

  const totaleNonLetti = (nonLetti.data ?? []).reduce((n, r) => n + Number(r.non_letti), 0)

  const corsoTitolo = useMemo(() => {
    const m = new Map<string, string>()
    ;(corsi.data ?? []).forEach((c) => m.set(c.id, c.titolo))
    return m
  }, [corsi.data])

  // Prossime lezioni nei prossimi 7 giorni
  const prossime = useMemo(() => {
    const oggi = format(new Date(), 'yyyy-MM-dd')
    const limite = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    return (giornate.data ?? [])
      .filter((g) => g.data && g.data >= oggi && g.data <= limite)
      .sort((a, b) => (a.data! < b.data! ? -1 : 1))
      .slice(0, 6)
  }, [giornate.data])

  const conta = totaleNonLetti
  const nonLetteCasella = casella.nonLette.length
  const totale = conta + nonLetteCasella
  const puntino = totale > 0 || prossime.length > 0
  const recenti = casella.tutte.slice(0, 5)

  async function apriNotifica(n: Notifica) {
    setAperto(false)
    if (!n.letta_il) {
      await segnaLetta(n.id).catch(() => {})
      void qc.invalidateQueries({ queryKey: CHIAVE_NOTIFICHE })
    }
    navigate(n.url && n.url !== '/notifiche' ? n.url : '/notifiche')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAperto((v) => !v)}
        className="icon-btn relative"
        aria-label="Notifiche"
        title="Notifiche"
      >
        <Bell className="h-5 w-5" />
        {puntino && (
          <span className="absolute right-1.5 top-1.5 flex min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {totale > 0 ? (totale > 9 ? '9+' : totale) : ''}
          </span>
        )}
      </button>

      {aperto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAperto(false)} />
          {/* Su telefono il pannello è fissato a tutta larghezza (con margini),
              così non esce mai dallo schermo; da tablet/desktop torna un menù
              ancorato al bordo destro sotto la campanella. */}
          <div className="fixed inset-x-2 top-16 z-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-800">Notifiche</p>
              <Link
                to="/notifiche"
                onClick={() => setAperto(false)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Vedi tutte
              </Link>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {/* Avvisi, promemoria, certificati */}
              <div className="px-4 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Megaphone className="h-3.5 w-3.5" /> Avvisi e promemoria
                  {nonLetteCasella > 0 && (
                    <span className="ml-auto rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-800">
                      {nonLetteCasella} nuove
                    </span>
                  )}
                </p>
                {recenti.length === 0 ? (
                  <p className="text-sm text-slate-400">Nessun avviso.</p>
                ) : (
                  <ul className="space-y-1">
                    {recenti.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => apriNotifica(n)}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            n.letta_il ? '' : n.urgente ? 'bg-red-50' : 'bg-brand-50/60'
                          }`}
                        >
                          <span className={`block truncate ${n.letta_il ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>
                            {n.urgente && <span className="text-red-600">Urgente · </span>}
                            {n.titolo}
                          </span>
                          <span className="block text-xs text-slate-400">{formatDataOra(n.creato_il)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Messaggi */}
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <MessageCircle className="h-3.5 w-3.5" /> Chat
                </p>
                {conta > 0 ? (
                  <Link
                    to="/chat"
                    onClick={() => setAperto(false)}
                    className="block rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 hover:bg-brand-100"
                  >
                    Hai <b>{conta}</b> {conta === 1 ? 'messaggio non letto' : 'messaggi non letti'} → apri la chat
                  </Link>
                ) : (
                  <p className="text-sm text-slate-400">Nessun messaggio non letto.</p>
                )}
              </div>

              {/* Prossime lezioni */}
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <CalendarClock className="h-3.5 w-3.5" /> Prossime lezioni
                </p>
                {prossime.length === 0 ? (
                  <p className="text-sm text-slate-400">Nessuna lezione nei prossimi 7 giorni.</p>
                ) : (
                  <ul className="space-y-1">
                    {prossime.map((g) => (
                      <li key={g.id}>
                        <Link
                          to={`/corsi/${g.corso_id}`}
                          onClick={() => setAperto(false)}
                          className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-800">
                            {corsoTitolo.get(g.corso_id) ?? 'Corso'}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {g.titolo} · {formatData(g.data)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
