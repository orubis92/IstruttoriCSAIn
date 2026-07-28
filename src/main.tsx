import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/Toast'
import { initSentry, Sentry } from '@/lib/sentry'
import { Alert } from '@/components/ui'
import App from '@/App'
import './index.css'

initSentry()

// Schermata di ripiego se un errore non gestito fa crashare l'interfaccia.
function ErroreApp() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Alert tono="rosso">
        Si è verificato un errore imprevisto. Ricarica la pagina; se il problema persiste,
        segnalalo alla tua ASD.
      </Alert>
      <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
        Ricarica
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErroreApp />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
