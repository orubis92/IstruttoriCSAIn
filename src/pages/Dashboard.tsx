import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, FileText, Users, ClipboardList, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { listaCorsi } from '@/api/corsi'
import { listaDocumenti } from '@/api/documenti'
import { listaMembri } from '@/api/utenti'
import { Card, PageHeader, Badge, PageLoader } from '@/components/ui'
import { RUOLO_LABEL, STATO_CORSO_LABEL, formatData, nomeCompleto } from '@/lib/format'

export default function Dashboard() {
  const { profilo, asd, ruolo, isStaff } = useAuth()

  const corsi = useQuery({ queryKey: ['corsi'], queryFn: listaCorsi })
  const documenti = useQuery({ queryKey: ['documenti'], queryFn: listaDocumenti })
  const membri = useQuery({
    queryKey: ['membri'],
    queryFn: listaMembri,
    enabled: isStaff,
  })

  if (corsi.isLoading) return <PageLoader />

  const corsiAttivi = (corsi.data ?? []).filter((c) => c.stato === 'IN_CORSO' || c.stato === 'APERTO')

  return (
    <div>
      <PageHeader
        titolo={`Ciao, ${profilo?.nome ?? ''}`}
        sottotitolo={
          asd ? `${asd.nome} · ${ruolo ? RUOLO_LABEL[ruolo] : ''}` : 'Area piattaforma'
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icona={<GraduationCap className="h-5 w-5" />}
          valore={corsiAttivi.length}
          etichetta="Corsi attivi"
          to="/corsi"
        />
        <StatCard
          icona={<FileText className="h-5 w-5" />}
          valore={documenti.data?.length ?? 0}
          etichetta="Documenti"
          to="/documenti"
        />
        {isStaff && (
          <StatCard
            icona={<Users className="h-5 w-5" />}
            valore={membri.data?.length ?? 0}
            etichetta="Membri"
            to="/membri"
          />
        )}
        <StatCard
          icona={<ClipboardList className="h-5 w-5" />}
          valore={(corsi.data ?? []).length}
          etichetta="Corsi totali"
          to="/corsi"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Corsi recenti</h2>
            <Link to="/corsi" className="text-sm text-brand-700 hover:underline">
              Tutti
            </Link>
          </div>
          {(corsi.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nessun corso ancora.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(corsi.data ?? []).slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/corsi/${c.id}`}
                    className="flex items-center justify-between py-3 hover:opacity-80"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{c.titolo}</p>
                      <p className="text-xs text-slate-400">
                        Inizio: {formatData(c.data_inizio)}
                      </p>
                    </div>
                    <StatoCorsoBadge stato={c.stato} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isStaff && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Ultimi membri</h2>
              <Link to="/membri" className="text-sm text-brand-700 hover:underline">
                Tutti
              </Link>
            </div>
            {(membri.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nessun membro.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(membri.data ?? []).slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-800">{nomeCompleto(m)}</span>
                    <Badge tono={m.ruolo === 'ATLETA' ? 'grigio' : 'brand'}>
                      {RUOLO_LABEL[m.ruolo]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icona,
  valore,
  etichetta,
  to,
}: {
  icona: ReactNode
  valore: number
  etichetta: string
  to: string
}) {
  return (
    <Link to={to} className="card group p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 text-brand-700">{icona}</div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valore}</p>
      <p className="flex items-center gap-1 text-xs text-slate-500">
        {etichetta}
        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
    </Link>
  )
}

export function StatoCorsoBadge({ stato }: { stato: keyof typeof STATO_CORSO_LABEL }) {
  const tono =
    stato === 'IN_CORSO'
      ? 'verde'
      : stato === 'APERTO'
        ? 'blu'
        : stato === 'CONCLUSO'
          ? 'grigio'
          : stato === 'ANNULLATO'
            ? 'rosso'
            : 'giallo'
  return <Badge tono={tono}>{STATO_CORSO_LABEL[stato]}</Badge>
}
