import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { aggiornaUtente, staffAsd } from '@/api/utenti'
import { mieiCertificati } from '@/api/certificati'
import { messaggioErrore } from '@/api/errors'
import { Card, PageHeader, Field, Spinner, Badge } from '@/components/ui'
import { RUOLO_LABEL, formatData, nomeCompleto } from '@/lib/format'

export default function Profilo() {
  const { profilo, asd, ruolo, refreshProfilo } = useAuth()
  const toast = useToast()
  const [salvo, setSalvo] = useState(false)
  const [telefono, setTelefono] = useState(profilo?.telefono ?? '')
  const [email, setEmail] = useState(profilo?.email ?? '')

  const staff = useQuery({
    queryKey: ['staff-asd'],
    queryFn: staffAsd,
    enabled: ruolo === 'ATLETA',
  })

  const certificati = useQuery({
    queryKey: ['miei-certificati'],
    queryFn: mieiCertificati,
    enabled: ruolo === 'ATLETA',
  })

  function badgeScadenza(data: string | null) {
    if (!data) return null
    const giorni = Math.round((new Date(data).getTime() - Date.now()) / 86400000)
    if (giorni < 0) return <Badge tono="rosso">Scaduto</Badge>
    if (giorni <= 30) return <Badge tono="giallo">In scadenza</Badge>
    return <Badge tono="verde">Valido</Badge>
  }

  if (!profilo) return null

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!profilo) return
    setSalvo(true)
    try {
      await aggiornaUtente(profilo.id, { telefono, email })
      await refreshProfilo()
      toast.successo('Profilo aggiornato.')
    } catch (err) {
      toast.errore(messaggioErrore(err))
    } finally {
      setSalvo(false)
    }
  }

  return (
    <div>
      <PageHeader titolo="Il mio profilo" sottotitolo={asd?.nome} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Dati anagrafici</h2>
          <dl className="space-y-2 text-sm">
            <Riga etichetta="Nome" valore={nomeCompleto(profilo)} />
            <Riga etichetta="Ruolo" valore={ruolo ? RUOLO_LABEL[ruolo] : '—'} />
            <Riga etichetta="Data di nascita" valore={formatData(profilo.data_nascita)} />
            <Riga etichetta="Codice fiscale" valore={profilo.codice_fiscale ?? '—'} />
            <Riga etichetta="Tessera CSAIN" valore={profilo.n_tessera_csain ?? '—'} />
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            Codice fiscale e tessera possono essere modificati solo dallo staff della ASD.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Recapiti</h2>
          <form onSubmit={salva} className="space-y-4">
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Telefono">
              <input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
            <button type="submit" className="btn-primary" disabled={salvo}>
              {salvo && <Spinner className="h-4 w-4" />} Salva
            </button>
          </form>
        </Card>

        {ruolo === 'ATLETA' && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-4 font-semibold text-slate-900">Il mio certificato medico</h2>
            {certificati.isLoading ? (
              <Spinner className="h-5 w-5 text-brand-600" />
            ) : (certificati.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">
                Nessun certificato registrato. Sarà lo staff della ASD a inserirne i dati.
              </p>
            ) : (
              <ul className="space-y-2">
                {(certificati.data ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-slate-800">
                        {c.tipo === 'AGONISTICO' ? 'Agonistico' : c.tipo === 'NON_AGONISTICO' ? 'Non agonistico' : 'Certificato'}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        scadenza {formatData(c.data_scadenza)}
                      </span>
                    </div>
                    {badgeScadenza(c.data_scadenza)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {ruolo === 'ATLETA' && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-4 font-semibold text-slate-900">Lo staff della tua ASD</h2>
            {staff.isLoading ? (
              <Spinner className="h-5 w-5 text-brand-600" />
            ) : (staff.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Nessuno staff da mostrare.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(staff.data ?? []).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700">{nomeCompleto(s)}</span>
                    <Badge tono="brand">{RUOLO_LABEL[s.ruolo]}</Badge>
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

function Riga({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-1.5">
      <dt className="text-slate-500">{etichetta}</dt>
      <dd className="text-right font-medium text-slate-800">{valore}</dd>
    </div>
  )
}
