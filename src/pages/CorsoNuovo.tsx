import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wand2, PencilRuler, CalendarDays } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  creaCorsoManuale,
  creaGiornata,
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
          asdId={asd?.id ?? ''}
          creatoDa={profilo?.id ?? null}
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

interface RigaGuidata {
  ordine: number
  titolo: string
  obiettivi: string | null
  argomenti: string[]
  durataMinuti: number | null
  data: string
}

function FormGuidato({
  asdId,
  creatoDa,
  onCreato,
}: {
  asdId: string
  creatoDa: string | null
  onCreato: (id: string) => void
}) {
  const toast = useToast()
  const modelli = useQuery({ queryKey: ['modelli-corso'], queryFn: listaModelliCorso })
  const [modelloId, setModelloId] = useState('')
  const [titolo, setTitolo] = useState('')
  const [dataPrima, setDataPrima] = useState('')
  const [righe, setRighe] = useState<RigaGuidata[]>([])

  const giornateQ = useQuery({
    queryKey: ['modello-giornate', modelloId],
    queryFn: () => giornateModello(modelloId),
    enabled: !!modelloId,
  })

  // Alla scelta del modello, prepara una riga per ogni giornata (senza data).
  useEffect(() => {
    if (giornateQ.data) {
      setRighe(
        giornateQ.data.map((g) => ({
          ordine: g.ordine,
          titolo: g.titolo,
          obiettivi: g.obiettivi,
          argomenti: g.argomenti,
          durataMinuti: g.durata_minuti,
          data: '',
        })),
      )
    }
  }, [giornateQ.data])

  const setData = (i: number, val: string) =>
    setRighe((r) => r.map((x, idx) => (idx === i ? { ...x, data: val } : x)))

  // Comodità: compila le date a cadenza settimanale a partire dalla prima.
  const compilaSettimanale = () => {
    if (!dataPrima) {
      toast.errore('Indica prima la data della prima giornata.')
      return
    }
    const base = parseISO(dataPrima)
    setRighe((r) => r.map((x, idx) => ({ ...x, data: format(addDays(base, idx * 7), 'yyyy-MM-dd') })))
  }

  const mut = useMutation({
    mutationFn: async () => {
      const date = righe
        .map((r) => r.data)
        .filter(Boolean)
        .sort()
      const corso = await creaCorsoManuale({
        asdId,
        titolo,
        dataInizio: date[0] ?? null,
        creatoDa,
      })
      for (const r of righe) {
        await creaGiornata({
          corsoId: corso.id,
          ordine: r.ordine,
          titolo: r.titolo,
          obiettivi: r.obiettivi ?? undefined,
          argomenti: r.argomenti,
          data: r.data || null,
          durataMinuti: r.durataMinuti,
        })
      }
      return corso.id
    },
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
        Non ci sono ancora linee guida disponibili. Puoi crearne dalla sezione Standard (programmatore),
        oppure usa la modalità manuale.
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

        {righe.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
              <div className="flex-1">
                <label className="label">Data della prima giornata</label>
                <input
                  className="input"
                  type="date"
                  value={dataPrima}
                  onChange={(e) => setDataPrima(e.target.value)}
                />
              </div>
              <button type="button" className="btn-secondary" onClick={compilaSettimanale}>
                <CalendarDays className="h-4 w-4" /> Compila settimanale
              </button>
            </div>

            <div>
              <p className="label">Date delle giornate</p>
              <p className="mb-2 text-xs text-slate-400">
                Assegna a ogni giornata la sua data. Puoi impostarle una per una o usare la compilazione
                settimanale qui sopra come punto di partenza.
              </p>
              <div className="space-y-2">
                {righe.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                      {r.ordine}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.titolo}</span>
                    <input
                      className="input w-auto py-1"
                      type="date"
                      value={r.data}
                      onChange={(e) => setData(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button type="submit" className="btn-primary" disabled={mut.isPending || righe.length === 0}>
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
