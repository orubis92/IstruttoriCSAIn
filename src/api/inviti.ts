import { supabase } from '@/lib/supabase'
import type { Invito } from '@/lib/database.types'

/** Collega l'account di login corrente a un profilo creato dallo staff. */
export async function accettaInvito(codice: string): Promise<string> {
  const { data, error } = await supabase.rpc('accetta_invito', { p_codice: codice })
  if (error) throw error
  return data as string
}

/** Crea un invito per un profilo e restituisce il codice da consegnare. */
export async function creaInvito(utenteId: string): Promise<Invito> {
  const { data, error } = await supabase
    .from('inviti')
    .insert({ utente_id: utenteId })
    .select('*')
    .single()
  if (error) throw error
  return data as Invito
}

/** Inviti ancora validi per un dato utente. */
export async function invitiPerUtente(utenteId: string): Promise<Invito[]> {
  const { data, error } = await supabase
    .from('inviti')
    .select('*')
    .eq('utente_id', utenteId)
    .is('usato_il', null)
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as Invito[]) ?? []
}
