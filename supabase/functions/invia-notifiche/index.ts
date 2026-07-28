// ============================================================================
//  Edge Function: invia-notifiche
//  Genera i promemoria dovuti (accoda_promemoria) e svuota la coda
//  notifiche_coda inviando davvero via Web Push (web-push) ed email (Resend).
//
//  Va richiamata periodicamente da pg_cron (vedi NOTIFICHE_SETUP.md).
//  Protetta da un segreto condiviso passato nell'header "x-cron-secret".
//
//  Secret/variabili da impostare (supabase secrets set ...):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (es. mailto:info@tuodominio)
//    RESEND_API_KEY, RESEND_FROM (es. "IstruttoriCSAIn <notifiche@tuodominio>")
//    CRON_SECRET
//  (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili in automatico.)
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const env = (k: string) => Deno.env.get(k) ?? ''

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

webpush.setVapidDetails(
  env('VAPID_SUBJECT') || 'mailto:admin@example.com',
  env('VAPID_PUBLIC_KEY'),
  env('VAPID_PRIVATE_KEY'),
)

async function inviaEmail(a: string, titolo: string, corpo: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env('RESEND_FROM') || 'onboarding@resend.dev',
      to: a,
      subject: titolo,
      text: corpo,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

Deno.serve(async (req) => {
  // Autorizzazione: solo chi conosce il segreto (pg_cron) può invocarla.
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    return new Response('Non autorizzato', { status: 401 })
  }

  // 1) genera i promemoria dovuti e gli avvisi sui certificati in scadenza/scaduti
  try {
    await supabase.rpc('accoda_promemoria')
  } catch (_) {
    // se fallisce, proseguiamo comunque a svuotare la coda esistente
  }
  try {
    await supabase.rpc('accoda_avvisi_certificati')
  } catch (_) {
    // idem: non blocca lo svuotamento della coda
  }

  // 2) svuota la coda
  const { data: righe, error } = await supabase
    .from('notifiche_coda')
    .select('*')
    .eq('stato', 'IN_ATTESA')
    .order('creato_il', { ascending: true })
    .limit(100)
  if (error) return new Response(error.message, { status: 500 })

  let inviate = 0
  let errori = 0

  for (const n of righe ?? []) {
    try {
      if (n.canale === 'EMAIL') {
        const { data: u } = await supabase
          .from('utenti')
          .select('email')
          .eq('id', n.utente_id)
          .maybeSingle()
        if (!u?.email) throw new Error('Email destinatario assente')
        await inviaEmail(u.email, n.titolo, n.corpo ?? '')
      } else {
        // PUSH: invia a tutti i dispositivi iscritti dell'utente
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('utente_id', n.utente_id)
        if (!subs || subs.length === 0) {
          // niente dispositivi: consideriamo la riga gestita per non ritentare all'infinito
          await supabase
            .from('notifiche_coda')
            .update({ stato: 'INVIATA', inviata_il: new Date().toISOString(), errore: 'nessun dispositivo' })
            .eq('id', n.id)
          continue
        }
        const payload = JSON.stringify({ title: n.titolo, body: n.corpo, url: n.url })
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
          } catch (e) {
            // iscrizione scaduta/non valida → rimuovila
            const code = (e as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', s.id)
            } else {
              throw e
            }
          }
        }
      }

      await supabase
        .from('notifiche_coda')
        .update({ stato: 'INVIATA', inviata_il: new Date().toISOString() })
        .eq('id', n.id)
      inviate++
    } catch (e) {
      errori++
      await supabase
        .from('notifiche_coda')
        .update({
          stato: (n.tentativi ?? 0) >= 3 ? 'ERRORE' : 'IN_ATTESA',
          tentativi: (n.tentativi ?? 0) + 1,
          errore: String((e as Error).message ?? e),
        })
        .eq('id', n.id)
    }
  }

  return new Response(JSON.stringify({ inviate, errori, esaminate: righe?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
