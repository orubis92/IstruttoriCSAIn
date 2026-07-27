import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Target } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { messaggioErrore } from '@/api/errors'
import { Spinner, Alert } from '@/components/ui'

export default function Login() {
  const { session, signIn, signUp, loading } = useAuth()
  const toast = useToast()
  const [modo, setModo] = useState<'accedi' | 'registra'>('accedi')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invio, setInvio] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)

  if (!loading && session) return <Navigate to="/" replace />

  async function invia(e: FormEvent) {
    e.preventDefault()
    setInvio(true)
    setAvviso(null)
    try {
      if (modo === 'accedi') {
        await signIn(email, password)
      } else {
        const { needsConfirm } = await signUp(email, password)
        if (needsConfirm) {
          setAvviso('Ti abbiamo inviato un\'email di conferma. Confermala e poi accedi.')
          setModo('accedi')
        }
      }
    } catch (err) {
      toast.errore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700">
            <Target className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">IstruttoriCSAIn</h1>
          <p className="mt-1 text-sm text-slate-500">Gestione dei corsi di tiro con l'arco</p>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
            <button
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                modo === 'accedi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => setModo('accedi')}
            >
              Accedi
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                modo === 'registra' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => setModo('registra')}
            >
              Crea account
            </button>
          </div>

          {avviso && (
            <div className="mb-4">
              <Alert tono="verde">{avviso}</Alert>
            </div>
          )}

          <form onSubmit={invia} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={invio}>
              {invio && <Spinner className="h-4 w-4" />}
              {modo === 'accedi' ? 'Accedi' : 'Crea account'}
            </button>
          </form>

          {modo === 'registra' && (
            <p className="mt-4 text-center text-xs text-slate-400">
              Dopo aver creato l'account potrai registrare la tua ASD o inserire un codice invito.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
