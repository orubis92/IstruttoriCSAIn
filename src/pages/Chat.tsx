import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquarePlus, Users, Send, ArrowLeft, Search, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaConversazioni,
  tuttiIMembri,
  messaggi as apiMessaggi,
  inviaMessaggio,
  listaContatti,
  creaDiretta,
  creaGruppo,
  messaggiNonLetti,
  segnaLetto,
} from '@/api/chat'
import { messaggioErrore } from '@/api/errors'
import { Card, PageHeader, Modal, Field, Spinner, EmptyState, Avatar } from '@/components/ui'
import { RUOLO_LABEL, formatDataOra } from '@/lib/format'
import type { Contatto, Conversazione } from '@/lib/database.types'

export default function Chat() {
  const { profilo } = useAuth()
  const qc = useQueryClient()
  const [selezionata, setSelezionata] = useState<string | null>(null)
  const [nuovaChat, setNuovaChat] = useState(false)
  const [nuovoGruppo, setNuovoGruppo] = useState(false)

  const conversazioni = useQuery({
    queryKey: ['conversazioni'],
    queryFn: listaConversazioni,
    refetchInterval: 10_000,
  })
  const membri = useQuery({ queryKey: ['conv-membri'], queryFn: tuttiIMembri })
  const contatti = useQuery({ queryKey: ['contatti'], queryFn: listaContatti })
  const nonLetti = useQuery({
    queryKey: ['non-letti'],
    queryFn: messaggiNonLetti,
    refetchInterval: 20_000,
  })

  const nonLettiMap = useMemo(() => {
    const m = new Map<string, number>()
    ;(nonLetti.data ?? []).forEach((r) => m.set(r.conversazione_id, Number(r.non_letti)))
    return m
  }, [nonLetti.data])

  const contattoMap = useMemo(() => {
    const m = new Map<string, Contatto>()
    ;(contatti.data ?? []).forEach((c) => m.set(c.id, c))
    return m
  }, [contatti.data])

  const membriDi = useMemo(() => {
    const m = new Map<string, string[]>()
    ;(membri.data ?? []).forEach((r) => {
      const arr = m.get(r.conversazione_id) ?? []
      arr.push(r.utente_id)
      m.set(r.conversazione_id, arr)
    })
    return m
  }, [membri.data])

  const titoloConv = (c: Conversazione): string => {
    if (c.tipo === 'GRUPPO') return c.nome ?? 'Gruppo'
    const altri = (membriDi.get(c.id) ?? []).filter((id) => id !== profilo?.id)
    const altro = altri[0] ? contattoMap.get(altri[0]) : undefined
    return altro ? `${altro.nome} ${altro.cognome}` : 'Chat'
  }

  if (conversazioni.isLoading) {
    return (
      <div>
        <PageHeader titolo="Chat" />
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        titolo="Chat"
        sottotitolo="Messaggi interni alla ASD e verso i programmatori"
        azioni={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setNuovaChat(true)}>
              <MessageSquarePlus className="h-4 w-4" /> Nuova chat
            </button>
            <button className="btn-secondary" onClick={() => setNuovoGruppo(true)}>
              <Users className="h-4 w-4" /> Nuovo gruppo
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
        {/* Elenco conversazioni */}
        <Card
          className={`overflow-hidden ${selezionata ? 'hidden md:block' : ''}`}
        >
          {(conversazioni.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              Nessuna conversazione. Inizia una nuova chat.
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {(conversazioni.data ?? []).map((c) => {
                const titolo = titoloConv(c)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelezionata(c.id)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 ${
                        selezionata === c.id ? 'bg-brand-50' : ''
                      }`}
                    >
                      {c.tipo === 'GRUPPO' ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <Users className="h-5 w-5" />
                        </span>
                      ) : (
                        <Avatar nome={titolo.split(' ')[0] ?? '?'} cognome={titolo.split(' ')[1] ?? ''} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{titolo}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {c.tipo === 'GRUPPO' ? 'Gruppo' : 'Chat diretta'}
                        </span>
                      </span>
                      {(nonLettiMap.get(c.id) ?? 0) > 0 && (
                        <span className="ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                          {nonLettiMap.get(c.id)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Conversazione aperta */}
        <div className={selezionata ? '' : 'hidden md:block'}>
          {selezionata ? (
            <Conversazione
              conversazioneId={selezionata}
              titolo={(() => {
                const c = (conversazioni.data ?? []).find((x) => x.id === selezionata)
                return c ? titoloConv(c) : 'Chat'
              })()}
              onIndietro={() => setSelezionata(null)}
            />
          ) : (
            <EmptyState
              icona={<MessageSquarePlus className="h-10 w-10" />}
              titolo="Seleziona una conversazione"
              descrizione="Oppure inizia una nuova chat o un nuovo gruppo."
            />
          )}
        </div>
      </div>

      {nuovaChat && (
        <ModalNuovaChat
          contatti={(contatti.data ?? []).filter((c) => c.id !== profilo?.id)}
          onClose={() => setNuovaChat(false)}
          onCreata={(id) => {
            setNuovaChat(false)
            qc.invalidateQueries({ queryKey: ['conversazioni'] })
            qc.invalidateQueries({ queryKey: ['conv-membri'] })
            setSelezionata(id)
          }}
        />
      )}
      {nuovoGruppo && (
        <ModalNuovoGruppo
          contatti={(contatti.data ?? []).filter((c) => c.id !== profilo?.id)}
          onClose={() => setNuovoGruppo(false)}
          onCreato={(id) => {
            setNuovoGruppo(false)
            qc.invalidateQueries({ queryKey: ['conversazioni'] })
            qc.invalidateQueries({ queryKey: ['conv-membri'] })
            setSelezionata(id)
          }}
        />
      )}
    </div>
  )
}

function Conversazione({
  conversazioneId,
  titolo,
  onIndietro,
}: {
  conversazioneId: string
  titolo: string
  onIndietro: () => void
}) {
  const { profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [testo, setTesto] = useState('')
  const fondo = useRef<HTMLDivElement>(null)

  const msgs = useQuery({
    queryKey: ['messaggi', conversazioneId],
    queryFn: () => apiMessaggi(conversazioneId),
    refetchInterval: 4000,
  })
  const contatti = useQuery({ queryKey: ['contatti'], queryFn: listaContatti })
  const nomeMittente = (id: string | null) => {
    if (!id) return '—'
    if (id === profilo?.id) return 'Tu'
    const c = (contatti.data ?? []).find((x) => x.id === id)
    return c ? `${c.nome} ${c.cognome}` : '—'
  }

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.data])

  // Aprendo (o ricevendo messaggi mentre è aperta) segna la conversazione come letta.
  useEffect(() => {
    if (!profilo) return
    segnaLetto(conversazioneId, profilo.id)
      .then(() => qc.invalidateQueries({ queryKey: ['non-letti'] }))
      .catch(() => {})
  }, [conversazioneId, msgs.data, profilo, qc])

  const invia = useMutation({
    mutationFn: () => inviaMessaggio(conversazioneId, profilo!.id, testo.trim()),
    onSuccess: () => {
      setTesto('')
      qc.invalidateQueries({ queryKey: ['messaggi', conversazioneId] })
      qc.invalidateQueries({ queryKey: ['conversazioni'] })
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!testo.trim()) return
    invia.mutate()
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <button className="btn-ghost -ml-2 p-1.5 md:hidden" onClick={onIndietro} aria-label="Indietro">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-slate-900">{titolo}</h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/50 p-4">
        {msgs.isLoading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : (msgs.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nessun messaggio. Scrivi il primo!</p>
        ) : (
          (msgs.data ?? []).map((m) => {
            const mio = m.mittente_id === profilo?.id
            return (
              <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mio ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  {!mio && (
                    <p className="mb-0.5 text-xs font-medium text-brand-700">{nomeMittente(m.mittente_id)}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.testo}</p>
                  <p className={`mt-1 text-[10px] ${mio ? 'text-brand-100' : 'text-slate-400'}`}>
                    {formatDataOra(m.creato_il)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={fondo} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-200 p-3">
        <input
          className="input flex-1"
          placeholder="Scrivi un messaggio…"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
        />
        <button type="submit" className="btn-primary px-3" disabled={invia.isPending || !testo.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  )
}

function ModalNuovaChat({
  contatti,
  onClose,
  onCreata,
}: {
  contatti: Contatto[]
  onClose: () => void
  onCreata: (id: string) => void
}) {
  const toast = useToast()
  const [cerca, setCerca] = useState('')
  const filtrati = contatti.filter((c) =>
    `${c.nome} ${c.cognome}`.toLowerCase().includes(cerca.trim().toLowerCase()),
  )
  const mut = useMutation({
    mutationFn: (id: string) => creaDiretta(id),
    onSuccess: (id) => onCreata(id),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo="Nuova chat" aperto onClose={onClose}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Cerca una persona…"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
        />
      </div>
      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {filtrati.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nessun contatto.</p>
        ) : (
          filtrati.map((c) => (
            <button
              key={c.id}
              onClick={() => mut.mutate(c.id)}
              disabled={mut.isPending}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
            >
              <Avatar nome={c.nome} cognome={c.cognome} />
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-800">
                  {c.nome} {c.cognome}
                </span>
                <span className="block text-xs text-slate-400">{RUOLO_LABEL[c.ruolo]}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}

function ModalNuovoGruppo({
  contatti,
  onClose,
  onCreato,
}: {
  contatti: Contatto[]
  onClose: () => void
  onCreato: (id: string) => void
}) {
  const toast = useToast()
  const [nome, setNome] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    const n = new Set(sel)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSel(n)
  }

  const mut = useMutation({
    mutationFn: () => creaGruppo(nome.trim(), Array.from(sel)),
    onSuccess: (id) => onCreato(id),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      toast.errore('Dai un nome al gruppo.')
      return
    }
    if (sel.size === 0) {
      toast.errore('Seleziona almeno un membro.')
      return
    }
    mut.mutate()
  }

  return (
    <Modal titolo="Nuovo gruppo" aperto onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome del gruppo" obbligatorio>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <div>
          <p className="label">Membri</p>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {contatti.map((c) => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="flex-1 text-sm text-slate-700">
                  {c.nome} {c.cognome}
                </span>
                <span className="text-xs text-slate-400">{RUOLO_LABEL[c.ruolo]}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={mut.isPending}>
          {mut.isPending ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} Crea gruppo
        </button>
      </form>
    </Modal>
  )
}
