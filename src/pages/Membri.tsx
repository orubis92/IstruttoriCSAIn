import { useMemo, useState, type FormEvent, type ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, KeyRound, Copy, Check, Search, Download, Upload, Mail } from 'lucide-react'
import { scaricaCsv } from '@/lib/csv'
import { leggiCsv, dataIso, normalizzaIntestazione } from '@/lib/csvimport'
import { validaCodiceFiscale, coerenteConData } from '@/lib/codicefiscale'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaMembri,
  creaUtente,
  attivaDisattiva,
  aggiornaDatiAnagrafici,
  aggiornaUtente,
  eliminaUtente,
} from '@/api/utenti'
import { creaInvito } from '@/api/inviti'
import {
  certificatiAtleta,
  creaCertificato,
  eliminaCertificato,
  statoCertificati,
} from '@/api/certificati'
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
import { RUOLO_LABEL, formatData, nomeCompleto, eMinorenne } from '@/lib/format'
import type { RuoloUtente, StatoCertificato, TipoCertificato, Utente } from '@/lib/database.types'

export default function Membri() {
  const { asd, isStaff, isAdmin, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const [cerca, setCerca] = useState('')
  const [filtro, setFiltro] = useState<'TUTTI' | RuoloUtente>('TUTTI')
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [importaAperto, setImportaAperto] = useState(false)
  const [invitoCodice, setInvitoCodice] = useState<string | null>(null)
  const [invitoEmail, setInvitoEmail] = useState<string | null>(null)
  const [modifica, setModifica] = useState<Utente | null>(null)
  const [certificatoDi, setCertificatoDi] = useState<Utente | null>(null)

  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri })
  const certStato = useQuery({ queryKey: ['stato-certificati'], queryFn: statoCertificati })

  const statoPerAtleta = useMemo(() => {
    const m = new Map<string, StatoCertificato>()
    ;(certStato.data ?? []).forEach((r) => m.set(r.atleta_id, r.stato))
    return m
  }, [certStato.data])

  const invalida = () => {
    qc.invalidateQueries({ queryKey: ['membri'] })
    qc.invalidateQueries({ queryKey: ['stato-certificati'] })
  }

  const inviteMut = useMutation({
    mutationFn: (utenteId: string) => creaInvito(utenteId),
    onSuccess: (inv, utenteId) => {
      setInvitoCodice(inv.codice)
      setInvitoEmail((membri.data ?? []).find((x) => x.id === utenteId)?.email ?? null)
    },
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

  const eliminaMut = useMutation({
    mutationFn: (id: string) => eliminaUtente(id),
    onSuccess: () => {
      invalida()
      toast.successo('Membro eliminato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function confermaElimina(m: Utente) {
    if (
      window.confirm(
        `Eliminare definitivamente ${nomeCompleto(m)}?\n\nVerranno rimossi anche iscrizioni, presenze, certificati e documenti collegati. L'operazione non è reversibile.\n\nSe l'obiettivo è solo sospendere il membro, usa invece "Disattiva".`,
      )
    ) {
      eliminaMut.mutate(m.id)
    }
  }

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

  function esporta() {
    const label: Record<StatoCertificato, string> = {
      ASSENTE: 'Nessun certificato',
      SCADUTO: 'Scaduto',
      IN_SCADENZA: 'In scadenza',
      VALIDO: 'Valido',
    }
    scaricaCsv(`membri-${asd?.nome ?? 'asd'}`, filtrati, [
      { intestazione: 'Cognome', valore: (m) => m.cognome },
      { intestazione: 'Nome', valore: (m) => m.nome },
      { intestazione: 'Ruolo', valore: (m) => RUOLO_LABEL[m.ruolo] },
      { intestazione: 'Data di nascita', valore: (m) => formatData(m.data_nascita) },
      { intestazione: 'Minore', valore: (m) => (eMinorenne(m.data_nascita) ? 'Sì' : 'No') },
      { intestazione: 'Codice fiscale', valore: (m) => m.codice_fiscale },
      { intestazione: 'Tessera CSAIN', valore: (m) => m.n_tessera_csain },
      { intestazione: 'Email', valore: (m) => m.email },
      { intestazione: 'Telefono', valore: (m) => m.telefono },
      {
        intestazione: 'Certificato',
        valore: (m) => (m.ruolo === 'ATLETA' ? label[statoPerAtleta.get(m.id) ?? 'ASSENTE'] : ''),
      },
      { intestazione: 'Genitore/tutore', valore: (m) => nomeGenitore(m) },
      { intestazione: 'Relazione', valore: (m) => m.genitore_relazione },
      { intestazione: 'Tel. genitore', valore: (m) => m.genitore_telefono },
      { intestazione: 'Email genitore', valore: (m) => m.genitore_email },
      { intestazione: 'Account attivo', valore: (m) => (m.auth_id ? 'Sì' : 'No') },
    ])
  }

  if (!isStaff) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader
        titolo="Membri"
        sottotitolo={asd?.nome}
        azioni={
          <>
            <button className="btn-secondary" onClick={esporta} disabled={filtrati.length === 0}>
              <Download className="h-4 w-4" /> Esporta CSV
            </button>
            <button className="btn-secondary" onClick={() => setImportaAperto(true)}>
              <Upload className="h-4 w-4" /> Importa CSV
            </button>
            <button className="btn-primary" onClick={() => setNuovoAperto(true)}>
              <UserPlus className="h-4 w-4" /> Nuovo membro
            </button>
          </>
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
              <div className="flex flex-wrap items-center gap-1.5">
                {eMinorenne(m.data_nascita) && <Badge tono="blu">Minore</Badge>}
                {m.ruolo === 'ATLETA' && <CertBadge stato={statoPerAtleta.get(m.id)} />}
                <Badge tono={m.ruolo === 'ATLETA' ? 'grigio' : 'brand'}>{RUOLO_LABEL[m.ruolo]}</Badge>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setModifica(m)}>
                  Dati
                </button>
                {m.ruolo === 'ATLETA' && (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setCertificatoDi(m)}>
                    Certificato
                  </button>
                )}
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
                {isAdmin && m.id !== profilo?.id && (
                  <button
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => confermaElimina(m)}
                    disabled={eliminaMut.isPending}
                  >
                    Elimina
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
            if (codice) {
              setInvitoEmail(null)
              setInvitoCodice(codice)
            }
          }}
        />
      )}

      {importaAperto && asd && (
        <FormImportaCsv
          asdId={asd.id}
          creatoDa={profilo?.id ?? null}
          onClose={() => setImportaAperto(false)}
          onFatto={() => {
            setImportaAperto(false)
            invalida()
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

      {certificatoDi && asd && (
        <FormCertificato
          atleta={certificatoDi}
          asdId={asd.id}
          creatoDa={profilo?.id ?? null}
          onClose={() => setCertificatoDi(null)}
        />
      )}

      <Modal
        titolo="Codice invito"
        aperto={!!invitoCodice}
        onClose={() => {
          setInvitoCodice(null)
          setInvitoEmail(null)
        }}
      >
        <p className="mb-3 text-sm text-slate-600">
          Consegna questo codice all'interessato: al primo accesso lo inserirà per attivare il
          proprio account.
        </p>
        {invitoCodice && <CodiceCopiabile codice={invitoCodice} />}
        {invitoCodice && <InvitoPerEmail codice={invitoCodice} email={invitoEmail} />}
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
  const [genNome, setGenNome] = useState('')
  const [genCognome, setGenCognome] = useState('')
  const [genRelazione, setGenRelazione] = useState('Genitore')
  const [genEmail, setGenEmail] = useState('')
  const [genTelefono, setGenTelefono] = useState('')
  const [genCf, setGenCf] = useState('')

  const minore = ruolo === 'ATLETA' && eMinorenne(dataNascita)

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
        genitoreNome: minore ? genNome : null,
        genitoreCognome: minore ? genCognome : null,
        genitoreRelazione: minore ? genRelazione : null,
        genitoreEmail: minore ? genEmail : null,
        genitoreTelefono: minore ? genTelefono : null,
        genitoreCodiceFiscale: minore ? genCf : null,
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
    const cfEsito = validaCodiceFiscale(cf)
    if (!cfEsito.valido) {
      toast.errore(`Codice fiscale non valido: ${cfEsito.motivo}.`)
      return
    }
    if (minore) {
      const genEsito = validaCodiceFiscale(genCf)
      if (!genEsito.valido) {
        toast.errore(`Codice fiscale del genitore non valido: ${genEsito.motivo}.`)
        return
      }
    }
    if (cf && dataNascita && !coerenteConData(cf, dataNascita)) {
      if (!window.confirm('Il codice fiscale non sembra coerente con la data di nascita. Procedere comunque?')) {
        return
      }
    }
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
          {cf.length > 0 && !validaCodiceFiscale(cf).valido && (
            <p className="mt-1 text-xs text-red-600">
              Codice fiscale non valido: {validaCodiceFiscale(cf).motivo}
            </p>
          )}
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        {minore && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <p className="text-sm font-medium text-blue-900">
              Atleta minorenne — dati del genitore/tutore
            </p>
            <p className="text-xs text-blue-700">
              Per i minori il consenso al trattamento dei dati è prestato da chi esercita la
              responsabilità genitoriale.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome genitore/tutore">
                <input className="input" value={genNome} onChange={(e) => setGenNome(e.target.value)} />
              </Field>
              <Field label="Cognome genitore/tutore">
                <input className="input" value={genCognome} onChange={(e) => setGenCognome(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relazione">
                <select className="input" value={genRelazione} onChange={(e) => setGenRelazione(e.target.value)}>
                  <option>Genitore</option>
                  <option>Tutore</option>
                  <option>Affidatario</option>
                </select>
              </Field>
              <Field label="Telefono">
                <input className="input" value={genTelefono} onChange={(e) => setGenTelefono(e.target.value)} />
              </Field>
            </div>
            <Field label="Email genitore/tutore">
              <input className="input" type="email" value={genEmail} onChange={(e) => setGenEmail(e.target.value)} />
            </Field>
            <Field label="Codice fiscale genitore/tutore">
              <input
                className="input uppercase"
                value={genCf}
                onChange={(e) => setGenCf(e.target.value.toUpperCase())}
                maxLength={16}
              />
            </Field>
          </div>
        )}

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
  const [genNome, setGenNome] = useState(utente.genitore_nome ?? '')
  const [genCognome, setGenCognome] = useState(utente.genitore_cognome ?? '')
  const [genRelazione, setGenRelazione] = useState(utente.genitore_relazione ?? 'Genitore')
  const [genEmail, setGenEmail] = useState(utente.genitore_email ?? '')
  const [genTelefono, setGenTelefono] = useState(utente.genitore_telefono ?? '')
  const [genCf, setGenCf] = useState(utente.genitore_codice_fiscale ?? '')

  const minore = utente.ruolo === 'ATLETA' && eMinorenne(utente.data_nascita)

  const mut = useMutation({
    mutationFn: async () => {
      await aggiornaDatiAnagrafici(utente.id, cf || null, tessera || null)
      if (minore) {
        await aggiornaUtente(utente.id, {
          genitore_nome: genNome || null,
          genitore_cognome: genCognome || null,
          genitore_relazione: genRelazione || null,
          genitore_email: genEmail || null,
          genitore_telefono: genTelefono || null,
          genitore_codice_fiscale: genCf || null,
        })
      }
    },
    onSuccess: () => {
      toast.successo('Dati aggiornati.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function salva() {
    const e1 = validaCodiceFiscale(cf)
    if (!e1.valido) {
      toast.errore(`Codice fiscale non valido: ${e1.motivo}.`)
      return
    }
    if (minore) {
      const e2 = validaCodiceFiscale(genCf)
      if (!e2.valido) {
        toast.errore(`Codice fiscale del genitore non valido: ${e2.motivo}.`)
        return
      }
    }
    if (cf && utente.data_nascita && !coerenteConData(cf, utente.data_nascita)) {
      if (!window.confirm('Il codice fiscale non sembra coerente con la data di nascita. Procedere comunque?')) {
        return
      }
    }
    mut.mutate()
  }

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
          {cf.length > 0 && !validaCodiceFiscale(cf).valido && (
            <p className="mt-1 text-xs text-red-600">
              Codice fiscale non valido: {validaCodiceFiscale(cf).motivo}
            </p>
          )}
        </Field>
        <Field label="Tessera CSAIN">
          <input className="input" value={tessera} onChange={(e) => setTessera(e.target.value)} />
        </Field>

        {minore && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <p className="text-sm font-medium text-blue-900">Genitore/tutore (atleta minorenne)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input className="input" value={genNome} onChange={(e) => setGenNome(e.target.value)} />
              </Field>
              <Field label="Cognome">
                <input className="input" value={genCognome} onChange={(e) => setGenCognome(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relazione">
                <select className="input" value={genRelazione} onChange={(e) => setGenRelazione(e.target.value)}>
                  <option>Genitore</option>
                  <option>Tutore</option>
                  <option>Affidatario</option>
                </select>
              </Field>
              <Field label="Telefono">
                <input className="input" value={genTelefono} onChange={(e) => setGenTelefono(e.target.value)} />
              </Field>
            </div>
            <Field label="Email">
              <input className="input" type="email" value={genEmail} onChange={(e) => setGenEmail(e.target.value)} />
            </Field>
            <Field label="Codice fiscale">
              <input
                className="input uppercase"
                value={genCf}
                onChange={(e) => setGenCf(e.target.value.toUpperCase())}
                maxLength={16}
              />
            </Field>
          </div>
        )}

        <p className="text-xs text-slate-400">Iscritto il {formatData(utente.creato_il)}.</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button className="btn-primary flex-1" onClick={salva} disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva
          </button>
        </div>
      </div>
    </Modal>
  )
}

function nomeGenitore(m: Utente): string {
  const s = `${m.genitore_nome ?? ''} ${m.genitore_cognome ?? ''}`.trim()
  return s
}

function InvitoPerEmail({ codice, email }: { codice: string; email: string | null }) {
  const app = window.location.origin
  const oggetto = 'Invito ad attivare il tuo account'
  const corpo =
    `Ciao,\n\n` +
    `è stato creato per te un account sulla piattaforma di gestione dei corsi.\n\n` +
    `Per attivarlo:\n` +
    `1) apri ${app}\n` +
    `2) crea l'accesso con la tua email\n` +
    `3) quando richiesto, inserisci questo codice invito:\n\n` +
    `${codice}\n\n` +
    `A presto.`
  const href = `mailto:${email ?? ''}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`
  return (
    <a href={href} className="btn-secondary mt-3 w-full">
      <Mail className="h-4 w-4" /> Invia per email{email ? ` a ${email}` : ''}
    </a>
  )
}

interface RigaImport {
  nome: string
  cognome: string
  dataNascita: string | null
  codiceFiscale: string | null
  nTesseraCsain: string | null
  email: string | null
  telefono: string | null
  valida: boolean
  errore?: string
}

function mappaColonne(intestazioni: string[]) {
  const norm = intestazioni.map(normalizzaIntestazione)
  const trova = (test: (h: string) => boolean) => norm.findIndex(test)
  return {
    nome: trova((h) => h === 'nome'),
    cognome: trova((h) => h === 'cognome'),
    data: trova((h) => h.includes('data') && h.includes('nasc')),
    cf: trova((h) => (h.includes('fiscale') || h === 'cf') && !h.includes('genitore')),
    tessera: trova((h) => h.includes('tessera')),
    email: trova((h) => h === 'email'),
    telefono: trova((h) => h === 'telefono' || h === 'tel'),
  }
}

function FormImportaCsv({
  asdId,
  creatoDa,
  onClose,
  onFatto,
}: {
  asdId: string
  creatoDa: string | null
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [righe, setRighe] = useState<RigaImport[]>([])
  const [nomeFile, setNomeFile] = useState('')

  const validi = useMemo(() => righe.filter((r) => r.valida), [righe])
  const nonValidi = righe.length - validi.length

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNomeFile(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { intestazioni, righe: dati } = leggiCsv(String(reader.result))
        const col = mappaColonne(intestazioni)
        if (col.nome < 0 || col.cognome < 0) {
          toast.errore('Il file deve contenere almeno le colonne "Nome" e "Cognome".')
          setRighe([])
          return
        }
        setRighe(
          dati.map<RigaImport>((r) => {
            const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
            const nome = get(col.nome)
            const cognome = get(col.cognome)
            const dnRaw = get(col.data)
            const dn = dnRaw ? dataIso(dnRaw) : null
            const cf = get(col.cf) || null
            const dataOk = !dnRaw || dn !== null
            const cfOk = validaCodiceFiscale(cf).valido
            const valida = !!nome && !!cognome && dataOk && cfOk
            const errore = !nome || !cognome
              ? 'Nome/cognome mancante'
              : !dataOk
                ? 'Data non valida'
                : !cfOk
                  ? 'Codice fiscale non valido'
                  : undefined
            return {
              nome,
              cognome,
              dataNascita: dn,
              codiceFiscale: cf,
              nTesseraCsain: get(col.tessera) || null,
              email: get(col.email) || null,
              telefono: get(col.telefono) || null,
              valida,
              errore,
            }
          }),
        )
      } catch {
        toast.errore('Impossibile leggere il file CSV.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const importa = useMutation({
    mutationFn: async () => {
      let creati = 0
      let errori = 0
      for (const r of validi) {
        try {
          await creaUtente({
            ruolo: 'ATLETA',
            asdId,
            nome: r.nome,
            cognome: r.cognome,
            dataNascita: r.dataNascita,
            codiceFiscale: r.codiceFiscale,
            nTesseraCsain: r.nTesseraCsain,
            email: r.email,
            telefono: r.telefono,
            creatoDa,
          })
          creati++
        } catch {
          errori++
        }
      }
      return { creati, errori }
    },
    onSuccess: (res) => {
      toast.successo(`Import completato: ${res.creati} atleti creati${res.errori ? `, ${res.errori} non riusciti` : ''}.`)
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function scaricaModello() {
    scaricaCsv(
      'modello-atleti',
      [{}],
      [
        { intestazione: 'Nome', valore: () => 'Mario' },
        { intestazione: 'Cognome', valore: () => 'Rossi' },
        { intestazione: 'Data di nascita', valore: () => '01/09/2010' },
        { intestazione: 'Codice fiscale', valore: () => '' },
        { intestazione: 'Tessera CSAIN', valore: () => '' },
        { intestazione: 'Email', valore: () => '' },
        { intestazione: 'Telefono', valore: () => '' },
      ],
    )
  }

  return (
    <Modal titolo="Importa atleti da CSV" aperto onClose={onClose} larghezza="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Carica un file CSV con una riga per atleta. Colonne riconosciute:{' '}
          <span className="font-medium">Nome</span>, <span className="font-medium">Cognome</span>,
          Data di nascita, Codice fiscale, Tessera CSAIN, Email, Telefono. Nome e cognome sono
          obbligatori. Gli atleti vengono creati senza account: potrai generare gli inviti dopo.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" /> Scegli file CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          <button type="button" className="btn-ghost text-sm" onClick={scaricaModello}>
            <Download className="h-4 w-4" /> Scarica modello
          </button>
          {nomeFile && <span className="text-xs text-slate-400">{nomeFile}</span>}
        </div>

        {righe.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tono="verde">{validi.length} validi</Badge>
              {nonValidi > 0 && <Badge tono="rosso">{nonValidi} da correggere</Badge>}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Cognome</th>
                    <th className="px-3 py-2">Nascita</th>
                    <th className="px-3 py-2">Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{r.nome || '—'}</td>
                      <td className="px-3 py-1.5">{r.cognome || '—'}</td>
                      <td className="px-3 py-1.5">{r.dataNascita ? formatData(r.dataNascita) : '—'}</td>
                      <td className="px-3 py-1.5">
                        {r.valida ? (
                          <span className="text-xs text-green-600">ok</span>
                        ) : (
                          <span className="text-xs text-red-600">{r.errore}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {righe.length > 50 && (
                <p className="px-3 py-2 text-xs text-slate-400">…e altre {righe.length - 50} righe.</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => importa.mutate()}
            disabled={validi.length === 0 || importa.isPending}
          >
            {importa.isPending && <Spinner className="h-4 w-4" />} Importa {validi.length} atleti
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CertBadge({ stato }: { stato?: StatoCertificato }) {
  if (!stato) return null
  if (stato === 'VALIDO') return <Badge tono="verde">Cert. valido</Badge>
  if (stato === 'IN_SCADENZA') return <Badge tono="giallo">Cert. in scadenza</Badge>
  if (stato === 'SCADUTO') return <Badge tono="rosso">Cert. scaduto</Badge>
  return <Badge tono="grigio">Cert. assente</Badge>
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

function FormCertificato({
  atleta,
  asdId,
  creatoDa,
  onClose,
}: {
  atleta: Utente
  asdId: string
  creatoDa: string | null
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['certificati', atleta.id],
    queryFn: () => certificatiAtleta(atleta.id),
  })

  const [tipo, setTipo] = useState<TipoCertificato>('NON_AGONISTICO')
  const [rilascio, setRilascio] = useState('')
  const [scadenza, setScadenza] = useState('')
  const [ente, setEnte] = useState('')
  const [medico, setMedico] = useState('')
  const [note, setNote] = useState('')

  const invalida = () => qc.invalidateQueries({ queryKey: ['certificati', atleta.id] })

  const crea = useMutation({
    mutationFn: () =>
      creaCertificato({
        atletaId: atleta.id,
        asdId,
        tipo,
        dataRilascio: rilascio || null,
        dataScadenza: scadenza || null,
        enteRilascio: ente || null,
        medico: medico || null,
        note: note || null,
        creatoDa,
      }),
    onSuccess: () => {
      invalida()
      toast.successo('Certificato salvato.')
      setRilascio('')
      setScadenza('')
      setEnte('')
      setMedico('')
      setNote('')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const del = useMutation({
    mutationFn: (id: string) => eliminaCertificato(id),
    onSuccess: invalida,
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function badgeScadenza(data: string | null) {
    if (!data) return null
    const oggi = new Date()
    const d = new Date(data)
    const giorni = Math.round((d.getTime() - oggi.getTime()) / 86400000)
    if (giorni < 0) return <Badge tono="rosso">Scaduto</Badge>
    if (giorni <= 30) return <Badge tono="giallo">In scadenza</Badge>
    return <Badge tono="verde">Valido</Badge>
  }

  return (
    <Modal titolo={`Certificato medico — ${nomeCompleto(atleta)}`} aperto onClose={onClose} larghezza="max-w-xl">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Certificati registrati</p>
          {q.isLoading ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : (q.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Nessun certificato ancora registrato.</p>
          ) : (
            <ul className="space-y-2">
              {(q.data ?? []).map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">
                        {c.tipo === 'AGONISTICO' ? 'Agonistico' : c.tipo === 'NON_AGONISTICO' ? 'Non agonistico' : '—'}
                      </span>
                      {badgeScadenza(c.data_scadenza)}
                    </div>
                    <p className="text-xs text-slate-500">
                      Rilascio: {formatData(c.data_rilascio)} · Scadenza: {formatData(c.data_scadenza)}
                    </p>
                    {(c.ente_rilascio || c.medico) && (
                      <p className="text-xs text-slate-400">
                        {c.ente_rilascio ?? ''} {c.medico ? `· ${c.medico}` : ''}
                      </p>
                    )}
                    {c.note && <p className="mt-1 text-xs text-slate-500">{c.note}</p>}
                  </div>
                  <button
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => {
                      if (confirm('Eliminare questo certificato?')) del.mutate(c.id)
                    }}
                  >
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            crea.mutate()
          }}
          className="space-y-3 border-t border-slate-100 pt-4"
        >
          <p className="text-sm font-medium text-slate-700">Aggiungi un certificato</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCertificato)}>
                <option value="NON_AGONISTICO">Non agonistico</option>
                <option value="AGONISTICO">Agonistico</option>
              </select>
            </Field>
            <Field label="Ente/struttura">
              <input className="input" value={ente} onChange={(e) => setEnte(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data rilascio">
              <input className="input" type="date" value={rilascio} onChange={(e) => setRilascio(e.target.value)} />
            </Field>
            <Field label="Data scadenza">
              <input className="input" type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
            </Field>
          </div>
          <Field label="Medico">
            <input className="input" value={medico} onChange={(e) => setMedico(e.target.value)} />
          </Field>
          <Field label="Note">
            <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary" disabled={crea.isPending}>
            {crea.isPending && <Spinner className="h-4 w-4" />} Salva certificato
          </button>
        </form>
      </div>
    </Modal>
  )
}
