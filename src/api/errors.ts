/** Estrae un messaggio leggibile da un errore Supabase/JS. */
export function messaggioErrore(err: unknown): string {
  if (!err) return 'Errore sconosciuto'
  if (typeof err === 'string') return err
  const e = err as { message?: string; error_description?: string; details?: string }
  const msg = e.message || e.error_description || e.details || ''

  // Traduzioni dei messaggi più comuni
  if (/Invalid login credentials/i.test(msg)) return 'Email o password non corretti.'
  if (/Email not confirmed/i.test(msg)) return 'Devi confermare l\'email prima di accedere.'
  if (/User already registered/i.test(msg)) return 'Esiste già un account con questa email.'
  if (/violates row-level security/i.test(msg))
    return 'Operazione non consentita con i tuoi permessi.'
  if (/duplicate key value/i.test(msg)) return 'Valore già presente (duplicato).'
  if (/almeno un amministratore/i.test(msg))
    return 'La ASD deve conservare almeno un amministratore attivo.'
  if (/Invito non valido/i.test(msg)) return 'Invito non valido o scaduto.'
  if (/già associato a un profilo/i.test(msg)) return 'Questo account è già collegato a un profilo.'

  return msg || 'Si è verificato un errore.'
}
