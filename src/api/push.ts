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

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type StatoPushDispositivo =
  | 'non_supportato'   // browser senza Push API (es. iPhone fuori dalla Home)
  | 'non_configurato'  // manca la chiave VAPID pubblica nella build
  | 'negato'           // l'utente ha bloccato le notifiche per il sito
  | 'non_attivo'       // permesso non ancora chiesto o dispositivo non iscritto
  | 'attivo'           // dispositivo iscritto e registrato

/** Stato delle push su QUESTO dispositivo. */
export async function statoPushDispositivo(): Promise<StatoPushDispositivo> {
  if (!pushSupportato()) return 'non_supportato'
  if (!VAPID_PUBLIC) return 'non_configurato'
  if (Notification.permission === 'denied') return 'negato'
  if (Notification.permission !== 'granted') return 'non_attivo'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return 'non_attivo'
    // verifica che il server conosca questo dispositivo per l'utente corrente
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', sub.endpoint)
      .maybeSingle()
    return data ? 'attivo' : 'non_attivo'
  } catch {
    return 'non_attivo'
  }
}

/**
 * Richiede il permesso, iscrive il dispositivo alle notifiche push e salva
 * l'iscrizione (che attiva anche il canale push nelle preferenze).
 * Da chiamare su interazione dell'utente (click su un pulsante).
 */
export async function attivaPush(): Promise<void> {
  if (!pushSupportato()) throw new Error('Questo browser non supporta le notifiche push.')
  if (!VAPID_PUBLIC) throw new Error('Notifiche push non ancora configurate (chiave VAPID mancante).')

  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') throw new Error('Permesso per le notifiche negato.')

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(VAPID_PUBLIC),
    }))

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.rpc('registra_push', {
    p_endpoint: json.endpoint ?? '',
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
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

/**
 * Mostra subito una notifica locale (senza passare dal server): verifica che
 * permesso e service worker funzionino su questo dispositivo.
 */
export async function notificaLocaleDiProva(): Promise<void> {
  if (!pushSupportato()) throw new Error('Questo browser non supporta le notifiche.')
  if (Notification.permission !== 'granted') throw new Error('Permesso per le notifiche non concesso.')
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Prova locale', {
    body: 'Il dispositivo sa mostrare le notifiche. Ora prova anche quella dal server.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/notifiche' },
  })
}
