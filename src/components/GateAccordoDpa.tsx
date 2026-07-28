import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileSignature } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { getDpa, accettazioneCorrente, accettaDpa, compilaTestoDpa } from '@/api/dpa'
import { messaggioErrore } from '@/api/errors'
import { Spinner, Field } from '@/components/ui'

/**
 * Schermata bloccante che obbliga ogni ASD a compilare e accettare l'accordo sul
 * trattamento dei dati (DPA) prima di usare l'applicazione. Solo un amministratore
 * può firmare; gli altri membri vedono un avviso finché la firma non è avvenuta.
 * I programmatori sono esclusi (non appartengono ad alcuna ASD).
 */
export function GateAccordoDpa() {
  const { profilo, asd, isAdmin, isProgrammatore } = useAuth()
  const toast = useToast()

  const [firmatario, setFirmatario] = useState('')
  const [ruolo, setRuolo] = useState('Legale rappresentante')
  const [denom, setDenom] = useState('')
  const [cf, setCf] = useState('')
  const [sede, setSede] = useState('')
  const [legale, setLegale] = useState('')
  const [foro, setForo] = useState('')
  const [accetta, setAccetta] = useState(false)

  const dpa = useQuery({ queryKey: ['dpa'], queryFn: getDpa })
  const acc = useQuery({
    queryKey: ['dpa-acc', asd?.id, dpa.data?.versione],
    queryFn: () => accettazioneCorrente(asd!.id, dpa.data!.versione),
    enabled: !!asd && !!dpa.data,
  })

  // Precompila i campi con i dati già noti della ASD (senza sovrascrivere ciò che
  // l'utente sta digitando).
  useEffect(() => {
    if (!asd) return
    setDenom((v) => v || asd.nome || '')
    setCf((v) => v || asd.codice_fiscale || '')
    setSede((v) => v || asd.indirizzo || '')
  }, [asd])

  const firma = useMutation({
    mutationFn: () =>
      accettaDpa({
        asdId: asd!.id,
        versione: dpa.data!.versione,
        accettatoDa: profilo!.id,
        firmatarioNome: firmatario.trim(),
        firmatarioRuolo: ruolo,
        denominazione: denom,
        codiceFiscale: cf,
        sede,
        legaleRappresentante: legale,
        foro,
      }),
    onSuccess: () => acc.refetch(),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  if (!profilo || isProgrammatore) return null
  if (!asd) return null
  if (!dpa.data || !dpa.data.testo) return null
  if (acc.isLoading || acc.data === undefined) return null
  if (acc.data) return null // già firmato per la versione corrente

  // Membri non amministratori: non possono firmare, ma l'ASD è comunque bloccata.
  if (!isAdmin) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
        <div className="card max-w-md p-6 text-center">
          <FileSignature className="mx-auto mb-3 h-8 w-8 text-brand-700" />
          <h2 className="text-lg font-semibold text-slate-900">Accordo da completare</h2>
          <p className="mt-2 text-sm text-slate-600">
            Prima di poter usare l'applicazione, un amministratore della tua ASD deve compilare e
            accettare l'accordo sul trattamento dei dati (DPA). Contatta un amministratore.
          </p>
        </div>
      </div>,
      document.body,
    )
  }

  const testo = compilaTestoDpa(dpa.data.testo, {
    denominazione: denom,
    codice_fiscale: cf,
    sede,
    legale_rappresentante: legale,
    foro,
  })

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div className="card flex max-h-[95vh] w-full max-w-3xl flex-col rounded-b-none sm:rounded-b-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <FileSignature className="h-6 w-6 text-brand-700" />
          <h2 className="text-lg font-semibold text-slate-900">
            Accordo sul trattamento dei dati (DPA)
          </h2>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-600">
            Per usare la piattaforma la tua ASD deve accettare questo accordo (art. 28 GDPR).
            Compila i dati della ASD: verranno inseriti nel testo qui sotto.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Denominazione ASD">
              <input className="input" value={denom} onChange={(e) => setDenom(e.target.value)} />
            </Field>
            <Field label="Codice fiscale / P. IVA">
              <input className="input" value={cf} onChange={(e) => setCf(e.target.value)} />
            </Field>
            <Field label="Sede">
              <input className="input" value={sede} onChange={(e) => setSede(e.target.value)} />
            </Field>
            <Field label="Legale rappresentante">
              <input className="input" value={legale} onChange={(e) => setLegale(e.target.value)} />
            </Field>
            <Field label="Foro competente">
              <input className="input" value={foro} onChange={(e) => setForo(e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="label">Testo dell'accordo</p>
            <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {testo}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome e cognome del firmatario">
              <input className="input" value={firmatario} onChange={(e) => setFirmatario(e.target.value)} />
            </Field>
            <Field label="In qualità di">
              <select className="input" value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
                <option>Legale rappresentante</option>
                <option>Presidente</option>
                <option>Amministratore</option>
                <option>Delegato</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 px-5 py-4">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={accetta}
              onChange={(e) => setAccetta(e.target.checked)}
            />
            <span>
              Dichiaro di aver letto e di accettare, in nome e per conto della ASD, l'accordo sul
              trattamento dei dati personali.
            </span>
          </label>
          <button
            className="btn-primary w-full"
            disabled={!accetta || !firmatario.trim() || firma.isPending}
            onClick={() => firma.mutate()}
          >
            {firma.isPending && <Spinner className="h-4 w-4" />} Accetta e firma
          </button>
          <p className="text-center text-xs text-slate-400">
            La firma verrà registrata con nome, data e versione del documento.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
