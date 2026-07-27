import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { PageLoader } from '@/components/ui'

/** Richiede una sessione attiva. Se manca il profilo, manda all'onboarding. */
export function RequireProfilo({ children }: { children: ReactNode }) {
  const { session, profilo, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (!profilo) return <Navigate to="/benvenuto" replace />
  return <>{children}</>
}

/** Richiede solo una sessione (usata per l'onboarding, prima del profilo). */
export function RequireSessione({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
