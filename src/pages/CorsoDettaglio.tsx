import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, CalendarDays, Users, ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  getCorso,
  listaGiornate,
  listaIscrizioni,
  creaGiornata,
  eliminaGiornata,
  cambiaStatoCorso,
  iscriviAtleta,
  candidati,
  aggiornaStatoIscrizione,
  rimuoviIscrizione,
  listaPresenze,
  registraPresenza,
} from '@/api/corsi'
import { listaMembri } from '@/api/utenti'
import { messaggioErrore } from '@/api/errors'
import {
  Card,
  PageHeader,
  Badge,
  Modal,
  Field,
  Spinner,
  EmptyState,
  PageLoader,
} from '@/components/ui'
import { StatoCorsoBadge } from '@/pages/Dashboard'
import {
  STATO_CORSO_LABEL,
  STATO_ISCRIZIONE_LABEL,
  STATO_PRESENZA_LABEL,
  formatData,
  nomeCompleto,
} from '@/lib/format'
import type {
  Giornata,
  Iscrizione,
  StatoCorso,
  StatoIscrizione,
  StatoPresenza,
  Utente,
} from '@/lib/database.types'

const STATI_CORSO: StatoCorso[] = ['BOZZA', 'APERTO', 'IN_CORSO', 'CONCLUSO', 'ANNULLATO']
const STATI_ISCRIZIONE: StatoIscrizione[] = ['RICHIESTA', 'ATTIVA', 'SOSPESA', 'CONCLUSA', 'RITIRATA']

