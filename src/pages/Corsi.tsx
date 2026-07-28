import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, GraduationCap, CalendarDays, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { listaCorsi } from '@/api/corsi'
import { Card, PageHeader, EmptyState, PageLoader } from '@/components/ui'
import { StatoCorsoBadge } from '@/pages/Dashboard'
import { formatData, STATO_CORSO_LABEL } from '@/lib/format'
import type { StatoCorso } from '@/lib/database.types'

const ATTIVI: StatoCorso[] = ['BOZZA', 'APERTO', 'IN_CORSO']
const STORICO: StatoCorso[] = ['CONCLUSO', 'ANNULLATO']

export default function Corsi() {
  const { isStaff } = useAuth()
  const [vista, setVista] = useState<'attivi' | 'storico'>('attivi')
  const [cerca, setCerca] = useState('')
  const [filtroStato, setFiltroStato] = useState<'TUTTI' | StatoCorso>('TUTTI')
  const corsi = useQuery({ queryKey: ['corsi'], queryFn: listaCorsi })

  const filtrati = useMemo(() => {
    const stati = vista === 'attivi' ? ATTIVI : STORICO
    const q = cerca.trim().toLowerCase()
    return (corsi.data ?? []).filter((c) => {
      if (!stati.includes(c.stato)) return false
      if (filtroStato !== 'TUTTI' && c.stato !== filtroStato) return false
      if (!q) return true
      return c.titolo.toLowerCase().includes(q)
    })
  }, [corsi.data, vista, cerca, filtroStato])

  if (corsi.isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        titolo="Corsi"
        sottotitolo="Programmi di corso, giornate e storico"
        azioni={
          isStaff && (
            <Link to="/corsi/nuovo" className="btn-primary">
              <Plus className="h-4 w-4" /> Nuovo corso
            </Link>
          )
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:w-72">
        <button
          onClick={() => setVista('attivi')}
          className={`flex-1 rounded-md py-1.5 font-medium ${
            vista === 'attivi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Attivi
        </button>
        <button
          onClick={() => setVista('storico')}
          className={`flex-1 rounded-md py-1.5 font-medium ${
            vista === 'storico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Storico
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per titolo del corso…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value as 'TUTTI' | StatoCorso)}
        >
          <option value="TUTTI">Tutti gli stati</option>
          <option value="BOZZA">{STATO_CORSO_LABEL.BOZZA}</option>
          <option value="APERTO">{STATO_CORSO_LABEL.APERTO}</option>
          <option value="IN_CORSO">{STATO_CORSO_LABEL.IN_CORSO}</option>
          <option value="CONCLUSO">{STATO_CORSO_LABEL.CONCLUSO}</option>
          <option value="ANNULLATO">{STATO_CORSO_LABEL.ANNULLATO}</option>
        </select>
      </div>

      {filtrati.length === 0 ? (
        <EmptyState
          icona={<GraduationCap className="h-10 w-10" />}
          titolo={vista === 'attivi' ? 'Nessun corso attivo' : 'Nessun corso nello storico'}
          descrizione={
            vista === 'attivi'
              ? isStaff
                ? 'Crea il primo corso, in modalità guidata o manuale.'
                : 'Non ci sono ancora corsi disponibili.'
              : 'Qui compariranno i corsi conclusi o annullati.'
          }
          azione={
            vista === 'attivi' &&
            isStaff && (
              <Link to="/corsi/nuovo" className="btn-primary">
                <Plus className="h-4 w-4" /> Nuovo corso
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrati.map((c) => (
            <Link key={c.id} to={`/corsi/${c.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{c.titolo}</h3>
                  <StatoCorsoBadge stato={c.stato} />
                </div>
                {c.descrizione && (
                  <p className="mb-3 line-clamp-2 text-sm text-slate-500">{c.descrizione}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  Inizio: {formatData(c.data_inizio)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
