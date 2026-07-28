import * as Sentry from '@sentry/react'

/**
 * Inizializza il monitoraggio degli errori (Sentry) SOLO se è configurato il DSN
 * in VITE_SENTRY_DSN. Senza DSN la funzione non fa nulla: l'app funziona
 * ugualmente e in sviluppo non invia nulla. Il DSN è pubblico per natura (come
 * la chiave anon di Supabase): può stare nel frontend.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Tracciamento prestazioni leggero; alza/abbassa in base ai volumi.
    tracesSampleRate: 0.1,
    // Non inviare dati personali per impostazione predefinita.
    sendDefaultPii: false,
  })
}

export { Sentry }
