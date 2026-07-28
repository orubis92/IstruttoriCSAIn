import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { Bell, MessageCircle, CalendarClock } from 'lucide-react'
import { messaggiNonLetti } from '@/api/chat'
import { listaGiornateTutte, listaCorsi } from '@/api/corsi'
import { formatData } from '@/lib/format'

export function NotificheBell() {
  const [aperto, setAperto] = useState(false)

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
  const puntino = conta > 0 || prossime.length > 0

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
            {conta > 0 ? (conta > 9 ? '9+' : conta) : ''}
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
            <div className="border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-800">Notifiche</p>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {/* Messaggi */}
              <div className="px-4 py-3">
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
