import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { RuoloUtente } from '@/lib/database.types'

/** Mostra i figli solo se il ruolo dell'utente è tra quelli ammessi. */
export function RoleGate({
  ammessi,
  children,
  fallback = null,
}: {
  ammessi: RuoloUtente[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const { ruolo } = useAuth()
  if (ruolo && ammessi.includes(ruolo)) return <>{children}</>
  return <>{fallback}</>
}
