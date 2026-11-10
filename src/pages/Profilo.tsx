import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { aggiornaUtente, staffAsd } from '@/api/utenti'
import { mieiCertificati } from '@/api/certificati'
import { Link } from 'react-router-dom'
import { getPreferenze, salvaPreferenze, getPreferenzeAsd, descriviOrari } from '@/api/notifiche'
import { PannelloPush } from '@/components/PannelloPush'
import { messaggioErrore } from '@/api/errors'
import { Card, PageHeader, Field, Spinner, Badge, Alert } from '@/components/ui'
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

        {profilo && <CardNotifiche utenteId={profilo.id} asdId={profilo.asd_id} />}

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

function CardNotifiche({ utenteId, asdId }: { utenteId: string; asdId: string | null }) {
  const toast = useToast()
  const q = useQuery({ queryKey: ['preferenze', utenteId], queryFn: () => getPreferenze(utenteId) })
  const asdPref = useQuery({
    queryKey: ['preferenze-asd', asdId],
    queryFn: () => getPreferenzeAsd(asdId!),
    enabled: !!asdId,
  })

  const [usaAsd, setUsaAsd] = useState(true)
  const [giornoPrima, setGiornoPrima] = useState(true)
  const [mattina, setMattina] = useState(false)
  const [orePrima, setOrePrima] = useState('')
  const [viaPush, setViaPush] = useState(false)

  useEffect(() => {
    if (q.data) {
      setUsaAsd(!!asdId && q.data.usa_predefiniti)
      setGiornoPrima(q.data.giorno_prima)
      setMattina(q.data.mattina)
      setOrePrima(q.data.ore_prima != null ? String(q.data.ore_prima) : '')
      setViaPush(q.data.via_push)
    }
  }, [q.data, asdId])

  const mut = useMutation({
    mutationFn: () =>
      salvaPreferenze(utenteId, {
        usa_predefiniti: usaAsd,
        giorno_prima: giornoPrima,
        mattina,
        ore_prima: orePrima ? Math.min(48, Math.max(1, Number(orePrima))) : null,
        via_push: viaPush,
      }),
    onSuccess: () => {
      q.refetch()
      toast.successo('Preferenze salvate.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Notifiche</h2>
        <Link to="/notifiche" className="text-sm font-medium text-brand-700 hover:underline">
          Apri il centro notifiche →
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Avvisi e promemoria arrivano sempre nel centro notifiche dell'app. Qui scegli gli orari dei promemoria
        e se riceverli anche come push sul telefono.
      </p>
      {q.isLoading ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="label">Promemoria delle lezioni</p>
            {asdId && (
              <div className="mb-3 space-y-2">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="radio" className="mt-0.5" checked={usaAsd} onChange={() => setUsaAsd(true)} />
                  <span>
                    Usa gli orari della mia ASD
                    <span className="block text-xs text-slate-400">
                      {asdPref.data ? descriviOrari(asdPref.data) : '…'}
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" checked={!usaAsd} onChange={() => setUsaAsd(false)} />
                  Scelgo io gli orari
                </label>
              </div>
            )}
            {!usaAsd && (
              <div className={`space-y-2 ${asdId ? 'border-l-2 border-slate-100 pl-4' : ''}`}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={giornoPrima} onChange={(e) => setGiornoPrima(e.target.checked)} />
                  Il giorno prima (dalle 18)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={mattina} onChange={(e) => setMattina(e.target.checked)} />
                  La mattina della lezione
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span>Qualche ora prima:</span>
                  <input
                    type="number"
                    min={1}
                    max={48}
                    className="input w-20 py-1"
                    value={orePrima}
                    onChange={(e) => setOrePrima(e.target.value)}
                    placeholder="ore"
                  />
                  <span className="text-slate-400">(vuoto = disattivato)</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="label">Canali</p>
            {/* Il canale email resta salvato a database (via_email) ma non è ancora
                esposto: si riattiva qui quando l'invio email sarà configurato. */}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={viaPush} onChange={(e) => setViaPush(e.target.checked)} />
              <span>
                Ricevi promemoria e avvisi anche come push
                <span className="block text-xs text-slate-400">
                  Se lo togli, ti arrivano in push solo gli avvisi urgenti.
                </span>
              </span>
            </label>
            <div className="mt-3">
              <PannelloPush onCambio={() => q.refetch()} />
            </div>
          </div>

          <button className="btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva preferenze
          </button>
        </div>
      )}
    </Card>
  )
}
