import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, KeyRound, Copy, Check, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaMembri,
  creaUtente,
  attivaDisattiva,
  aggiornaDatiAnagrafici,
} from '@/api/utenti'
import { creaInvito } from '@/api/inviti'
import { messaggioErrore } from '@/api/errors'
import {
  Card,
  PageHeader,
  Badge,
  Modal,
  Field,
  Spinner,
  EmptyState,
  Avatar,
} from '@/components/ui'
import { RUOLO_LABEL, formatData, nomeCompleto } from '@/lib/format'
import type { RuoloUtente, Utente } from '@/lib/database.types'

export default function Membri() {
  const { asd, isStaff, isAdmin, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const [cerca, setCerca] = useState('')
  const [filtro, setFiltro] = useState<'TUTTI' | RuoloUtente>('TUTTI')
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [invitoCodice, setInvitoCodice] = useState<string | null>(null)
  const [modifica, setModifica] = useState<Utente | null>(null)

  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri })

  const invalida = () => qc.invalidateQueries({ queryKey: ['membri'] })

  const inviteMut = useMutation({
    mutationFn: (utenteId: string) => creaInvito(utenteId),
    onSuccess: (inv) => setInvitoCodice(inv.codice),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, attivo }: { id: string; attivo: boolean }) => attivaDisattiva(id, attivo),
    onSuccess: () => {
      invalida()
      toast.successo('Stato aggiornato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (membri.data ?? []).filter((m) => {
      if (filtro !== 'TUTTI' && m.ruolo !== filtro) return false
      if (!q) return true
      return (
        nomeCompleto(m).toLowerCase().includes(q) ||
        (m.codice_fiscale ?? '').toLowerCase().includes(q) ||
        (m.n_tessera_csain ?? '').toLowerCase().includes(q)
      )
    })
  }, [membri.data, cerca, filtro])

  if (!isStaff) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader
        titolo="Membri"
        sottotitolo={asd?.nome}
        azioni={
          <button className="btn-primary" onClick={() => setNuovoAperto(true)}>
            <UserPlus className="h-4 w-4" /> Nuovo membro
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per nome, codice fiscale, tessera…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as never)}>
          <option value="TUTTI">Tutti i ruoli</option>
          <option value="AMMINISTRATORE_ASD">Amministratori</option>
          <option value="ISTRUTTORE">Istruttori</option>
          <option value="ATLETA">Atleti</option>
        </select>
      </div>

      {membri.isLoading ? (
        <Spinner className="h-6 w-6 text-brand-600" />
      ) : filtrati.length === 0 ? (
        <EmptyState
          titolo="Nessun membro"
          descrizione="Aggiungi il primo membro della tua ASD."
          azione={
            <button className="btn-primary" onClick={() => setNuovoAperto(true)}>
              <UserPlus className="h-4 w-4" /> Nuovo membro
            </button>
          }
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {filtrati.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar nome={m.nome} cognome={m.cognome} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">
                  {nomeCompleto(m)}{' '}
                  {!m.attivo && <span className="text-xs font-normal text-red-500">(disattivato)</span>}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {m.codice_fiscale ?? 'CF —'} · Tessera {m.n_tessera_csain ?? '—'} ·{' '}
                  {m.auth_id ? 'account attivo' : 'in attesa di attivazione'}
                </p>
              </div>
              <Badge tono={m.ruolo === 'ATLETA' ? 'grigio' : 'brand'}>{RUOLO_LABEL[m.ruolo]}</Badge>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setModifica(m)}>
                  Dati
                </button>
                {!m.auth_id && (
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => inviteMut.mutate(m.id)}
                    disabled={inviteMut.isPending}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Invito
                  </button>
                )}
                {m.id !== profilo?.id && (
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => toggleMut.mutate({ id: m.id, attivo: !m.attivo })}
                  >
                    {m.attivo ? 'Disattiva' : 'Riattiva'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {nuovoAperto && asd && (
        <FormNuovoMembro
          asdId={asd.id}
          creatoDa={profilo?.id ?? null}
          puoCreareStaff={isAdmin}
          onClose={() => setNuovoAperto(false)}
          onFatto={(codice) => {
            setNuovoAperto(false)
            invalida()
            if (codice) setInvitoCodice(codice)
          }}
        />
      )}

      {modifica && (
        <FormDatiAnagrafici
          utente={modifica}
          onClose={() => setModifica(null)}
          onFatto={() => {
            setModifica(null)
            invalida()
          }}
        />
      )}

      <Modal titolo="Codice invito" aperto={!!invitoCodice} onClose={() => setInvitoCodice(null)}>
        <p className="mb-3 text-sm text-slate-600">
          Consegna questo codice all'interessato: al primo accesso lo inserirà per attivare il
          proprio account.
        </p>
        {invitoCodice && <CodiceCopiabile codice={invitoCodice} />}
      </Modal>
    </div>
  )
}

function FormNuovoMembro({
  asdId,
  creatoDa,
  puoCreareStaff,
  onClose,
  onFatto,
}: {
  asdId: string
  creatoDa: string | null
  puoCreareStaff: boolean
  onClose: () => void
  onFatto: (codiceInvito?: string) => void
}) {
  const toast = useToast()
  const [ruolo, setRuolo] = useState<RuoloUtente>('ATLETA')
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [dataNascita, setDataNascita] = useState('')
  const [cf, setCf] = useState('')
  const [tessera, setTessera] = useState('')
  const [email, setEmail] = useState('')
  const [creaInvitoSubito, setCreaInvitoSubito] = useState(true)

  const mut = useMutation({
    mutationFn: async () => {
      const u = await creaUtente({
        ruolo,
        asdId,
        nome,
        cognome,
        dataNascita,
        codiceFiscale: cf,
        nTesseraCsain: tessera,
        email,
        creatoDa,
      })
      if (creaInvitoSubito) {
        const inv = await creaInvito(u.id)
        return inv.codice
      }
      return undefined
    },
    onSuccess: (codice) => {
      toast.successo('Membro creato.')
      onFatto(codice)
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Modal titolo="Nuovo membro" aperto onClose={onClose}>
      <form onSubmit={invia} className="space-y-4">
        <Field label="Ruolo" obbligatorio>
          <select className="input" value={ruolo} onChange={(e) => setRuolo(e.target.value as RuoloUtente)}>
            <option value="ATLETA">Atleta</option>
            {puoCreareStaff && <option value="ISTRUTTORE">Istruttore</option>}
            {puoCreareStaff && <option value="AMMINISTRATORE_ASD">Amministratore ASD</option>}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" obbligatorio>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </Field>
          <Field label="Cognome" obbligatorio>
            <input className="input" value={cognome} onChange={(e) => setCognome(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data di nascita">
            <input
              className="input"
              type="date"
              value={dataNascita}
              onChange={(e) => setDataNascita(e.target.value)}
            />
          </Field>
          <Field label="Tessera CSAIN">
            <input className="input" value={tessera} onChange={(e) => setTessera(e.target.value)} />
          </Field>
        </div>
        <Field label="Codice fiscale">
          <input
            className="input uppercase"
            value={cf}
            onChange={(e) => setCf(e.target.value.toUpperCase())}
            maxLength={16}
          />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={creaInvitoSubito}
            onChange={(e) => setCreaInvitoSubito(e.target.checked)}
          />
          Genera subito il codice invito
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Crea membro
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FormDatiAnagrafici({
  utente,
  onClose,
  onFatto,
}: {
  utente: Utente
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [cf, setCf] = useState(utente.codice_fiscale ?? '')
  const [tessera, setTessera] = useState(utente.n_tessera_csain ?? '')

  const mut = useMutation({
    mutationFn: () => aggiornaDatiAnagrafici(utente.id, cf || null, tessera || null),
    onSuccess: () => {
      toast.successo('Dati aggiornati.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo={`Dati di ${nomeCompleto(utente)}`} aperto onClose={onClose}>
      <div className="space-y-4">
        <Field label="Codice fiscale">
          <input
            className="input uppercase"
            value={cf}
            onChange={(e) => setCf(e.target.value.toUpperCase())}
            maxLength={16}
          />
        </Field>
        <Field label="Tessera CSAIN">
          <input className="input" value={tessera} onChange={(e) => setTessera(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-400">Iscritto il {formatData(utente.creato_il)}.</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button className="btn-primary flex-1" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CodiceCopiabile({ codice }: { codice: string }) {
  const [copiato, setCopiato] = useState(false)
  async function copia() {
    await navigator.clipboard.writeText(codice)
    setCopiato(true)
    setTimeout(() => setCopiato(false), 2000)
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <code className="flex-1 break-all font-mono text-sm text-slate-800">{codice}</code>
      <button className="btn-secondary shrink-0" onClick={copia}>
        {copiato ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copiato ? 'Copiato' : 'Copia'}
      </button>
    </div>
  )
}
