import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { registraAsd } from '@/api/asd'
import { accettaInvito } from '@/api/inviti'
import { messaggioErrore } from '@/api/errors'
import { Spinner } from '@/components/ui'

export default function Benvenuto() {
  const { refreshProfilo, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [scelta, setScelta] = useState<'menu' | 'asd' | 'invito'>('menu')
  const [invio, setInvio] = useState(false)

  // form ASD
  const [nomeAsd, setNomeAsd] = useState('')
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [codiceCsain, setCodiceCsain] = useState('')

  // form invito
  const [codice, setCodice] = useState('')

  async function inviaAsd(e: FormEvent) {
    e.preventDefault()
    setInvio(true)
    try {
      await registraAsd({ nomeAsd, nome, cognome, codiceCsain: codiceCsain || undefined })
      await refreshProfilo()
      toast.successo('ASD registrata. Benvenuto!')
      navigate('/', { replace: true })
    } catch (err) {
      toast.errore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  async function inviaInvito(e: FormEvent) {
    e.preventDefault()
    setInvio(true)
    try {
      await accettaInvito(codice.trim())
      await refreshProfilo()
      toast.successo('Profilo attivato. Benvenuto!')
      navigate('/', { replace: true })
    } catch (err) {
      toast.errore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold text-slate-900">Benvenuto!</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Il tuo account non è ancora collegato a un profilo. Scegli come procedere.
        </p>

        {scelta === 'menu' && (
          <div className="space-y-3">
            <button
              onClick={() => setScelta('asd')}
              className="card flex w-full items-center gap-4 p-5 text-left transition-shadow hover:shadow-md"
            >
              <Building2 className="h-9 w-9 shrink-0 text-brand-700" />
              <span>
                <span className="block font-semibold text-slate-900">Registra la tua ASD</span>
                <span className="block text-sm text-slate-500">
                  Crei una nuova ASD e ne diventi amministratore.
                </span>
              </span>
            </button>
            <button
              onClick={() => setScelta('invito')}
              className="card flex w-full items-center gap-4 p-5 text-left transition-shadow hover:shadow-md"
            >
              <KeyRound className="h-9 w-9 shrink-0 text-brand-700" />
              <span>
                <span className="block font-semibold text-slate-900">Ho un codice invito</span>
                <span className="block text-sm text-slate-500">
                  Ti è stato fornito dallo staff della tua ASD.
                </span>
              </span>
            </button>
            <button onClick={() => signOut()} className="btn-ghost mx-auto mt-2 flex text-sm">
              <LogOut className="h-4 w-4" /> Esci
            </button>
          </div>
        )}

        {scelta === 'asd' && (
          <form onSubmit={inviaAsd} className="card space-y-4 p-6">
            <h2 className="font-semibold text-slate-900">Registra la tua ASD</h2>
            <div>
              <label className="label">Nome della ASD *</label>
              <input className="input" value={nomeAsd} onChange={(e) => setNomeAsd(e.target.value)} required />
            </div>
            <div>
              <label className="label">Codice affiliazione CSAIN</label>
              <input className="input" value={codiceCsain} onChange={(e) => setCodiceCsain(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Il tuo nome *</label>
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div>
                <label className="label">Il tuo cognome *</label>
                <input className="input" value={cognome} onChange={(e) => setCognome(e.target.value)} required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setScelta('menu')}>
                Indietro
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={invio}>
                {invio && <Spinner className="h-4 w-4" />} Registra ASD
              </button>
            </div>
          </form>
        )}

        {scelta === 'invito' && (
          <form onSubmit={inviaInvito} className="card space-y-4 p-6">
            <h2 className="font-semibold text-slate-900">Inserisci il codice invito</h2>
            <div>
              <label className="label">Codice invito *</label>
              <input
                className="input font-mono"
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
                placeholder="es. 4f8a1c…"
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setScelta('menu')}>
                Indietro
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={invio}>
                {invio && <Spinner className="h-4 w-4" />} Attiva profilo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
