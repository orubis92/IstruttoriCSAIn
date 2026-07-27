import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, MapPin } from 'lucide-react'
import { listaGiornateTutte, listaCorsi } from '@/api/corsi'
import { Card, PageHeader, PageLoader, EmptyState } from '@/components/ui'
import type { Corso, Giornata } from '@/lib/database.types'

// Palette per distinguere i corsi nel calendario.
const COLORI = [
  { punto: 'bg-brand-500', chip: 'bg-brand-100 text-brand-800' },
  { punto: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800' },
  { punto: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800' },
  { punto: 'bg-rose-500', chip: 'bg-rose-100 text-rose-800' },
  { punto: 'bg-violet-500', chip: 'bg-violet-100 text-violet-800' },
  { punto: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800' },
]

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function Calendario() {
  const [cursore, setCursore] = useState(() => new Date())
  const [selezionato, setSelezionato] = useState<Date | null>(null)

  const giornate = useQuery({ queryKey: ['giornate-tutte'], queryFn: listaGiornateTutte })
  const corsi = useQuery({ queryKey: ['corsi'], queryFn: listaCorsi })

  // Mappa corso → dati + colore stabile
  const corsoInfo = useMemo(() => {
    const m = new Map<string, { corso: Corso; colore: (typeof COLORI)[number] }>()
    ;(corsi.data ?? []).forEach((c, i) => m.set(c.id, { corso: c, colore: COLORI[i % COLORI.length] }))
    return m
  }, [corsi.data])

  // Giornate raggruppate per data (yyyy-MM-dd)
  const perGiorno = useMemo(() => {
    const m = new Map<string, Giornata[]>()
    ;(giornate.data ?? []).forEach((g) => {
      if (!g.data) return
      const arr = m.get(g.data) ?? []
      arr.push(g)
      m.set(g.data, arr)
    })
    return m
  }, [giornate.data])

  const giorni = useMemo(() => {
    const inizio = startOfWeek(startOfMonth(cursore), { weekStartsOn: 1 })
    const fine = endOfWeek(endOfMonth(cursore), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: inizio, end: fine })
  }, [cursore])

  if (giornate.isLoading || corsi.isLoading) return <PageLoader />

  const giornateSelezionate = selezionato
    ? (perGiorno.get(format(selezionato, 'yyyy-MM-dd')) ?? [])
    : []

  const totaleNelMese = giorni
    .filter((d) => isSameMonth(d, cursore))
    .reduce((n, d) => n + (perGiorno.get(format(d, 'yyyy-MM-dd'))?.length ?? 0), 0)

  return (
    <div>
      <PageHeader
        titolo="Calendario"
        sottotitolo="Le giornate di tutti i corsi"
        azioni={
          <div className="flex items-center gap-1">
            <button className="btn-secondary px-2" onClick={() => setCursore(subMonths(cursore, 1))} aria-label="Mese precedente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-secondary" onClick={() => setCursore(new Date())}>
              Oggi
            </button>
            <button className="btn-secondary px-2" onClick={() => setCursore(addMonths(cursore, 1))} aria-label="Mese successivo">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-slate-800">
          {format(cursore, 'LLLL yyyy', { locale: it })}
        </h2>
        <span className="text-sm text-slate-400">{totaleNelMese} giornate questo mese</span>
      </div>

      <Card className="overflow-hidden">
        {/* intestazione giorni */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {GIORNI.map((g) => (
            <div key={g} className="py-2">
              {g}
            </div>
          ))}
        </div>
        {/* griglia */}
        <div className="grid grid-cols-7">
          {giorni.map((giorno) => {
            const chiave = format(giorno, 'yyyy-MM-dd')
            const items = perGiorno.get(chiave) ?? []
            const nelMese = isSameMonth(giorno, cursore)
            const oggi = isToday(giorno)
            const sel = selezionato && isSameDay(giorno, selezionato)
            return (
              <button
                key={chiave}
                onClick={() => setSelezionato(giorno)}
                className={`min-h-[84px] border-b border-r border-slate-100 p-1.5 text-left align-top last:border-r-0 ${
                  nelMese ? 'bg-white' : 'bg-slate-50/50'
                } ${sel ? 'ring-2 ring-inset ring-brand-400' : ''}`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      oggi ? 'bg-brand-600 font-semibold text-white' : nelMese ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    {format(giorno, 'd')}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((g) => {
                    const info = corsoInfo.get(g.corso_id)
                    return (
                      <Link
                        key={g.id}
                        to={`/corsi/${g.corso_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
                          info?.colore.chip ?? 'bg-slate-100 text-slate-700'
                        }`}
                        title={`${info?.corso.titolo ?? ''} — ${g.titolo}`}
                      >
                        {info?.corso.titolo ?? g.titolo}
                      </Link>
                    )
                  })}
                  {items.length > 3 && (
                    <span className="block px-1 text-[11px] text-slate-400">+{items.length - 3} altre</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* dettaglio giorno selezionato */}
      {selezionato && (
        <div className="mt-5">
          <h3 className="mb-2 font-semibold capitalize text-slate-800">
            {format(selezionato, 'EEEE d MMMM yyyy', { locale: it })}
          </h3>
          {giornateSelezionate.length === 0 ? (
            <EmptyState
              icona={<CalendarDays className="h-8 w-8" />}
              titolo="Nessuna giornata"
              descrizione="Non ci sono giornate di corso in questa data."
            />
          ) : (
            <div className="space-y-2">
              {giornateSelezionate.map((g) => {
                const info = corsoInfo.get(g.corso_id)
                return (
                  <Link key={g.id} to={`/corsi/${g.corso_id}`}>
                    <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
                      <span className={`h-8 w-1.5 shrink-0 rounded-full ${info?.colore.punto ?? 'bg-slate-300'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">
                          {info?.corso.titolo ?? 'Corso'} · Giornata {g.ordine}
                        </p>
                        <p className="truncate text-sm text-slate-500">{g.titolo}</p>
                      </div>
                      {g.luogo && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3.5 w-3.5" /> {g.luogo}
                        </span>
                      )}
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* legenda corsi */}
      {(corsi.data ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Legenda corsi</p>
          <div className="flex flex-wrap gap-2">
            {(corsi.data ?? []).map((c, i) => (
              <Link
                key={c.id}
                to={`/corsi/${c.id}`}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${COLORI[i % COLORI.length].punto}`} />
                {c.titolo}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