export default function CorsoDettaglio() {
  const { id = '' } = useParams()
  const { isStaff, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'giornate' | 'iscritti'>('giornate')

  const corso = useQuery({ queryKey: ['corso', id], queryFn: () => getCorso(id), enabled: !!id })
  const giornate = useQuery({ queryKey: ['giornate', id], queryFn: () => listaGiornate(id), enabled: !!id })
  const iscrizioni = useQuery({ queryKey: ['iscrizioni', id], queryFn: () => listaIscrizioni(id), enabled: !!id })
  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri, enabled: isStaff })

  const statoMut = useMutation({
    mutationFn: (stato: StatoCorso) => cambiaStatoCorso(id, stato),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corso', id] })
      qc.invalidateQueries({ queryKey: ['corsi'] })
      toast.successo('Stato del corso aggiornato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const mappaMembri = useMemo(() => {
    const m = new Map<string, Utente>()
    ;(membri.data ?? []).forEach((u) => m.set(u.id, u))
    return m
  }, [membri.data])

  if (corso.isLoading) return <PageLoader />
  if (!corso.data)
    return (
      <EmptyState titolo="Corso non trovato" descrizione="Potrebbe essere stato rimosso o non hai i permessi." />
    )

  const c = corso.data
  const mieIscr = (iscrizioni.data ?? []).find((i) => i.atleta_id === profilo?.id)
  const puoCandidarsi = !isStaff && c.stato === 'APERTO' && !mieIscr

  return (
    <div>
      <Link to="/corsi" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Torna ai corsi
      </Link>

      <PageHeader
        titolo={c.titolo}
        sottotitolo={c.descrizione ?? undefined}
        azioni={
          isStaff ? (
            <select
              className="input w-auto"
              value={c.stato}
              onChange={(e) => statoMut.mutate(e.target.value as StatoCorso)}
            >
              {STATI_CORSO.map((s) => (
                <option key={s} value={s}>
                  {STATO_CORSO_LABEL[s]}
                </option>
              ))}
            </select>
          ) : (
            <StatoCorsoBadge stato={c.stato} />
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" /> Inizio: {formatData(c.data_inizio)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {(iscrizioni.data ?? []).length} iscritti
          {c.posti_massimi ? ` / ${c.posti_massimi}` : ''}
        </span>
      </div>

      {puoCandidarsi && (
        <div className="mb-4">
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                await candidati(id, profilo!.id)
                qc.invalidateQueries({ queryKey: ['iscrizioni', id] })
                toast.successo('Candidatura inviata!')
              } catch (e) {
                toast.errore(messaggioErrore(e))
              }
            }}
          >
            Candidati a questo corso
          </button>
        </div>
      )}
      {mieIscr && !isStaff && (
        <div className="mb-4">
          <Badge tono="brand">La tua iscrizione: {STATO_ISCRIZIONE_LABEL[mieIscr.stato]}</Badge>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <TabBtn attivo={tab === 'giornate'} onClick={() => setTab('giornate')}>
          Giornate ({giornate.data?.length ?? 0})
        </TabBtn>
        {isStaff && (
          <TabBtn attivo={tab === 'iscritti'} onClick={() => setTab('iscritti')}>
            Iscritti ({iscrizioni.data?.length ?? 0})
          </TabBtn>
        )}
      </div>

      {tab === 'giornate' && (
        <SezioneGiornate
          corsoId={id}
          giornate={giornate.data ?? []}
          caricamento={giornate.isLoading}
          isStaff={isStaff}
          iscritti={(iscrizioni.data ?? []).filter((i) => i.stato === 'ATTIVA')}
          mappaMembri={mappaMembri}
        />
      )}

      {tab === 'iscritti' && isStaff && (
        <SezioneIscritti
          corsoId={id}
          iscrizioni={iscrizioni.data ?? []}
          mappaMembri={mappaMembri}
          atleti={(membri.data ?? []).filter((m) => m.ruolo === 'ATLETA' && m.attivo)}
        />
      )}
    </div>
  )
}

function TabBtn({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        attivo ? 'border-brand-600 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Giornate ----

function SezioneGiornate({
  corsoId,
  giornate,
  caricamento,
  isStaff,
  iscritti,
  mappaMembri,
}: {
  corsoId: string
  giornate: Giornata[]
  caricamento: boolean
  isStaff: boolean
  iscritti: Iscrizione[]
  mappaMembri: Map<string, Utente>
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [nuova, setNuova] = useState(false)
  const [presenzeDi, setPresenzeDi] = useState<Giornata | null>(null)

  const elimina = useMutation({
    mutationFn: (gid: string) => eliminaGiornata(gid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giornate', corsoId] })
      toast.successo('Giornata eliminata.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  if (caricamento) return <Spinner className="h-6 w-6 text-brand-600" />

  return (
    <div>
      {isStaff && (
        <div className="mb-3">
          <button className="btn-secondary" onClick={() => setNuova(true)}>
            <Plus className="h-4 w-4" /> Aggiungi giornata
          </button>
        </div>
      )}

      {giornate.length === 0 ? (
        <EmptyState titolo="Nessuna giornata" descrizione="Le giornate del corso appariranno qui." />
      ) : (
        <ol className="space-y-2">
          {giornate.map((g) => (
            <li key={g.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                        {g.ordine}
                      </span>
                      <p className="font-medium text-slate-800">{g.titolo}</p>
                    </div>
                    {g.obiettivi && <p className="mt-1 text-sm text-slate-500">{g.obiettivi}</p>}
                    {g.argomenti.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {g.argomenti.map((a, i) => (
                          <Badge key={i}>{a}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      {formatData(g.data)}
                      {g.luogo ? ` · ${g.luogo}` : ''}
                    </p>
                  </div>
                  {isStaff && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => setPresenzeDi(g)}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" /> Presenze
                      </button>
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => {
                          if (confirm('Eliminare la giornata?')) elimina.mutate(g.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Elimina
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {nuova && (
        <FormGiornata
          corsoId={corsoId}
          prossimoOrdine={giornate.length + 1}
          onClose={() => setNuova(false)}
          onFatto={() => {
            setNuova(false)
            qc.invalidateQueries({ queryKey: ['giornate', corsoId] })
          }}
        />
      )}

      {presenzeDi && (
        <ModalPresenze
          giornata={presenzeDi}
          iscritti={iscritti}
          mappaMembri={mappaMembri}
          onClose={() => setPresenzeDi(null)}
        />
      )}
    </div>
  )
}

function FormGiornata({
  corsoId,
  prossimoOrdine,
  onClose,
  onFatto,
}: {
  corsoId: string
  prossimoOrdine: number
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [ordine, setOrdine] = useState(prossimoOrdine)
  const [titolo, setTitolo] = useState('')
  const [obiettivi, setObiettivi] = useState('')
  const [argomenti, setArgomenti] = useState('')
  const [data, setData] = useState('')
  const [luogo, setLuogo] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      creaGiornata({
        corsoId,
        ordine,
        titolo,
        obiettivi,
        argomenti: argomenti
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        data: data || null,
        luogo: luogo || null,
      }),
    onSuccess: () => {
      toast.successo('Giornata aggiunta.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Modal titolo="Nuova giornata" aperto onClose={onClose}>
      <form onSubmit={invia} className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Field label="N.">
            <input
              className="input"
              type="number"
              min={1}
              value={ordine}
              onChange={(e) => setOrdine(Number(e.target.value))}
            />
          </Field>
          <div className="col-span-3">
            <Field label="Titolo" obbligatorio>
              <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
            </Field>
          </div>
        </div>
        <Field label="Obiettivi">
          <textarea className="input min-h-[70px]" value={obiettivi} onChange={(e) => setObiettivi(e.target.value)} />
        </Field>
        <Field label="Argomenti" hint="Separati da virgola">
          <input className="input" value={argomenti} onChange={(e) => setArgomenti(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Luogo">
            <input className="input" value={luogo} onChange={(e) => setLuogo(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Aggiungi
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalPresenze({
  giornata,
  iscritti,
  mappaMembri,
  onClose,
}: {
  giornata: Giornata
  iscritti: Iscrizione[]
  mappaMembri: Map<string, Utente>
  onClose: () => void
}) {
  const { profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const presenze = useQuery({
    queryKey: ['presenze', giornata.id],
    queryFn: () => listaPresenze(giornata.id),
  })

  const statoDi = (atletaId: string): StatoPresenza | undefined =>
    presenze.data?.find((p) => p.atleta_id === atletaId)?.stato

  const mut = useMutation({
    mutationFn: ({ atletaId, stato }: { atletaId: string; stato: StatoPresenza }) =>
      registraPresenza(giornata.id, atletaId, stato, profilo?.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presenze', giornata.id] }),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo={`Presenze — ${giornata.titolo}`} aperto onClose={onClose} larghezza="max-w-xl">
      {presenze.isLoading ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : iscritti.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun atleta con iscrizione attiva.</p>
      ) : (
        <ul className="space-y-2">
          {iscritti.map((i) => {
            const atleta = mappaMembri.get(i.atleta_id)
            const corrente = statoDi(i.atleta_id)
            return (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-700">{nomeCompleto(atleta)}</span>
                <div className="flex gap-1">
                  {(['PRESENTE', 'ASSENTE', 'GIUSTIFICATO'] as StatoPresenza[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => mut.mutate({ atletaId: i.atleta_id, stato: s })}
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        corrente === s
                          ? s === 'PRESENTE'
                            ? 'bg-green-600 text-white'
                            : s === 'ASSENTE'
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {STATO_PRESENZA_LABEL[s]}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

// ---- Iscritti ----

function SezioneIscritti({
  corsoId,
  iscrizioni,
  mappaMembri,
  atleti,
}: {
  corsoId: string
  iscrizioni: Iscrizione[]
  mappaMembri: Map<string, Utente>
  atleti: Utente[]
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [aggiungi, setAggiungi] = useState(false)
  const [atletaSel, setAtletaSel] = useState('')

  const invalida = () => qc.invalidateQueries({ queryKey: ['iscrizioni', corsoId] })

  const iscriviMut = useMutation({
    mutationFn: () => iscriviAtleta(corsoId, atletaSel, 'ATTIVA'),
    onSuccess: () => {
      invalida()
      setAggiungi(false)
      setAtletaSel('')
      toast.successo('Atleta iscritto.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const statoMut = useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: StatoIscrizione }) =>
      aggiornaStatoIscrizione(id, stato),
    onSuccess: invalida,
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const rimuoviMut = useMutation({
    mutationFn: (idIscr: string) => rimuoviIscrizione(idIscr),
    onSuccess: () => {
      invalida()
      toast.successo('Iscrizione rimossa.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const iscrittiIds = new Set(iscrizioni.map((i) => i.atleta_id))
  const disponibili = atleti.filter((a) => !iscrittiIds.has(a.id))

  return (
    <div>
      <div className="mb-3">
        <button className="btn-secondary" onClick={() => setAggiungi(true)}>
          <Plus className="h-4 w-4" /> Iscrivi atleta
        </button>
      </div>

      {iscrizioni.length === 0 ? (
        <EmptyState titolo="Nessun iscritto" descrizione="Iscrivi gli atleti o attendi le candidature." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {iscrizioni.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 p-3">
              <span className="flex-1 text-sm text-slate-700">
                {nomeCompleto(mappaMembri.get(i.atleta_id))}
              </span>
              <select
                className="input w-auto py-1 text-xs"
                value={i.stato}
                onChange={(e) => statoMut.mutate({ id: i.id, stato: e.target.value as StatoIscrizione })}
              >
                {STATI_ISCRIZIONE.map((s) => (
                  <option key={s} value={s}>
                    {STATO_ISCRIZIONE_LABEL[s]}
                  </option>
                ))}
              </select>
              <button
                className="btn-ghost px-2 py-1 text-xs text-red-600"
                onClick={() => {
                  if (confirm('Rimuovere l\'iscrizione?')) rimuoviMut.mutate(i.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Modal titolo="Iscrivi un atleta" aperto={aggiungi} onClose={() => setAggiungi(false)}>
        {disponibili.length === 0 ? (
          <p className="text-sm text-slate-400">Tutti gli atleti disponibili sono già iscritti.</p>
        ) : (
          <div className="space-y-4">
            <Field label="Atleta">
              <select className="input" value={atletaSel} onChange={(e) => setAtletaSel(e.target.value)}>
                <option value="">— Scegli —</option>
                {disponibili.map((a) => (
                  <option key={a.id} value={a.id}>
                    {nomeCompleto(a)}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="btn-primary w-full"
              disabled={!atletaSel || iscriviMut.isPending}
              onClick={() => iscriviMut.mutate()}
            >
              {iscriviMut.isPending && <Spinner className="h-4 w-4" />} Iscrivi
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
