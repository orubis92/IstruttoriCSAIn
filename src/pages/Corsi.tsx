import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, GraduationCap, CalendarDays } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { listaCorsi } from '@/api/corsi'
import { Card, PageHeader, EmptyState, PageLoader } from '@/components/ui'
import { StatoCorsoBadge } from '@/pages/Dashboard'
import { formatData } from '@/lib/format'

export default function Corsi() {
  const { isStaff } = useAuth()
  const corsi = useQuery({ queryKey: ['corsi'], queryFn: listaCorsi })

  if (corsi.isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        titolo="Corsi"
        sottotitolo="Programmi di corso e giornate"
        azioni={
          isStaff && (
            <Link to="/corsi/nuovo" className="btn-primary">
              <Plus className="h-4 w-4" /> Nuovo corso
            </Link>
          )
        }
      />

      {(corsi.data ?? []).length === 0 ? (
        <EmptyState
          icona={<GraduationCap className="h-10 w-10" />}
          titolo="Nessun corso"
          descrizione={
            isStaff
              ? 'Crea il primo corso, in modalità guidata o manuale.'
              : 'Non ci sono ancora corsi disponibili.'
          }
          azione={
            isStaff && (
              <Link to="/corsi/nuovo" className="btn-primary">
                <Plus className="h-4 w-4" /> Nuovo corso
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(corsi.data ?? []).map((c) => (
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
