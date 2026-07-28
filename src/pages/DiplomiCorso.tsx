import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Printer, Target } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getCorso,
  listaGiornate,
  listaIscrizioni,
  listaIstruttoriCorso,
  presenzeDelCorso,
} from '@/api/corsi'
import { listaMembri } from '@/api/utenti'
import { getLogoCsain } from '@/api/piattaforma'
import { PageLoader } from '@/components/ui'
import { formatData, nomeCompleto } from '@/lib/format'
import { scaricaDiplomiPdf } from '@/lib/pdf'
import type { Utente } from '@/lib/database.types'

export default function DiplomiCorso() {
  const { id = '' } = useParams()
  const { asd, isStaff } = useAuth()

  const corso = useQuery({ queryKey: ['corso', id], queryFn: () => getCorso(id), enabled: !!id })
  const giornate = useQuery({ queryKey: ['giornate', id], queryFn: () => listaGiornate(id), enabled: !!id })
  const iscrizioni = useQuery({ queryKey: ['iscrizioni', id], queryFn: () => listaIscrizioni(id), enabled: !!id })
  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri, enabled: isStaff })
  const istruttori = useQuery({ queryKey: ['istruttori-corso', id], queryFn: () => listaIstruttoriCorso(id), enabled: !!id })
  const { data: logoCsain } = useQuery({ queryKey: ['logo-csain'], queryFn: getLogoCsain })

  const giornateIds = (giornate.data ?? []).map((g) => g.id)
  const presenze = useQuery({
    queryKey: ['presenze-corso', id, giornateIds.length],
    queryFn: () => presenzeDelCorso(giornateIds),
    enabled: giornateIds.length > 0,
  })

  const mappaMembri = useMemo(() => {
    const m = new Map<string, Utente>()
    ;(membri.data ?? []).forEach((u) => m.set(u.id, u))
    return m
  }, [membri.data])

  if (!isStaff) return <Navigate to={`/corsi/${id}`} replace />
  if (corso.isLoading || giornate.isLoading || iscrizioni.isLoading || membri.isLoading) return <PageLoader />
  if (!corso.data) return <Navigate to="/corsi" replace />

  const c = corso.data
  const partecipanti = (iscrizioni.data ?? []).filter(
    (i) => i.stato === 'ATTIVA' || i.stato === 'CONCLUSA',
  )

  const giornatePresenti = (atletaId: string) =>
    (giornate.data ?? []).filter((g) =>
      (presenze.data ?? []).some(
        (p) => p.giornata_id === g.id && p.atleta_id === atletaId && p.stato === 'PRESENTE',
      ),
    )

  // Genera il PDF dei diplomi con i dati già caricati nella pagina.
  const scaricaPdf = () =>
    scaricaDiplomiPdf({
      corso: { titolo: c.titolo, data_inizio: c.data_inizio },
      asdNome: asd?.nome ?? 'ASD',
      asdLogo: asd?.logo ?? null,
      logoCsain: logoCsain ?? null,
      giornate: giornate.data ?? [],
      presenze: presenze.data ?? [],
      istruttori: (istruttori.data ?? []).map((it) => ({
        nomeCompleto: nomeCompleto(mappaMembri.get(it.istruttore_id)),
        firma: it.firma,
      })),
      atleti: partecipanti.map((iscr) => ({
        atletaId: iscr.atleta_id,
        nomeCompleto: nomeCompleto(mappaMembri.get(iscr.atleta_id)),
        esito: iscr.esito,
        valutazione: iscr.valutazione,
      })),
    })

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      {/* Barra strumenti — nascosta in stampa */}
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <Link to={`/corsi/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Torna al corso
        </Link>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={scaricaPdf} disabled={partecipanti.length === 0}>
            <Download className="h-4 w-4" /> Scarica PDF
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Stampa diplomi
          </button>
        </div>
      </div>

      {partecipanti.length === 0 && (
        <p className="mx-auto max-w-4xl px-4 text-center text-slate-500 print:hidden">
          Nessun atleta partecipante (iscrizione attiva) da diplomare.
        </p>
      )}

      <div className="mx-auto max-w-4xl space-y-6 px-4 print:max-w-none print:space-y-0 print:px-0">
        {partecipanti.map((iscr) => {
          const atleta = mappaMembri.get(iscr.atleta_id)
          const presenti = giornatePresenti(iscr.atleta_id)
          const argomenti = Array.from(
            new Set(
              (presenti.length > 0 ? presenti : giornate.data ?? []).flatMap((g) => g.argomenti ?? []),
            ),
          )
          return (
            <div
              key={iscr.id}
              style={{ breakAfter: 'page' }}
              className="relative overflow-hidden rounded-xl border-4 border-brand-700 bg-white p-10 shadow-sm print:rounded-none print:border-brand-700 print:shadow-none"
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
                <Target className="h-96 w-96" />
              </div>
              <div className="relative">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {asd?.logo ? (
                      <img src={asd.logo} alt="Logo" className="h-10 w-10 object-contain" />
                    ) : (
                      <Target className="h-8 w-8 text-brand-700" />
                    )}
                    <span className="text-lg font-bold text-slate-800">{asd?.nome ?? 'ASD'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Tiro con l'arco · CSAIN</span>
                    {logoCsain && <img src={logoCsain} alt="CSAIN" className="h-12 w-12 object-contain" />}
                  </div>
                </div>

                <p className="text-center text-sm uppercase tracking-[0.3em] text-brand-700">Diploma di partecipazione</p>
                <p className="mt-6 text-center text-slate-500">Si attesta che</p>
                <h1 className="mt-1 text-center text-4xl font-bold text-slate-900">{nomeCompleto(atleta)}</h1>
                <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
                  ha partecipato al corso <b>{c.titolo}</b>
                  {c.data_inizio ? ` con inizio il ${formatData(c.data_inizio)}` : ''}
                  {iscr.esito === 'SUPERATO' ? ', superandolo con esito positivo' : ''}.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Lezioni frequentate ({presenti.length}/{(giornate.data ?? []).length})
                    </p>
                    <ul className="space-y-0.5 text-sm text-slate-700">
                      {presenti.length === 0 ? (
                        <li className="text-slate-400">—</li>
                      ) : (
                        presenti.map((g) => (
                          <li key={g.id}>
                            {g.ordine}. {g.titolo}
                            {g.data ? ` (${formatData(g.data)})` : ''}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Argomenti trattati
                    </p>
                    <p className="text-sm text-slate-700">
                      {argomenti.length > 0 ? argomenti.join(', ') : '—'}
                    </p>
                    {iscr.valutazione && (
                      <p className="mt-3 text-sm text-slate-600">
                        <span className="font-medium">Valutazione:</span> {iscr.valutazione}
                      </p>
                    )}
                  </div>
                </div>

                {/* Firme istruttori */}
                <div className="mt-12 flex flex-wrap justify-around gap-8">
                  {(istruttori.data ?? []).length === 0 ? (
                    <div className="text-center">
                      <div className="h-12 w-48 border-b border-slate-400" />
                      <p className="mt-1 text-xs text-slate-500">L'istruttore</p>
                    </div>
                  ) : (
                    (istruttori.data ?? []).map((it) => {
                      const ist = mappaMembri.get(it.istruttore_id)
                      return (
                        <div key={it.id} className="text-center">
                          <div className="flex h-12 w-48 items-end justify-center border-b border-slate-400">
                            {it.firma && <img src={it.firma} alt="firma" className="max-h-12" />}
                          </div>
                          <p className="mt-1 text-xs font-medium text-slate-700">{nomeCompleto(ist)}</p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
