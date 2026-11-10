import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listaNotifiche } from '@/api/notifiche'
import { useAuth } from '@/context/AuthContext'

export const CHIAVE_NOTIFICHE = ['notifiche'] as const

/**
 * Casella del centro notifiche dell'utente corrente. Si aggiorna ogni minuto,
 * al ritorno sulla scheda e subito quando arriva una push (il service worker
 * avvisa le schede aperte con un messaggio).
 */
export function useNotifiche() {
  const { profilo } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const suMessaggio = (e: MessageEvent) => {
      if (e.data?.tipo === 'notifica-push') void qc.invalidateQueries({ queryKey: CHIAVE_NOTIFICHE })
    }
    navigator.serviceWorker.addEventListener('message', suMessaggio)
    return () => navigator.serviceWorker.removeEventListener('message', suMessaggio)
  }, [qc])

  const q = useQuery({
    queryKey: CHIAVE_NOTIFICHE,
    queryFn: () => listaNotifiche(),
    enabled: !!profilo,
    refetchInterval: 60_000,
  })

  const tutte = q.data ?? []
  const nonLette = tutte.filter((n) => !n.letta_il)
  const urgentiNonLette = nonLette.filter((n) => n.urgente)
  return { ...q, tutte, nonLette, urgentiNonLette }
}
