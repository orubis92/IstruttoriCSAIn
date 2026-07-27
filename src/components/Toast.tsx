import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type Tono = 'successo' | 'errore' | 'info'
interface ToastItem {
  id: number
  tono: Tono
  testo: string
}

interface ToastApi {
  successo: (t: string) => void
  errore: (t: string) => void
  info: (t: string) => void
}

const ToastContext = createContext<ToastApi | undefined>(undefined)

let contatore = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const rimuovi = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const aggiungi = useCallback(
    (tono: Tono, testo: string) => {
      const id = ++contatore
      setItems((prev) => [...prev, { id, tono, testo }])
      setTimeout(() => rimuovi(id), 4500)
    },
    [rimuovi],
  )

  const api: ToastApi = {
    successo: (t) => aggiungi('successo', t),
    errore: (t) => aggiungi('errore', t),
    info: (t) => aggiungi('info', t),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg"
          >
            {i.tono === 'successo' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />}
            {i.tono === 'errore' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
            {i.tono === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />}
            <p className="flex-1 text-sm text-slate-700">{i.testo}</p>
            <button onClick={() => rimuovi(i.id)} aria-label="Chiudi">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>')
  return ctx
}
