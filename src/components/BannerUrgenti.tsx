import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { useNotifiche, CHIAVE_NOTIFICHE } from '@/hooks/useNotifiche'
import { segnaLetta } from '@/api/notifiche'

/**
 * Avvisi urgenti non ancora letti, in cima a ogni pagina: restano visibili
 * finché l'utente non li conferma con "Ho letto".
 */
export function BannerUrgenti() {
  const { urgentiNonLette } = useNotifiche()
  const qc = useQueryClient()
  const navigate = useNavigate()
  if (urgentiNonLette.length === 0) return null

  async function letto(id: string) {
    try {
      await segnaLetta(id)
    } finally {
      void qc.invalidateQueries({ queryKey: CHIAVE_NOTIFICHE })
    }
  }

  return (
    <div className="mb-4 space-y-2">
      {urgentiNonLette.slice(0, 3).map((n) => (
        <div key={n.id} role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-900">{n.titolo}</p>
            {n.corpo && <p className="mt-0.5 whitespace-pre-line break-words text-sm text-red-800">{n.corpo}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => letto(n.id)}>
                Ho letto
              </button>
              {n.url && n.url !== '/notifiche' && (
                <button
                  className="btn-ghost px-3 py-1 text-xs text-red-700"
                  onClick={() => {
                    void letto(n.id)
                    navigate(n.url!)
                  }}
                >
                  Apri
                </button>
              )}
            </div>
          </div>
          <button className="icon-btn -mr-2 -mt-1 text-red-400" aria-label="Segna come letto" onClick={() => letto(n.id)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {urgentiNonLette.length > 3 && (
        <button className="text-sm font-medium text-red-700 hover:underline" onClick={() => navigate('/notifiche')}>
          Altri {urgentiNonLette.length - 3} avvisi urgenti →
        </button>
      )}
    </div>
  )
}
