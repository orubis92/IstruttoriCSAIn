import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarDays,
  Users,
  ClipboardCheck,
  Award,
  Pencil,
  StickyNote,
  MessageSquare,
  Printer,
  GraduationCap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  getCorso,
  listaGiornate,
  listaIscrizioni,
  creaGiornata,
  aggiornaGiornata,
  eliminaGiornata,
  cambiaStatoCorso,
  iscriviAtleta,
  candidati,
  aggiornaStatoIscrizione,
  rimuoviIscrizione,
  listaPresenze,
  registraPresenza,
  valutaIscrizione,
  listaIstruttoriCorso,
  aggiungiIstruttoreCorso,
  aggiornaFirmaIstruttore,
  rimuoviIstruttoreCorso,
} from '@/api/corsi'
import { listaMembri } from '@/api/utenti'
import { proposteDelCorso, creaProposta, ritiraProposta } from '@/api/proposte'
import { commentiCorso, creaCommento, eliminaCommento } from '@/api/commenti'
import { messaggioErrore } from '@/api/errors'
import { SignaturePad } from '@/components/SignaturePad'
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
  Corso,
  Giornata,
  Iscrizione,
  EsitoCorso,
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
  const [tab, setTab] = useState<'giornate' | 'iscritti' | 'commenti' | 'diplomi'>('giornate')

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

      {isStaff && <ProponiStandard corso={c} giornate={giornate.data ?? []} />}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        <TabBtn attivo={tab === 'giornate'} onClick={() => setTab('giornate')}>
          Giornate ({giornate.data?.length ?? 0})
        </TabBtn>
        {isStaff && (
          <TabBtn attivo={tab === 'iscritti'} onClick={() => setTab('iscritti')}>
            Iscritti ({iscrizioni.data?.length ?? 0})
          </TabBtn>
        )}
        <TabBtn attivo={tab === 'commenti'} onClick={() => setTab('commenti')}>
          Commenti
        </TabBtn>
        {isStaff && (
          <TabBtn attivo={tab === 'diplomi'} onClick={() => setTab('diplomi')}>
            Diplomi
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

      {tab === 'commenti' && (
        <SezioneCommenti corso={c} giornate={giornate.data ?? []} mappaMembri={mappaMembri} />
      )}

      {tab === 'diplomi' && isStaff && (
        <SezioneDiplomi
          corso={c}
          istruttoriDisponibili={(membri.data ?? []).filter(
            (m) => (m.ruolo === 'ISTRUTTORE' || m.ruolo === 'AMMINISTRATORE_ASD') && m.attivo,
          )}
          mappaMembri={mappaMembri}
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
      className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
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
  const [modifica, setModifica] = useState<Giornata | null>(null)

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
                    {g.note && (
                      <p className="mt-2 flex items-start gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {g.note}
                      </p>
                    )}
                  </div>
                  {isStaff && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setModifica(g)}>
                        <Pencil className="h-3.5 w-3.5" /> Modifica
                      </button>
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

      {modifica && (
        <FormModificaGiornata
          giornata={modifica}
          onClose={() => setModifica(null)}
          onFatto={() => {
            setModifica(null)
            qc.invalidateQueries({ queryKey: ['giornate', corsoId] })
          }}
        />
      )}
    </div>
  )
}

function FormModificaGiornata({
  giornata,
  onClose,
  onFatto,
}: {
  giornata: Giornata
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [data, setData] = useState(giornata.data ?? '')
  const [luogo, setLuogo] = useState(giornata.luogo ?? '')
  const [obiettivi, setObiettivi] = useState(giornata.obiettivi ?? '')
  const [note, setNote] = useState(giornata.note ?? '')

  const mut = useMutation({
    mutationFn: () =>
      aggiornaGiornata(giornata.id, {
        data: data || null,
        luogo: luogo || null,
        obiettivi: obiettivi || null,
        note: note || null,
      }),
    onSuccess: () => {
      toast.successo('Giornata aggiornata.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo={`Giornata ${giornata.ordine} — ${giornata.titolo}`} aperto onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mut.mutate()
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Luogo">
            <input className="input" value={luogo} onChange={(e) => setLuogo(e.target.value)} />
          </Field>
        </div>
        <Field label="Obiettivi">
          <textarea className="input min-h-[60px]" value={obiettivi} onChange={(e) => setObiettivi(e.target.value)} />
        </Field>
        <Field label="Note della giornata" hint="Visibili anche agli atleti del corso">
          <textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva
          </button>
        </div>
      </form>
    </Modal>
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
  const [valuta, setValuta] = useState<Iscrizione | null>(null)

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
              {i.esito && (
                <Badge tono={i.esito === 'SUPERATO' ? 'verde' : 'rosso'}>
                  {i.esito === 'SUPERATO' ? 'Superato' : 'Non superato'}
                </Badge>
              )}
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
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setValuta(i)}>
                Valuta
              </button>
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

      {valuta && (
        <FormValutazione
          iscrizione={valuta}
          nome={nomeCompleto(mappaMembri.get(valuta.atleta_id))}
          onClose={() => setValuta(null)}
          onFatto={() => {
            setValuta(null)
            invalida()
          }}
        />
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

// ---- Proponi come corso standard ----

function ProponiStandard({ corso, giornate }: { corso: Corso; giornate: Giornata[] }) {
  const { asd, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const proposte = useQuery({
    queryKey: ['proposte-corso', corso.id],
    queryFn: () => proposteDelCorso(corso.id),
  })

  const pendente = (proposte.data ?? []).find((p) => p.stato === 'IN_REVISIONE')
  const ultima = (proposte.data ?? [])[0]

  const proponi = useMutation({
    mutationFn: () =>
      creaProposta({
        asdId: asd!.id,
        corsoId: corso.id,
        titolo: corso.titolo,
        descrizione: corso.descrizione,
        livello: null,
        propostoDa: profilo?.id ?? null,
        giornate: giornate.map((g) => ({
          ordine: g.ordine,
          titolo: g.titolo,
          obiettivi: g.obiettivi,
          argomenti: g.argomenti,
          durata_minuti: g.durata_minuti,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposte-corso', corso.id] })
      toast.successo('Corso proposto: è ora in revisione ai programmatori.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const ritira = useMutation({
    mutationFn: (id: string) => ritiraProposta(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposte-corso', corso.id] })
      toast.successo('Proposta ritirata.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-start gap-3">
        <Award className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div>
          <p className="text-sm font-medium text-slate-800">Proponi come corso standard</p>
          <p className="text-xs text-slate-500">
            Invia questo corso in revisione ai programmatori: se accettato, diventerà una linea guida
            disponibile a tutte le ASD.
          </p>
          {ultima?.stato === 'RIFIUTATA' && ultima.note_revisione && (
            <p className="mt-1 text-xs text-red-600">
              Proposta precedente rifiutata: {ultima.note_revisione}
            </p>
          )}
          {ultima?.stato === 'ACCETTATA' && (
            <p className="mt-1 text-xs text-green-700">
              Già accettata: è tra i corsi standard.
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {pendente ? (
          <div className="flex items-center gap-2">
            <Badge tono="giallo">In revisione</Badge>
            <button
              className="btn-ghost px-2 py-1 text-xs text-red-600"
              onClick={() => ritira.mutate(pendente.id)}
              disabled={ritira.isPending}
            >
              Ritira
            </button>
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => proponi.mutate()}
            disabled={proponi.isPending || giornate.length === 0}
          >
            {proponi.isPending && <Spinner className="h-4 w-4" />} Proponi
          </button>
        )}
      </div>
    </Card>
  )
}

// ---- Valutazione atleta ----

function FormValutazione({
  iscrizione,
  nome,
  onClose,
  onFatto,
}: {
  iscrizione: Iscrizione
  nome: string
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [esito, setEsito] = useState<EsitoCorso | ''>(iscrizione.esito ?? '')
  const [val, setVal] = useState(iscrizione.valutazione ?? '')

  const mut = useMutation({
    mutationFn: () => valutaIscrizione(iscrizione.id, esito || null, val || null),
    onSuccess: () => {
      toast.successo('Valutazione salvata.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo={`Valutazione — ${nome}`} aperto onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mut.mutate()
        }}
        className="space-y-4"
      >
        <Field label="Esito">
          <select className="input" value={esito} onChange={(e) => setEsito(e.target.value as EsitoCorso | '')}>
            <option value="">Non valutato</option>
            <option value="SUPERATO">Superato</option>
            <option value="NON_SUPERATO">Non superato</option>
          </select>
        </Field>
        <Field label="Valutazione / note">
          <textarea className="input min-h-[90px]" value={val} onChange={(e) => setVal(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Commenti ----

function SezioneCommenti({
  corso,
  giornate,
  mappaMembri,
}: {
  corso: Corso
  giornate: Giornata[]
  mappaMembri: Map<string, Utente>
}) {
  const { profilo, isStaff } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [testo, setTesto] = useState('')
  const [giornataId, setGiornataId] = useState('')

  const commenti = useQuery({
    queryKey: ['commenti', corso.id],
    queryFn: () => commentiCorso(corso.id),
  })

  const invalida = () => qc.invalidateQueries({ queryKey: ['commenti', corso.id] })

  const crea = useMutation({
    mutationFn: () =>
      creaCommento({
        asdId: corso.asd_id,
        corsoId: corso.id,
        giornataId: giornataId || null,
        autoreId: profilo!.id,
        testo: testo.trim(),
      }),
    onSuccess: () => {
      setTesto('')
      setGiornataId('')
      invalida()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const del = useMutation({
    mutationFn: (cid: string) => eliminaCommento(cid),
    onSuccess: invalida,
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const nomeAutore = (autoreId: string | null) => {
    if (autoreId && autoreId === profilo?.id) return 'Tu'
    const u = autoreId ? mappaMembri.get(autoreId) : undefined
    return u ? nomeCompleto(u) : 'Membro'
  }
  const titoloGiornata = (gid: string | null) => {
    if (!gid) return null
    const g = giornate.find((x) => x.id === gid)
    return g ? `Giornata ${g.ordine}: ${g.titolo}` : 'Giornata'
  }

  return (
    <div>
      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-medium text-slate-700">Aggiungi un commento</p>
        <p className="mb-3 text-xs text-slate-400">
          Utile per annotare com'è andata e i problemi ricorrenti, così da migliorare i corsi
          successivi. Visibile allo staff e agli atleti iscritti.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (testo.trim()) crea.mutate()
          }}
          className="space-y-3"
        >
          <textarea
            className="input min-h-[70px]"
            placeholder="Scrivi un commento…"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto py-1 text-sm"
              value={giornataId}
              onChange={(e) => setGiornataId(e.target.value)}
            >
              <option value="">Sul corso in generale</option>
              {giornate.map((g) => (
                <option key={g.id} value={g.id}>
                  Giornata {g.ordine}: {g.titolo}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={crea.isPending || !testo.trim()}>
              {crea.isPending && <Spinner className="h-4 w-4" />} Pubblica
            </button>
          </div>
        </form>
      </Card>

      {commenti.isLoading ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : (commenti.data ?? []).length === 0 ? (
        <EmptyState
          icona={<MessageSquare className="h-8 w-8" />}
          titolo="Nessun commento"
          descrizione="Inizia tu la discussione sul corso."
        />
      ) : (
        <div className="space-y-2">
          {(commenti.data ?? []).map((cm) => (
            <Card key={cm.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{nomeAutore(cm.autore_id)}</span>
                    {cm.giornata_id && <Badge tono="blu">{titoloGiornata(cm.giornata_id)}</Badge>}
                    <span className="text-xs text-slate-400">{formatData(cm.creato_il)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{cm.testo}</p>
                </div>
                {(isStaff || cm.autore_id === profilo?.id) && (
                  <button
                    className="btn-ghost shrink-0 px-2 py-1 text-xs text-red-600"
                    onClick={() => del.mutate(cm.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Diplomi (gestione istruttori + firme) ----

function SezioneDiplomi({
  corso,
  istruttoriDisponibili,
  mappaMembri,
}: {
  corso: Corso
  istruttoriDisponibili: Utente[]
  mappaMembri: Map<string, Utente>
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [sel, setSel] = useState('')

  const istruttori = useQuery({
    queryKey: ['istruttori-corso', corso.id],
    queryFn: () => listaIstruttoriCorso(corso.id),
  })
  const invalida = () => qc.invalidateQueries({ queryKey: ['istruttori-corso', corso.id] })

  const aggiungi = useMutation({
    mutationFn: () => aggiungiIstruttoreCorso(corso.id, corso.asd_id, sel),
    onSuccess: () => {
      setSel('')
      invalida()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })
  const rimuovi = useMutation({
    mutationFn: (rid: string) => rimuoviIstruttoreCorso(rid),
    onSuccess: invalida,
    onError: (e) => toast.errore(messaggioErrore(e)),
  })
  const firma = useMutation({
    mutationFn: ({ rid, dataUrl }: { rid: string; dataUrl: string | null }) =>
      aggiornaFirmaIstruttore(rid, dataUrl),
    onSuccess: () => {
      invalida()
      toast.successo('Firma salvata.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const giaAggiunti = new Set((istruttori.data ?? []).map((x) => x.istruttore_id))
  const disponibili = istruttoriDisponibili.filter((u) => !giaAggiunti.has(u.id))

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Diplomi del corso</p>
            <p className="text-xs text-slate-400">
              Stampa i diplomi già compilati con nomi, lezioni frequentate, argomenti e firme.
            </p>
          </div>
          <Link to={`/corsi/${corso.id}/diplomi`} className="btn-primary shrink-0">
            <Printer className="h-4 w-4" /> Apri diplomi
          </Link>
        </div>
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Istruttori del corso e firme</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">— Aggiungi istruttore —</option>
            {disponibili.map((u) => (
              <option key={u.id} value={u.id}>
                {nomeCompleto(u)}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => aggiungi.mutate()} disabled={!sel || aggiungi.isPending}>
            <Plus className="h-4 w-4" /> Aggiungi
          </button>
        </div>

        {istruttori.isLoading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : (istruttori.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessun istruttore associato. Aggiungine per far comparire le firme sui diplomi.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(istruttori.data ?? []).map((it) => (
              <div key={it.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {nomeCompleto(mappaMembri.get(it.istruttore_id))}
                  </span>
                  <button
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => rimuovi.mutate(it.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                  </button>
                </div>
                <p className="mb-1 text-xs text-slate-400">Firma (opzionale)</p>
                <SignaturePad
                  valore={it.firma}
                  onChange={(dataUrl) => firma.mutate({ rid: it.id, dataUrl })}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
