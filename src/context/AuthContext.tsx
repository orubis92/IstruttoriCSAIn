import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Asd, RuoloUtente, Utente } from '@/lib/database.types'

interface AuthState {
  session: Session | null
  profilo: Utente | null
  asd: Asd | null
  /** true finché non abbiamo determinato sessione + profilo */
  loading: boolean
  ruolo: RuoloUtente | null
  isStaff: boolean
  isAdmin: boolean
  isProgrammatore: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
  refreshProfilo: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profilo, setProfilo] = useState<Utente | null>(null)
  const [asd, setAsd] = useState<Asd | null>(null)
  const [loading, setLoading] = useState(true)

  const caricaProfilo = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfilo(null)
      setAsd(null)
      return
    }
    const { data: prof, error } = await supabase
      .from('utenti')
      .select('*')
      .eq('auth_id', userId)
      .maybeSingle()

    if (error) {
      // Non nascondiamo l'errore: aiuta a diagnosticare problemi di chiave/policy.
      // eslint-disable-next-line no-console
      console.error('Errore nel caricamento del profilo:', error.message)
    }

    setProfilo((prof as Utente) ?? null)

    if (prof?.asd_id) {
      const { data: a } = await supabase.from('asd').select('*').eq('id', prof.asd_id).maybeSingle()
      setAsd((a as Asd) ?? null)
    } else {
      setAsd(null)
    }
  }, [])

  useEffect(() => {
    let attivo = true

    // Gestisce un cambio di identità: mette loading a true PRIMA di risolvere il
    // profilo, così le rotte protette mostrano il caricamento invece di
    // reindirizzare a "/benvenuto" mentre il profilo è ancora in arrivo.
    const gestisci = async (s: Session | null) => {
      if (!attivo) return
      setLoading(true)
      setSession(s)
      await caricaProfilo(s?.user.id)
      if (attivo) setLoading(false)
    }

    // Primo caricamento
    supabase.auth.getSession().then(({ data }) => {
      void gestisci(data.session)
    })

    // Cambi successivi. Per il semplice refresh del token aggiorniamo solo la
    // sessione, senza ricaricare il profilo né mostrare il loader (niente flicker).
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(newSession)
        return
      }
      void gestisci(newSession)
    })

    return () => {
      attivo = false
      sub.subscription.unsubscribe()
    }
  }, [caricaProfilo])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return { needsConfirm: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfilo(null)
    setAsd(null)
  }, [])

  const refreshProfilo = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await caricaProfilo(data.session?.user.id)
  }, [caricaProfilo])

  const value = useMemo<AuthState>(() => {
    const ruolo = profilo?.ruolo ?? null
    return {
      session,
      profilo,
      asd,
      loading,
      ruolo,
      isStaff: ruolo === 'AMMINISTRATORE_ASD' || ruolo === 'ISTRUTTORE',
      isAdmin: ruolo === 'AMMINISTRATORE_ASD',
      isProgrammatore: ruolo === 'PROGRAMMATORE',
      signIn,
      signUp,
      signOut,
      refreshProfilo,
    }
  }, [session, profilo, asd, loading, signIn, signUp, signOut, refreshProfilo])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
  return ctx
}
