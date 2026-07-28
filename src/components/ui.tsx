import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function PageLoader({ testo = 'Caricamento…' }: { testo?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm">{testo}</p>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function PageHeader({
  titolo,
  sottotitolo,
  azioni,
}: {
  titolo: string
  sottotitolo?: string
  azioni?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titolo}</h1>
        {sottotitolo && <p className="mt-1 text-sm text-slate-500">{sottotitolo}</p>}
      </div>
      {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
    </div>
  )
}

type BadgeTono = 'grigio' | 'verde' | 'giallo' | 'rosso' | 'blu' | 'brand'
const TONO: Record<BadgeTono, string> = {
  grigio: 'bg-slate-100 text-slate-700',
  verde: 'bg-green-100 text-green-800',
  giallo: 'bg-amber-100 text-amber-800',
  rosso: 'bg-red-100 text-red-800',
  blu: 'bg-blue-100 text-blue-800',
  brand: 'bg-brand-100 text-brand-800',
}

export function Badge({ children, tono = 'grigio' }: { children: ReactNode; tono?: BadgeTono }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONO[tono]}`}>
      {children}
    </span>
  )
}

export function EmptyState({
  titolo,
  descrizione,
  icona,
  azione,
}: {
  titolo: string
  descrizione?: string
  icona?: ReactNode
  azione?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      {icona && <div className="mb-3 text-slate-300">{icona}</div>}
      <h3 className="text-base font-semibold text-slate-700">{titolo}</h3>
      {descrizione && <p className="mt-1 max-w-md text-sm text-slate-500">{descrizione}</p>}
      {azione && <div className="mt-4">{azione}</div>}
    </div>
  )
}

export function Alert({
  tono = 'blu',
  children,
}: {
  tono?: 'blu' | 'giallo' | 'rosso' | 'verde'
  children: ReactNode
}) {
  const stile = {
    blu: 'border-blue-200 bg-blue-50 text-blue-800',
    giallo: 'border-amber-200 bg-amber-50 text-amber-800',
    rosso: 'border-red-200 bg-red-50 text-red-800',
    verde: 'border-green-200 bg-green-50 text-green-800',
  }[tono]
  return <div className={`rounded-lg border px-4 py-3 text-sm ${stile}`}>{children}</div>
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  obbligatorio,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
  obbligatorio?: boolean
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label} {obbligatorio && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function Avatar({ nome, cognome }: { nome: string; cognome: string }) {
  const ini = `${nome?.[0] ?? ''}${cognome?.[0] ?? ''}`.toUpperCase() || '?'
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
      {ini}
    </span>
  )
}

export function Modal({
  titolo,
  aperto,
  onClose,
  children,
  larghezza = 'max-w-lg',
}: {
  titolo: string
  aperto: boolean
  onClose: () => void
  children: ReactNode
  larghezza?: string
}) {
  // Chiude solo se sia la pressione (mousedown) sia il rilascio (mouseup)
  // avvengono direttamente sullo sfondo. Così un clic accidentale trascinato
  // fuori da un campo — mouse giù dentro, mouse su fuori — NON chiude la
  // finestra e non fa perdere i dati inseriti.
  const pressioneSulloSfondo = useRef(false)

  if (!aperto) return null
  // Reso tramite portale sul body: così la finestra è sempre relativa alla
  // viewport e non a un eventuale contenitore con transform/backdrop-filter
  // (es. la barra in alto), che la spingerebbe fuori dallo schermo.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        pressioneSulloSfondo.current = e.target === e.currentTarget
      }}
      onMouseUp={(e) => {
        if (pressioneSulloSfondo.current && e.target === e.currentTarget) onClose()
        pressioneSulloSfondo.current = false
      }}
    >
      <div
        className={`card w-full ${larghezza} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titolo}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
