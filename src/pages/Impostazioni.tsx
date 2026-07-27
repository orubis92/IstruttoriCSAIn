import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { aggiornaAsd } from '@/api/asd'
import { getLogoCsain, aggiornaLogoCsain } from '@/api/piattaforma'
import { messaggioErrore } from '@/api/errors'
import { Card, PageHeader, Field, Spinner, Alert } from '@/components/ui'

/** Ridimensiona un'immagine e la restituisce come data URL (per il logo). */
function ridimensiona(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scala = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scala)
        const h = Math.round(img.height * scala)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non disponibile'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Impostazioni() {
  const { asd, isAdmin, isProgrammatore, refreshProfilo } = useAuth()
  const toast = useToast()

  const [nome, setNome] = useState(asd?.nome ?? '')
  const [csain, setCsain] = useState(asd?.codice_affiliazione_csain ?? '')
  const [cf, setCf] = useState(asd?.codice_fiscale ?? '')
  const [email, setEmail] = useState(asd?.email ?? '')
  const [telefono, setTelefono] = useState(asd?.telefono ?? '')
  const [indirizzo, setIndirizzo] = useState(asd?.indirizzo ?? '')

  const salvaDati = useMutation({
    mutationFn: () =>
      aggiornaAsd(asd!.id, {
        nome,
        codice_affiliazione_csain: csain || null,
        codice_fiscale: cf || null,
        email: email || null,
        telefono: telefono || null,
        indirizzo: indirizzo || null,
      }),
    onSuccess: async () => {
      await refreshProfilo()
      toast.successo('Dati aggiornati.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const salvaLogo = useMutation({
    mutationFn: (logo: string | null) => aggiornaAsd(asd!.id, { logo }),
    onSuccess: async () => {
      await refreshProfilo()
      toast.successo('Logo aggiornato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  async function scegliLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await ridimensiona(file)
      salvaLogo.mutate(dataUrl)
    } catch (err) {
      toast.errore(messaggioErrore(err))
    }
  }

  // Programmatore senza ASD: mostra solo la gestione del logo CSAIN.
  if (!asd) {
    return (
      <div>
        <PageHeader titolo="Impostazioni" sottotitolo={isProgrammatore ? 'Piattaforma' : undefined} />
        {isProgrammatore ? (
          <SezioneLogoCsain />
        ) : (
          <Alert tono="blu">
            Il tuo account non è associato a una ASD, quindi non ci sono dati da configurare qui.
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader titolo="Impostazioni" sottotitolo={asd.nome} />

      <div className="grid gap-4 lg:grid-cols-2">
        {isProgrammatore && (
          <div className="lg:col-span-2">
            <SezioneLogoCsain />
          </div>
        )}
        {/* Logo */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-900">Logo della ASD</h2>
          <p className="mb-4 text-sm text-slate-500">
            Compare in alto a sinistra nell'app e sui diplomi stampati. Consigliata un'immagine
            quadrata (PNG con sfondo trasparente).
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {asd.logo ? (
                <img src={asd.logo} alt="Logo" className="max-h-20 max-w-20" />
              ) : (
                <ImagePlus className="h-8 w-8 text-slate-300" />
              )}
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer">
                  <ImagePlus className="h-4 w-4" />
                  {salvaLogo.isPending ? 'Caricamento…' : asd.logo ? 'Cambia logo' : 'Carica logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={scegliLogo} />
                </label>
                {asd.logo && (
                  <button
                    className="btn-ghost text-red-600"
                    onClick={() => salvaLogo.mutate(null)}
                    disabled={salvaLogo.isPending}
                  >
                    <Trash2 className="h-4 w-4" /> Rimuovi
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Solo l'amministratore può modificare il logo.</p>
            )}
          </div>
        </Card>

        {/* Dati generali */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Dati della ASD</h2>
          {isAdmin ? (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                salvaDati.mutate()
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Field label="Nome della ASD" obbligatorio>
                  <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </Field>
              </div>
              <Field label="Codice affiliazione CSAIN">
                <input className="input" value={csain} onChange={(e) => setCsain(e.target.value)} />
              </Field>
              <Field label="Codice fiscale / P.IVA">
                <input className="input" value={cf} onChange={(e) => setCf(e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Telefono">
                <input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Indirizzo">
                  <input className="input" value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={salvaDati.isPending}>
                  {salvaDati.isPending && <Spinner className="h-4 w-4" />} Salva dati
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <Riga etichetta="Nome" valore={asd.nome} />
              <Riga etichetta="Codice CSAIN" valore={asd.codice_affiliazione_csain ?? '—'} />
              <Riga etichetta="Email" valore={asd.email ?? '—'} />
              <Riga etichetta="Telefono" valore={asd.telefono ?? '—'} />
              <Riga etichetta="Indirizzo" valore={asd.indirizzo ?? '—'} />
              <p className="pt-2 text-xs text-slate-400">
                Solo l'amministratore della ASD può modificare questi dati.
              </p>
            </dl>
          )}
        </Card>
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

function SezioneLogoCsain() {
  const toast = useToast()
  const qc = useQueryClient()
  const logo = useQuery({ queryKey: ['logo-csain'], queryFn: getLogoCsain })

  const salva = useMutation({
    mutationFn: (dataUrl: string | null) => aggiornaLogoCsain(dataUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logo-csain'] })
      toast.successo('Logo CSAIN aggiornato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  async function scegli(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      salva.mutate(await ridimensiona(file))
    } catch (err) {
      toast.errore(messaggioErrore(err))
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold text-slate-900">Logo CSAIN (piattaforma)</h2>
      <p className="mb-4 text-sm text-slate-500">
        Valido per tutte le ASD. Compare a sinistra del logo di ogni ASD nell'app e in alto a destra
        sui diplomi stampati. Modificabile solo dai programmatori.
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {logo.data ? (
            <img src={logo.data} alt="Logo CSAIN" className="max-h-20 max-w-20 object-contain" />
          ) : (
            <ImagePlus className="h-8 w-8 text-slate-300" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <ImagePlus className="h-4 w-4" />
            {salva.isPending ? 'Caricamento…' : logo.data ? 'Cambia logo' : 'Carica logo'}
            <input type="file" accept="image/*" className="hidden" onChange={scegli} />
          </label>
          {logo.data && (
            <button
              className="btn-ghost text-red-600"
              onClick={() => salva.mutate(null)}
              disabled={salva.isPending}
            >
              <Trash2 className="h-4 w-4" /> Rimuovi
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
