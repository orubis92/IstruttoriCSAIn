import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Download } from 'lucide-react'
import { scaricaCsv } from '@/lib/csv'
import { useAuth } from '@/context/AuthContext'
import { listaAccessi } from '@/api/audit'
import { Card, PageHeader, Badge, Spinner, EmptyState } from '@/components/ui'
import { formatDataOra } from '@/lib/format'
import type { AccessoAudit } from '@/lib/database.types'

const AZIONE_LABEL: Record<AccessoAudit['azione'], string> = {
  LETTURA: 'Lettura',
  CREAZIONE: 'Creazione',
  MODIFICA: 'Modifica',
  CANCELLAZIONE: 'Cancellazione',
}

function AzioneBadge({ azione }: { azione: AccessoAudit['azione'] }) {
  const tono =
    azione === 'CREAZIONE'
      ? 'verde'
      : azione === 'MODIFICA'
        ? 'giallo'
        : azione === 'CANCELLAZIONE'
          ? 'rosso'
          : 'grigio'
  return <Badge tono={tono}>{AZIONE_LABEL[azione]}</Badge>
}

export default function Registro() {
  const { isAdmin, isProgrammatore } = useAuth()
  const [cerca, setCerca] = useState('')

  const accessi = useQuery({ queryKey: ['audit-accessi'], queryFn: () => listaAccessi() })

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (accessi.data ?? []).filter((a) => {
      if (!q) return true
      return (
        (a.attore_nome ?? '').toLowerCase().includes(q) ||
        (a.atleta_nome ?? '').toLowerCase().includes(q)
      )
    })
  }, [accessi.data, cerca])

  function esporta() {
    scaricaCsv('registro-accessi', filtrati, [
      { intestazione: 'Data e ora', valore: (a) => formatDataOra(a.creato_il) },
      { intestazione: 'Chi ha agito', valore: (a) => a.attore_nome ?? '' },
      { intestazione: 'Azione', valore: (a) => AZIONE_LABEL[a.azione] },
      { intestazione: 'Atleta interessato', valore: (a) => a.atleta_nome ?? '' },
      { intestazione: 'Tipo oggetto', valore: (a) => a.oggetto_tipo },
    ])
  }

  if (!isAdmin && !isProgrammatore) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader
        titolo="Registro accessi"
        sottotitolo="Traccia gli accessi ai dati sanitari degli atleti (certificati medici), come previsto dall'art. 9 del GDPR."
        azioni={
          <button className="btn-secondary" onClick={esporta} disabled={filtrati.length === 0}>
            <Download className="h-4 w-4" /> Esporta CSV
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per chi ha agito o atleta interessato…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
          />
        </div>
      </div>

      {accessi.isLoading ? (
        <Spinner className="h-6 w-6 text-brand-600" />
      ) : filtrati.length === 0 ? (
        <EmptyState
          titolo="Nessun accesso registrato"
          descrizione="Qui compariranno gli accessi ai certificati medici degli atleti."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {filtrati.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">
                  {a.attore_nome ?? 'Utente sconosciuto'}
                  {a.atleta_nome && (
                    <span className="font-normal text-slate-500"> → {a.atleta_nome}</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {formatDataOra(a.creato_il)} · {a.oggetto_tipo}
                </p>
              </div>
              <AzioneBadge azione={a.azione} />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
