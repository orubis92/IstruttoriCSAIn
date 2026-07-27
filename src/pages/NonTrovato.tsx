import { Link } from 'react-router-dom'

export default function NonTrovato() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-brand-700">404</p>
      <p className="text-slate-600">La pagina che cerchi non esiste.</p>
      <Link to="/" className="btn-primary">
        Torna al cruscotto
      </Link>
    </div>
  )
}
