/* Gestione delle notifiche push.
   Questo file viene incluso nel service worker generato da vite-plugin-pwa
   tramite l'opzione workbox.importScripts. */

self.addEventListener('push', function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const urgente = !!data.urgente
  const title = (urgente ? '⚠️ ' : '') + (data.title || 'IstruttoriCSAIn')
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // gli avvisi urgenti restano a schermo finché non vengono aperti
        requireInteraction: urgente,
        renotify: urgente,
        tag: urgente ? 'urgente-' + Date.now() : undefined,
        data: { url: data.url || '/' },
      }),
      // avvisa le schede aperte, che aggiornano il centro notifiche
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        list.forEach(function (c) { c.postMessage({ tipo: 'notifica-push' }) })
      }),
    ]),
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
