import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, GraduationCap, Users, Download, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  corsiPiattaforma,
  statisticheAsd,
  registraConsultazionePiattaforma,
} from '@/api/piattaforma'
import { scaricaCsv } from '@/lib/csv'
import { Card, PageHeader, Spinner, EmptyState, Alert, Badge } from '@/components/ui'
import { StatoCorsoBadge } from '@/pages/Dashboard'
import { STATO_CORSO_LABEL, formatData } from '@/lib/format'
import type { StatoCorso } from '@/lib/database.types'

export default function Piattaforma() {
  const { isProgrammatore } = useAuth()

  // Registra la consultazione (accesso di piattaforma tracciato) all'apertura.
  useEffect(() => {
    if (isProgrammatore) registraConsultazionePiattaforma().catch(() => {})
  }, [isProgrammatore])

  const asd = useQuery({ queryKey: ['piattaforma-asd'], queryFn: statisticheAsd, enabled: isProgrammatore })
  const corsi = useQuery({ queryKey: ['piattaforma-corsi'], queryFn: corsiPiattaforma, enabled: isProgrammatore })

  const [filtroAsd, setFiltroAsd] = useState<'TUTTE' | string>('TUTTE')
  const [filtroStato, setFiltroStato] = useState<'TUTTI' | StatoCorso>('TUTTI')
  const [cerca, setCerca] = useState('')

  const totali = useMemo(() => {
    const a = asd.data ?? []
    return {
      nAsd: a.length,
      corsiAttivi: a.reduce((s, r) => s + Number(r.n_corsi_attivi), 0),
      iscrizioni: a.reduce((s, r) => s + Number(r.n_iscrizioni_attive), 0),
      atleti: a.reduce((s, r) => s + Number(r.n_atleti), 0),
    }
  }, [asd.data])

  const maxCorsi = useMemo(
    () => Math.max(1, ...(asd.data ?? []).map((r) => Number(r.n_corsi_attivi))),
    [asd.data],
  )

  const corsiFiltrati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (corsi.data ?? []).filter((c) => {
      if (filtroAsd !== 'TUTTE' && c.asd_id !== filtroAsd) return false
      if (filtroStato !== 'TUTTI' && c.stato !== filtroStato) return false
      if (q && !c.titolo.toLowerCase().includes(q) && !c.asd_nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [corsi.data, filtroAsd, filtroStato, cerca])

  if (!isProgrammatore) return <Navigate to="/" replace />

  function esporta() {
    scaricaCsv('corsi-piattaforma', corsiFiltrati, [
      { intestazione: 'ASD', valore: (c) => c.asd_nome },
      { intestazione: 'Corso', valore: (c) => c.titolo },
      { intestazione: 'Stato', valore: (c) => STATO_CORSO_LABEL[c.stato] },
      { intestazione: 'Inizio', valore: (c) => formatData(c.data_inizio) },
      { intestazione: 'Fine', valore: (c) => formatData(c.data_fine) },
      { intestazione: 'Iscritti', valore: (c) => c.n_iscritti },
      { intestazione: 'Iscritti attivi', valore: (c) => c.n_iscritti_attivi },
      { intestazione: 'Posti', valore: (c) => c.posti_massimi ?? '' },
    ])
  }

  return (
    <div>
      <PageHeader titolo="Vista di piattaforma" sottotitolo="Corsi e statistiche di tutte le ASD" />

      <Alert tono="blu">
        Questa sezione mostra <b>solo dati aggregati e metadati dei corsi</b> (nessuna anagrafica
        degli atleti e nessun dato sanitario). Ogni consultazione viene registrata nel registro
        accessi.
      </Alert>

      {/* Riepilogo */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icona={<Building2 className="h-5 w-5" />} valore={totali.nAsd} etichetta="ASD" />
        <StatCard icona={<GraduationCap className="h-5 w-5" />} valore={totali.corsiAttivi} etichetta="Corsi attivi" />
        <StatCard icona={<GraduationCap className="h-5 w-5" />} valore={totali.iscrizioni} etichetta="Iscrizioni attive" />
        <StatCard icona={<Users className="h-5 w-5" />} valore={totali.atleti} etichetta="Atleti" />
      </div>

      {/* Grafico: corsi attivi per ASD */}
      <Card className="mt-4 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Corsi attivi per ASD</h2>
        {asd.isLoading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : (asd.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna ASD.</p>
        ) : (
          <ul className="space-y-2">
            {(asd.data ?? []).map((r) => (
              <li key={r.asd_id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-slate-700" title={r.asd_nome}>
                  {r.asd_nome}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <span
                    className="block h-full rounded bg-brand-600"
                    style={{ width: `${(Number(r.n_corsi_attivi) / maxCorsi) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-medium text-slate-700">
                  {r.n_corsi_attivi}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tabella aggregati per ASD */}
      <Card className="mt-4 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Dettaglio per ASD</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">ASD</th>
                <th className="py-2 px-3 text-right">Corsi attivi</th>
                <th className="py-2 px-3 text-right">Conclusi</th>
                <th className="py-2 px-3 text-right">Totali</th>
                <th className="py-2 px-3 text-right">Iscrizioni attive</th>
                <th className="py-2 px-3 text-right">Atleti</th>
                <th className="py-2 pl-3 text-right">Staff</th>
              </tr>
            </thead>
            <tbody>
              {(asd.data ?? []).map((r) => (
                <tr key={r.asd_id} className="border-b border-slate-50">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-800">{r.asd_nome}</span>
                    {!r.attiva && <Badge tono="grigio">sospesa</Badge>}
                  </td>
                  <td className="py-2 px-3 text-right">{r.n_corsi_attivi}</td>
                  <td className="py-2 px-3 text-right">{r.n_corsi_conclusi}</td>
                  <td className="py-2 px-3 text-right">{r.n_corsi_totali}</td>
                  <td className="py-2 px-3 text-right">{r.n_iscrizioni_attive}</td>
                  <td className="py-2 px-3 text-right">{r.n_atleti}</td>
                  <td className="py-2 pl-3 text-right">{r.n_staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Elenco corsi con filtri */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Corsi ({corsiFiltrati.length})</h2>
          <button className="btn-secondary" onClick={esporta} disabled={corsiFiltrati.length === 0}>
            <Download className="h-4 w-4" /> Esporta CSV
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Cerca per corso o ASD…"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={filtroAsd} onChange={(e) => setFiltroAsd(e.target.value)}>
            <option value="TUTTE">Tutte le ASD</option>
            {(asd.data ?? []).map((r) => (
              <option key={r.asd_id} value={r.asd_id}>
                {r.asd_nome}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value as 'TUTTI' | StatoCorso)}
          >
            <option value="TUTTI">Tutti gli stati</option>
            {(Object.keys(STATO_CORSO_LABEL) as StatoCorso[]).map((s) => (
              <option key={s} value={s}>
                {STATO_CORSO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {corsi.isLoading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : corsiFiltrati.length === 0 ? (
          <EmptyState titolo="Nessun corso" descrizione="Nessun corso corrisponde ai filtri." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Corso</th>
                  <th className="py-2 px-3">ASD</th>
                  <th className="py-2 px-3">Stato</th>
                  <th className="py-2 px-3">Inizio</th>
                  <th className="py-2 pl-3 text-right">Iscritti</th>
                </tr>
              </thead>
              <tbody>
                {corsiFiltrati.map((c) => (
                  <tr key={c.corso_id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-800">{c.titolo}</td>
                    <td className="py-2 px-3 text-slate-600">{c.asd_nome}</td>
                    <td className="py-2 px-3">
                      <StatoCorsoBadge stato={c.stato} />
                    </td>
                    <td className="py-2 px-3 text-slate-600">{formatData(c.data_inizio)}</td>
                    <td className="py-2 pl-3 text-right text-slate-700">
                      {c.n_iscritti_attivi}
                      {c.posti_massimi ? ` / ${c.posti_massimi}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({ icona, valore, etichetta }: { icona: ReactNode; valore: number; etichetta: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-brand-700">{icona}</div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valore}</p>
      <p className="text-xs text-slate-500">{etichetta}</p>
    </Card>
  )
}
