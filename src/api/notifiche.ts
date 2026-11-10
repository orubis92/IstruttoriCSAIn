import { supabase } from '@/lib/supabase'
import type {
  Avviso,
  Notifica,
  PreferenzeNotifiche,
  PreferenzeNotificheAsd,
  StatoInvioNotifiche,
} from '@/lib/database.types'

// ---------------------------------------------------------------------------
//  Preferenze personali
// ---------------------------------------------------------------------------
const DEFAULT: Omit<PreferenzeNotifiche, 'utente_id' | 'aggiornato_il'> = {
  giorno_prima: true,
  mattina: false,
  ore_prima: null,
  via_email: false,
  via_push: false,
  usa_predefiniti: true,
}

export async function getPreferenze(utenteId: string): Promise<PreferenzeNotifiche> {
  const { data, error } = await supabase
    .from('preferenze_notifiche')
    .select('*')
    .eq('utente_id', utenteId)
    .maybeSingle()
  if (error) throw error
  if (data) return data as PreferenzeNotifiche
  return { utente_id: utenteId, aggiornato_il: '', ...DEFAULT }
}

export async function salvaPreferenze(
  utenteId: string,
  patch: Partial<Omit<PreferenzeNotifiche, 'utente_id' | 'aggiornato_il'>>,
): Promise<void> {
  // upsert: le colonne non passate mantengono il valore esistente (o il default all'inserimento)
  const { error } = await supabase
    .from('preferenze_notifiche')
    .upsert(
      { utente_id: utenteId, ...patch, aggiornato_il: new Date().toISOString() },
      { onConflict: 'utente_id' },
    )
  if (error) throw error
}

// ---------------------------------------------------------------------------
//  Preferenze predefinite della ASD (decise dall'amministratore)
// ---------------------------------------------------------------------------
export const DEFAULT_ASD: Omit<PreferenzeNotificheAsd, 'asd_id' | 'aggiornato_il'> = {
  giorno_prima: true,
  mattina: false,
  ore_prima: null,
}

export async function getPreferenzeAsd(asdId: string): Promise<PreferenzeNotificheAsd> {
  const { data, error } = await supabase
    .from('preferenze_notifiche_asd')
    .select('*')
    .eq('asd_id', asdId)
    .maybeSingle()
  if (error) throw error
  if (data) return data as PreferenzeNotificheAsd
  return { asd_id: asdId, aggiornato_il: '', ...DEFAULT_ASD }
}

export async function salvaPreferenzeAsd(
  asdId: string,
  valori: Omit<PreferenzeNotificheAsd, 'asd_id' | 'aggiornato_il'>,
): Promise<void> {
  const { error } = await supabase
    .from('preferenze_notifiche_asd')
    .upsert(
      { asd_id: asdId, ...valori, aggiornato_il: new Date().toISOString() },
      { onConflict: 'asd_id' },
    )
  if (error) throw error
}

/** Descrizione leggibile degli orari dei promemoria. */
export function descriviOrari(p: { giorno_prima: boolean; mattina: boolean; ore_prima: number | null }): string {
  const voci: string[] = []
  if (p.giorno_prima) voci.push('il giorno prima (dalle 18)')
  if (p.mattina) voci.push('la mattina della lezione')
  if (p.ore_prima) voci.push(`${p.ore_prima} ${p.ore_prima === 1 ? 'ora' : 'ore'} prima`)
  return voci.length ? voci.join(', ') : 'nessun promemoria'
}

// ---------------------------------------------------------------------------
//  Centro notifiche
// ---------------------------------------------------------------------------
export async function listaNotifiche(limite = 100): Promise<Notifica[]> {
  const { data, error } = await supabase
    .from('notifiche')
    .select('*')
    .order('creato_il', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as Notifica[]
}

export async function segnaLetta(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifiche')
    .update({ letta_il: new Date().toISOString() })
    .eq('id', id)
    .is('letta_il', null)
  if (error) throw error
}

export async function segnaTutteLette(): Promise<void> {
  const { error } = await supabase
    .from('notifiche')
    .update({ letta_il: new Date().toISOString() })
    .is('letta_il', null)
  if (error) throw error
}

export async function eliminaNotifica(id: string): Promise<void> {
  const { error } = await supabase.from('notifiche').delete().eq('id', id)
  if (error) throw error
}

export async function eliminaNotificheLette(): Promise<void> {
  const { error } = await supabase.from('notifiche').delete().not('letta_il', 'is', null)
  if (error) throw error
}

// ---------------------------------------------------------------------------
//  Avvisi
// ---------------------------------------------------------------------------
/** Staff → atleti del corso. Ritorna il numero di destinatari raggiunti. */
export async function inviaAvvisoCorso(
  corsoId: string,
  titolo: string,
  testo: string,
  urgente: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('invia_avviso_corso', {
    p_corso: corsoId,
    p_titolo: titolo,
    p_testo: testo,
    p_urgente: urgente,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function listaAvvisiCorso(corsoId: string): Promise<Avviso[]> {
  const { data, error } = await supabase
    .from('avvisi')
    .select('*')
    .eq('corso_id', corsoId)
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data ?? []) as Avviso[]
}

/** Programmatore → staff o tutti i membri delle ASD. */
export async function inviaAvvisoPiattaforma(
  titolo: string,
  testo: string,
  destinatari: 'STAFF' | 'TUTTI',
  urgente: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('invia_avviso_piattaforma', {
    p_titolo: titolo,
    p_testo: testo,
    p_destinatari: destinatari,
    p_urgente: urgente,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function listaAvvisiPiattaforma(): Promise<Avviso[]> {
  const { data, error } = await supabase
    .from('avvisi')
    .select('*')
    .is('asd_id', null)
    .order('creato_il', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as Avviso[]
}

// ---------------------------------------------------------------------------
//  Prova e stato dell'invio
// ---------------------------------------------------------------------------
export async function inviaNotificaProva(): Promise<{ dispositivi: number; coda_id: string | null }> {
  const { data, error } = await supabase.rpc('invia_notifica_prova')
  if (error) throw error
  return data as { dispositivi: number; coda_id: string | null }
}

/** Stato della riga di coda creata dalla notifica di prova. */
export async function statoRigaCoda(
  id: string,
): Promise<{ stato: 'IN_ATTESA' | 'INVIATA' | 'ERRORE'; errore: string | null; inviata_il: string | null } | null> {
  const { data, error } = await supabase
    .from('notifiche_coda')
    .select('stato, errore, inviata_il')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as { stato: 'IN_ATTESA' | 'INVIATA' | 'ERRORE'; errore: string | null; inviata_il: string | null } | null
}

/** Scarta le push/email in coda da oltre 12 ore (solo programmatori). */
export async function scartaNotificheScadute(): Promise<number> {
  const { data, error } = await supabase.rpc('scarta_notifiche_scadute')
  if (error) throw error
  return Number(data ?? 0)
}

export async function statoInvioNotifiche(): Promise<StatoInvioNotifiche> {
  const { data, error } = await supabase.rpc('stato_invio_notifiche')
  if (error) throw error
  return data as StatoInvioNotifiche
}
