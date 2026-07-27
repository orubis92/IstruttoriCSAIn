import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Check, X, Award, Inbox, ChevronDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaModelliCorso,
  giornateModello,
  creaModelloCorsoStandard,
  eliminaModelloCorso,
  type GiornataModelloInput,
} from '@/api/corsi'
import { listaProposte, accettaProposta, rifiutaProposta, ritiraProposta } from '@/api/proposte'
import { getAsdMappa } from '@/api/asd'
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
import { formatData } from '@/lib/format'
import type { PropostaCorso, StatoProposta } from '@/lib/database.types'

export default function Standard() {
  const { isProgrammatore } = useAuth()
  const [tab, setTab] = useState<'corsi' | 'proposte'>('proposte')

  const proposte = useQuery({ queryKey: ['proposte'], queryFn: listaProposte })
  const inRevisione = (proposte.data ?? []).filter((p) => p.stato === 'IN_REVISIONE').length

  if (!isProgrammatore) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader
        titolo="Corsi standard"
        sottotitolo="Gestisci le linee guida di piattaforma e le proposte delle ASD"
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        <TabBtn attivo={tab === 'proposte'} onClick={() => setTab('proposte')}>
          <Inbox className="h-4 w-4" /> Proposte in revisione{inRevisione > 0 ? ` (${inRevisione})` : ''}
        </TabBtn>
        <TabBtn attivo={tab === 'corsi'} onClick={() => setTab('corsi')}>
          <Award className="h-4 w-4" /> Corsi standard
        </TabBtn>
      </div>

      {tab === 'proposte' ? <SezioneProposte /> : <SezioneCorsiStandard />}
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
      className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
        attivo ? 'border-brand-600 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------- Proposte ----------------

const STATO_PROPOSTA: Record<StatoProposta, { label: string; tono: 'giallo' | 'verde' | 'rosso' }> = {
  IN_REVISIONE: { label: 'In revisione', tono: 'giallo' },
  ACCETTATA: { label: 'Accettata', tono: 'verde' },
  RIFIUTATA: { label: 'Rifiutata', tono: 'rosso' },
}

function SezioneProposte() {
  const toast = useToast()
  const qc = useQueryClient()
  const proposte = useQuery({ queryKey: ['proposte'], queryFn: listaProposte })
  const asdMap = useQuery({ queryKey: ['asd-mappa'], queryFn: getAsdMappa })
  const [espansa, setEspansa] = useState<string | null>(null)
  const [rifiuta, setRifiuta] = useState<PropostaCorso | null>(null)

  const invalida = () => {
    qc.invalidateQueries({ queryKey: ['proposte'] })
    qc.invalidateQueries({ queryKey: ['modelli-corso'] })
  }

  const accettaMut = useMutation({
    mutationFn: (id: string) => accettaProposta(id),
    onSuccess: () => {
      invalida()
      toast.successo('Proposta accettata: ora è un corso standard.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  if (proposte.isLoading) return <PageLoader />

  if ((proposte.data ?? []).length === 0) {
    return (
      <EmptyState
        icona={<Inbox className="h-10 w-10" />}
        titolo="Nessuna proposta"
        descrizione="Quando una ASD proporrà un corso come standard, lo troverai qui."
      />
    )
  }

  return (
    <div className="space-y-2">
      {(proposte.data ?? []).map((p) => {
        const aperta = espansa === p.id
        const st = STATO_PROPOSTA[p.stato]
        return (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{p.titolo}</p>
                  <Badge tono={st.tono}>{st.label}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {asdMap.data?.[p.asd_id] ?? 'ASD'} · {p.giornate.length} giornate · proposto il{' '}
                  {formatData(p.proposto_il)}
                  {p.livello ? ` · ${p.livello}` : ''}
                </p>
                {p.descrizione && <p className="mt-1 text-sm text-slate-600">{p.descrizione}</p>}
              </div>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => setEspansa(aperta ? null : p.id)}
              >
                Giornate <ChevronDown className={`h-4 w-4 ${aperta ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {aperta && (
              <ol className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {p.giornate.map((g, i) => (
                  <li key={i}>
                    <b>{g.ordine}.</b> {g.titolo}
                    {g.argomenti?.length ? ` — ${g.argomenti.join(', ')}` : ''}
                  </li>
                ))}
              </ol>
            )}

            {p.stato === 'IN_REVISIONE' && (
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => accettaMut.mutate(p.id)}
                  disabled={accettaMut.isPending}
                >
                  <Check className="h-4 w-4" /> Accetta come standard
                </button>
                <button className="btn-secondary" onClick={() => setRifiuta(p)}>
                  <X className="h-4 w-4" /> Rifiuta
                </button>
              </div>
            )}
            {p.stato === 'RIFIUTATA' && p.note_revisione && (
              <p className="mt-2 text-sm text-red-600">Motivo: {p.note_revisione}</p>
            )}
          </Card>
        )
      })}

      {rifiuta && (
        <ModalRifiuta
          proposta={rifiuta}
          onClose={() => setRifiuta(null)}
          onFatto={() => {
            setRifiuta(null)
            invalida()
          }}
        />
      )}
    </div>
  )
}

function ModalRifiuta({
  proposta,
  onClose,
  onFatto,
}: {
  proposta: PropostaCorso
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const mut = useMutation({
    mutationFn: () => rifiutaProposta(proposta.id, note),
    onSuccess: () => {
      toast.successo('Proposta rifiutata.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })
  return (
    <Modal titolo="Rifiuta proposta" aperto onClose={onClose}>
      <div className="space-y-4">
        <Field label="Motivazione (verrà mostrata alla ASD)">
          <textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button className="btn-danger flex-1" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Rifiuta
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Corsi standard ----------------

function SezioneCorsiStandard() {
  const { profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [nuovo, setNuovo] = useState(false)
  const [espanso, setEspanso] = useState<string | null>(null)

  const modelli = useQuery({ queryKey: ['modelli-corso'], queryFn: listaModelliCorso })
  const standard = useMemo(
    () => (modelli.data ?? []).filter((m) => m.asd_id === null),
    [modelli.data],
  )

  const elimina = useMutation({
    mutationFn: (id: string) => eliminaModelloCorso(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelli-corso'] })
      toast.successo('Corso standard eliminato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  if (modelli.isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-3">
        <button className="btn-primary" onClick={() => setNuovo(true)}>
          <Plus className="h-4 w-4" /> Nuovo corso standard
        </button>
      </div>

      {standard.length === 0 ? (
        <EmptyState
          icona={<Award className="h-10 w-10" />}
          titolo="Nessun corso standard"
          descrizione="Crea la prima linea guida disponibile a tutte le ASD."
        />
      ) : (
        <div className="space-y-2">
          {standard.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{m.titolo}</p>
                  <p className="text-xs text-slate-400">{m.livello ?? 'Livello non indicato'}</p>
                  {m.descrizione && <p className="mt-1 text-sm text-slate-600">{m.descrizione}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => setEspanso(espanso === m.id ? null : m.id)}
                  >
                    Giornate <ChevronDown className={`h-4 w-4 ${espanso === m.id ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => {
                      if (confirm('Eliminare questo corso standard?')) elimina.mutate(m.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {espanso === m.id && <GiornateModello modelloId={m.id} />}
            </Card>
          ))}
        </div>
      )}

      {nuovo && (
        <ModalNuovoStandard
          creatoDa={profilo?.id ?? null}
          onClose={() => setNuovo(false)}
          onFatto={() => {
            setNuovo(false)
            qc.invalidateQueries({ queryKey: ['modelli-corso'] })
          }}
        />
      )}
    </div>
  )
}

function GiornateModello({ modelloId }: { modelloId: string }) {
  const g = useQuery({ queryKey: ['modello-giornate', modelloId], queryFn: () => giornateModello(modelloId) })
  if (g.isLoading) return <Spinner className="mt-3 h-4 w-4 text-brand-600" />
  return (
    <ol className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
      {(g.data ?? []).map((x) => (
        <li key={x.id}>
          <b>{x.ordine}.</b> {x.titolo}
          {x.argomenti?.length ? ` — ${x.argomenti.join(', ')}` : ''}
        </li>
      ))}
      {(g.data ?? []).length === 0 && <li className="text-slate-400">Nessuna giornata.</li>}
    </ol>
  )
}

interface RigaGiornata {
  titolo: string
  obiettivi: string
  argomenti: string
  durata: string
}

function ModalNuovoStandard({
  creatoDa,
  onClose,
  onFatto,
}: {
  creatoDa: string | null
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [livello, setLivello] = useState('')
  const [giornate, setGiornate] = useState<RigaGiornata[]>([
    { titolo: '', obiettivi: '', argomenti: '', durata: '' },
  ])

  const aggiornaRiga = (i: number, patch: Partial<RigaGiornata>) =>
    setGiornate((g) => g.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const mut = useMutation({
    mutationFn: () => {
      const gg: GiornataModelloInput[] = giornate
        .filter((r) => r.titolo.trim())
        .map((r, i) => ({
          ordine: i + 1,
          titolo: r.titolo.trim(),
          obiettivi: r.obiettivi.trim() || null,
          argomenti: r.argomenti
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          durataMinuti: r.durata ? Number(r.durata) : null,
        }))
      return creaModelloCorsoStandard({ titolo, descrizione, livello, creatoDa, giornate: gg })
    },
    onSuccess: () => {
      toast.successo('Corso standard creato.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Modal titolo="Nuovo corso standard" aperto onClose={onClose} larghezza="max-w-2xl">
      <form onSubmit={invia} className="space-y-4">
        <Field label="Titolo" obbligatorio>
          <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Descrizione">
              <input className="input" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
            </Field>
          </div>
          <Field label="Livello">
            <input className="input" value={livello} onChange={(e) => setLivello(e.target.value)} placeholder="Base…" />
          </Field>
        </div>

        <div>
          <p className="label">Giornate</p>
          <div className="space-y-2">
            {giornate.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Giornata {i + 1}</span>
                  {giornate.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => setGiornate((g) => g.filter((_, idx) => idx !== i))}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                <input
                  className="input mb-2"
                  placeholder="Titolo della giornata"
                  value={r.titolo}
                  onChange={(e) => aggiornaRiga(i, { titolo: e.target.value })}
                />
                <input
                  className="input mb-2"
                  placeholder="Obiettivi"
                  value={r.obiettivi}
                  onChange={(e) => aggiornaRiga(i, { obiettivi: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="input col-span-2"
                    placeholder="Argomenti (separati da virgola)"
                    value={r.argomenti}
                    onChange={(e) => aggiornaRiga(i, { argomenti: e.target.value })}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Min."
                    value={r.durata}
                    onChange={(e) => aggiornaRiga(i, { durata: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => setGiornate((g) => [...g, { titolo: '', obiettivi: '', argomenti: '', durata: '' }])}
          >
            <Plus className="h-4 w-4" /> Aggiungi giornata
          </button>
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Crea corso standard
          </button>
        </div>
      </form>
    </Modal>
  )
}
