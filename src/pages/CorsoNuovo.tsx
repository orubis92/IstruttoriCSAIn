import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wand2, PencilRuler } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  creaCorsoManuale,
  creaCorsoDaModello,
  listaModelliCorso,
  giornateModello,
} from '@/api/corsi'
import { messaggioErrore } from '@/api/errors'
import { Card, PageHeader, Field, Spinner, Alert } from '@/components/ui'

export default function CorsoNuovo() {
  const { asd, isStaff, profilo } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [modo, setModo] = useState<'guidato' | 'manuale'>('guidato')

  if (!isStaff) return <Navigate to="/corsi" replace />

  return (
    <div>
      <PageHeader titolo="Nuovo corso" sottotitolo={asd?.nome} />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => setModo('guidato')}
          className={`card flex items-center gap-3 p-4 text-left ${
            modo === 'guidato' ? 'ring-2 ring-brand-500' : ''
          }`}
        >
          <Wand2 className="h-6 w-6 text-brand-700" />
          <span>
            <span className="block font-semibold text-slate-900">Guidata</span>
            <span className="block text-xs text-slate-500">Parti da una linea guida</span>
          </span>
        </button>
        <button
          onClick={() => setModo('manuale')}
          className={`card flex items-center gap-3 p-4 text-left ${
            modo === 'manuale' ? 'ring-2 ring-brand-500' : ''
          }`}
        >
          <PencilRuler className="h-6 w-6 text-brand-700" />
          <span>
            <span className="block font-semibold text-slate-900">Manuale</span>
            <span className="block text-xs text-slate-500">Crea da zero</span>
          </span>
        </button>
      </div>

      {modo === 'guidato' ? (
        <FormGuidato
          onCreato={(id) => {
            toast.successo('Corso creato dalla linea guida.')
            navigate(`/corsi/${id}`)
          }}
        />
      ) : (
        <FormManuale
          asdId={asd?.id ?? ''}
          creatoDa={profilo?.id ?? null}
          onCreato={(id) => {
            toast.successo('Corso creato.')
            navigate(`/corsi/${id}`)
          }}
        />
      )}
    </div>
  )
}

function FormGuidato({ onCreato }: { onCreato: (id: string) => void }) {
  const toast = useToast()
  const modelli = useQuery({ queryKey: ['modelli-corso'], queryFn: listaModelliCorso })
  const [modelloId, setModelloId] = useState('')
  const [titolo, setTitolo] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [cadenza, setCadenza] = useState(7)

  const anteprima = useQuery({
    queryKey: ['modello-giornate', modelloId],
    queryFn: () => giornateModello(modelloId),
    enabled: !!modelloId,
  })

  const mut = useMutation({
    mutationFn: () => creaCorsoDaModello(modelloId, titolo, dataInizio || null, cadenza),
    onSuccess: (id) => onCreato(id),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    if (!modelloId) {
      toast.errore('Scegli una linea guida.')
      return
    }
    mut.mutate()
  }

  if (modelli.isLoading) return <Spinner className="h-6 w-6 text-brand-600" />

  if ((modelli.data ?? []).length === 0) {
    return (
      <Alert tono="giallo">
        Non ci sono ancora linee guida disponibili. Puoi crearne dallo staff/piattaforma, oppure usa
        la modalità manuale.
      </Alert>
    )
  }

  return (
    <Card className="p-5">
      <form onSubmit={invia} className="space-y-4">
        <Field label="Linea guida" obbligatorio>
          <select className="input" value={modelloId} onChange={(e) => setModelloId(e.target.value)}>
            <option value="">— Scegli —</option>
            {(modelli.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.titolo}
                {m.livello ? ` · ${m.livello}` : ''}
                {m.asd_id ? '' : ' (piattaforma)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titolo del corso" obbligatorio>
          <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data di inizio">
            <input className="input" type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
          </Field>
          <Field label="Cadenza (giorni tra le giornate)">
            <input
              className="input"
              type="number"
              min={1}
              value={cadenza}
              onChange={(e) => setCadenza(Number(e.target.value))}
            />
          </Field>
        </div>

        {anteprima.data && anteprima.data.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">
              Anteprima: verranno create {anteprima.data.length} giornate
            </p>
            <ol className="space-y-1 text-sm text-slate-600">
              {anteprima.data.map((g) => (
                <li key={g.id}>
                  {g.ordine}. {g.titolo}
                </li>
              ))}
            </ol>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={mut.isPending}>
          {mut.isPending && <Spinner className="h-4 w-4" />} Crea corso
        </button>
      </form>
    </Card>
  )
}

function FormManuale({
  asdId,
  creatoDa,
  onCreato,
}: {
  asdId: string
  creatoDa: string | null
  onCreato: (id: string) => void
}) {
  const toast = useToast()
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [dataInizio, setDataInizio] = useState('')
  const [posti, setPosti] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      creaCorsoManuale({
        asdId,
        titolo,
        descrizione,
        dataInizio: dataInizio || null,
        postiMassimi: posti ? Number(posti) : null,
        creatoDa,
      }),
    onSuccess: (c) => onCreato(c.id),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Card className="p-5">
      <form onSubmit={invia} className="space-y-4">
        <Field label="Titolo del corso" obbligatorio>
          <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
        </Field>
        <Field label="Descrizione">
          <textarea
            className="input min-h-[90px]"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data di inizio">
            <input className="input" type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
          </Field>
          <Field label="Posti massimi">
            <input className="input" type="number" min={1} value={posti} onChange={(e) => setPosti(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Dopo aver creato il corso potrai aggiungere le giornate manualmente dalla scheda del corso.
        </p>
        <button type="submit" className="btn-primary" disabled={mut.isPending}>
          {mut.isPending && <Spinner className="h-4 w-4" />} Crea corso
        </button>
      </form>
    </Card>
  )
}
