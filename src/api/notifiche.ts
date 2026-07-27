import { supabase } from '@/lib/supabase'
import type { PreferenzeNotifiche } from '@/lib/database.types'

const DEFAULT: Omit<PreferenzeNotifiche, 'utente_id' | 'aggiornato_il'> = {
  giorno_prima: true,
  mattina: false,
  ore_prima: null,
  via_email: false,
  via_push: false,
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
