import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Il browser supporta le notifiche push? */
export function pushSupportato(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** È configurata la chiave pubblica VAPID? (serve per iscriversi) */
export function pushConfigurato(): boolean {
  return !!VAPID_PUBLIC
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/**
 * Richiede il permesso, iscrive il dispositivo alle notifiche push e salva
 * l'iscrizione. Da chiamare su interazione dell'utente (click su un pulsante).
 */
export async function attivaPush(utenteId: string): Promise<void> {
  if (!pushSupportato()) throw new Error('Questo browser non supporta le notifiche push.')
  if (!VAPID_PUBLIC) throw new Error('Notifiche push non ancora configurate (chiave VAPID mancante).')

  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') throw new Error('Permesso per le notifiche negato.')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8Array(VAPID_PUBLIC),
  })

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      utente_id: utenteId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Disattiva le notifiche push su questo dispositivo. */
export async function disattivaPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}
