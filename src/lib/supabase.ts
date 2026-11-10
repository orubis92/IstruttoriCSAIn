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

export const isSupabaseConfigured = Boolean(url && anonKey)

// Se la configurazione manca NON chiamiamo createClient con valori vuoti:
// lancerebbe un'eccezione al caricamento e l'app resterebbe una pagina bianca.
// Con valori segnaposto l'app si avvia e mostra l'avviso di configurazione
// mancante (vedi App.tsx) invece di bloccarsi in silenzio.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://configurazione-mancante.invalid',
  isSupabaseConfigured ? anonKey : 'chiave-mancante',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** Nome del bucket dei documenti (vedi sql/02_storage.sql). */
export const BUCKET_DOCUMENTI = 'documenti'
