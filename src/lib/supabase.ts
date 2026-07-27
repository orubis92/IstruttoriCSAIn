import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Messaggio esplicito: è l'errore più comune al primo avvio.
  // eslint-disable-next-line no-console
  console.error(
    'Configurazione Supabase mancante. Copia .env.example in .env e inserisci ' +
      'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Nome del bucket dei documenti (vedi sql/02_storage.sql). */
export const BUCKET_DOCUMENTI = 'documenti'
