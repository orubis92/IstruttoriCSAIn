import { supabase } from '@/lib/supabase'
import type {
  Contatto,
  Conversazione,
  ConversazioneMembro,
  Messaggio,
} from '@/lib/database.types'

export async function listaConversazioni(): Promise<Conversazione[]> {
  const { data, error } = await supabase
    .from('conversazioni')
    .select('*')
    .order('ultimo_messaggio_il', { ascending: false })
  if (error) throw error
  return (data as Conversazione[]) ?? []
}

/** Tutti i membri delle conversazioni visibili (per etichettare le chat). */
export async function tuttiIMembri(): Promise<ConversazioneMembro[]> {
  const { data, error } = await supabase.from('conversazione_membri').select('*')
  if (error) throw error
  return (data as ConversazioneMembro[]) ?? []
}

export async function messaggi(conversazioneId: string): Promise<Messaggio[]> {
  const { data, error } = await supabase
    .from('messaggi')
    .select('*')
    .eq('conversazione_id', conversazioneId)
    .order('creato_il', { ascending: true })
  if (error) throw error
  return (data as Messaggio[]) ?? []
}

export async function inviaMessaggio(
  conversazioneId: string,
  mittenteId: string,
  testo: string,
): Promise<void> {
  const { error } = await supabase
    .from('messaggi')
    .insert({ conversazione_id: conversazioneId, mittente_id: mittenteId, testo })
  if (error) throw error
}

export async function listaContatti(): Promise<Contatto[]> {
  const { data, error } = await supabase
    .from('v_contatti')
    .select('*')
    .order('cognome', { ascending: true })
  if (error) throw error
  return (data as Contatto[]) ?? []
}

export async function creaDiretta(altroUtenteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('crea_conversazione_diretta', { p_altro: altroUtenteId })
  if (error) throw error
  return data as string
}

export async function creaGruppo(nome: string, membri: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('crea_gruppo', { p_nome: nome, p_membri: membri })
  if (error) throw error
  return data as string
}
