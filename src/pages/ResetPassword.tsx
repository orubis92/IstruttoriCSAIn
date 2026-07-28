import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Target } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { messaggioErrore } from '@/api/errors'
import { supabase } from '@/lib/supabase'
import { Spinner, Alert } from '@/components/ui'

const LUNGHEZZA_MINIMA = 8

export default function ResetPassword() {
  const navigate = useNavigate()
  const toast = useToast()
  // null = ancora in verifica; true/false = esito della sessione di recupero.
  const [sessioneValida, setSessioneValida] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    let attivo = true

    // Il link nell'email crea una sessione di recupero (evento PASSWORD_RECOVERY,
    // elaborato automaticamente grazie a detectSessionInUrl). Ci sottoscriviamo
    // per intercettarlo e, in parallelo, controlliamo se una sessione è già presente.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!attivo) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessioneValida(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!attivo) return
      // Non sovrascriviamo un esito positivo già ricevuto dall'evento.
      setSessioneValida((prev) => (prev === true ? prev : Boolean(data.session)))
    })

    return () => {
      attivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function invia(e: FormEvent) {
    e.preventDefault()
    if (password.length < LUNGHEZZA_MINIMA) {
      toast.errore(`La password deve avere almeno ${LUNGHEZZA_MINIMA} caratteri.`)
      return
    }
    if (password !== conferma) {
      toast.errore('Le due password non coincidono.')
      return
    }
    setInvio(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.successo('Password aggiornata. Ora puoi accedere.')
      navigate('/login', { replace: true })
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
          <h1 className="text-2xl font-bold text-slate-900">Reimposta la password</h1>
          <p className="mt-1 text-sm text-slate-500">Scegli una nuova password per il tuo account</p>
        </div>

        <div className="card p-6">
          {sessioneValida === null && (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-500">
              <Spinner className="h-5 w-5 text-brand-600" />
              <span className="text-sm">Verifica del link in corso…</span>
            </div>
          )}

          {sessioneValida === false && (
            <div className="space-y-4">
              <Alert tono="giallo">
                Link non valido o scaduto. Apri questa pagina dal link ricevuto via email, oppure
                richiedi un nuovo reset della password.
              </Alert>
              <Link to="/login" className="btn-primary w-full justify-center">
                Torna al login
              </Link>
            </div>
          )}

          {sessioneValida === true && (
            <form onSubmit={invia} className="space-y-4">
              <div>
                <label className="label" htmlFor="password">
                  Nuova password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={LUNGHEZZA_MINIMA}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="conferma">
                  Conferma password
                </label>
                <input
                  id="conferma"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  value={conferma}
                  onChange={(e) => setConferma(e.target.value)}
                  minLength={LUNGHEZZA_MINIMA}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={invio}>
                {invio && <Spinner className="h-4 w-4" />}
                Aggiorna password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
