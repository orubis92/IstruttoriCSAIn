import { supabase } from '@/lib/supabase'
import type {
  Corso,
  Giornata,
  Iscrizione,
  ModelloCorso,
  ModelloGiornata,
  Presenza,
  StatoCorso,
  StatoIscrizione,
  StatoPresenza,
} from '@/lib/database.types'

// --- Corsi ---

export async function listaCorsi(): Promise<Corso[]> {
  const { data, error } = await supabase
    .from('corsi')
    .select('*')
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as Corso[]) ?? []
}

export async function getCorso(id: string): Promise<Corso | null> {
  const { data, error } = await supabase.from('corsi').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Corso) ?? null
}

export interface NuovoCorsoInput {
  asdId: string
  titolo: string
  descrizione?: string
  dataInizio?: string | null
  postiMassimi?: number | null
  creatoDa?: string | null
}

export async function creaCorsoManuale(input: NuovoCorsoInput): Promise<Corso> {
  const { data, error } = await supabase
    .from('corsi')
    .insert({
      asd_id: input.asdId,
      titolo: input.titolo,
      descrizione: input.descrizione || null,
      data_inizio: input.dataInizio || null,
      posti_massimi: input.postiMassimi || null,
      creato_da: input.creatoDa || null,
      stato: 'BOZZA',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Corso
}

/** Modalità "guidata": crea il corso e le giornate da un modello. */
export async function creaCorsoDaModello(
  modelloId: string,
  titolo: string,
  dataInizio: string | null,
  cadenzaGiorni: number,
): Promise<string> {
  const { data, error } = await supabase.rpc('crea_corso_da_modello', {
    p_modello: modelloId,
    p_titolo: titolo,
    p_data_inizio: dataInizio,
    p_cadenza_giorni: cadenzaGiorni,
  })
  if (error) throw error
  return data as string
}

export async function aggiornaCorso(id: string, patch: Partial<Corso>): Promise<void> {
  const { error } = await supabase.from('corsi').update(patch).eq('id', id)
  if (error) throw error
}

export async function cambiaStatoCorso(id: string, stato: StatoCorso): Promise<void> {
  const { error } = await supabase.from('corsi').update({ stato }).eq('id', id)
  if (error) throw error
}

export async function eliminaCorso(id: string): Promise<void> {
  const { error } = await supabase.from('corsi').delete().eq('id', id)
  if (error) throw error
}

// --- Giornate ---

export async function listaGiornate(corsoId: string): Promise<Giornata[]> {
  const { data, error } = await supabase
    .from('giornate')
    .select('*')
    .eq('corso_id', corsoId)
    .order('ordine', { ascending: true })
  if (error) throw error
  return (data as Giornata[]) ?? []
}

export interface NuovaGiornataInput {
  corsoId: string
  ordine: number
  titolo: string
  obiettivi?: string
  argomenti?: string[]
  data?: string | null
  oraInizio?: string | null
  durataMinuti?: number | null
  luogo?: string | null
}

export async function creaGiornata(input: NuovaGiornataInput): Promise<Giornata> {
  const { data, error } = await supabase
    .from('giornate')
    .insert({
      corso_id: input.corsoId,
      ordine: input.ordine,
      titolo: input.titolo,
      obiettivi: input.obiettivi || null,
      argomenti: input.argomenti ?? [],
      data: input.data || null,
      ora_inizio: input.oraInizio || null,
      durata_minuti: input.durataMinuti || null,
      luogo: input.luogo || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Giornata
}

export async function aggiornaGiornata(id: string, patch: Partial<Giornata>): Promise<void> {
  const { error } = await supabase.from('giornate').update(patch).eq('id', id)
  if (error) throw error
}

export async function eliminaGiornata(id: string): Promise<void> {
  const { error } = await supabase.from('giornate').delete().eq('id', id)
  if (error) throw error
}

// --- Modelli di corso (linee guida) ---

export async function listaModelliCorso(): Promise<ModelloCorso[]> {
  const { data, error } = await supabase
    .from('modelli_corso')
    .select('*')
    .order('titolo', { ascending: true })
  if (error) throw error
  return (data as ModelloCorso[]) ?? []
}

export async function giornateModello(modelloId: string): Promise<ModelloGiornata[]> {
  const { data, error } = await supabase
    .from('modelli_giornata')
    .select('*')
    .eq('modello_corso_id', modelloId)
    .order('ordine', { ascending: true })
  if (error) throw error
  return (data as ModelloGiornata[]) ?? []
}

// --- Iscrizioni ---

export async function listaIscrizioni(corsoId: string): Promise<Iscrizione[]> {
  const { data, error } = await supabase
    .from('iscrizioni')
    .select('*')
    .eq('corso_id', corsoId)
  if (error) throw error
  return (data as Iscrizione[]) ?? []
}

export async function mieIscrizioni(atletaId: string): Promise<Iscrizione[]> {
  const { data, error } = await supabase
    .from('iscrizioni')
    .select('*')
    .eq('atleta_id', atletaId)
  if (error) throw error
  return (data as Iscrizione[]) ?? []
}

export async function iscriviAtleta(
  corsoId: string,
  atletaId: string,
  stato: StatoIscrizione = 'ATTIVA',
): Promise<void> {
  const { error } = await supabase
    .from('iscrizioni')
    .insert({ corso_id: corsoId, atleta_id: atletaId, stato })
  if (error) throw error
}

/** Auto-candidatura dell'atleta a un corso aperto. */
export async function candidati(corsoId: string, atletaId: string): Promise<void> {
  const { error } = await supabase
    .from('iscrizioni')
    .insert({ corso_id: corsoId, atleta_id: atletaId, stato: 'RICHIESTA' })
  if (error) throw error
}

export async function aggiornaStatoIscrizione(id: string, stato: StatoIscrizione): Promise<void> {
  const { error } = await supabase.from('iscrizioni').update({ stato }).eq('id', id)
  if (error) throw error
}

export async function rimuoviIscrizione(id: string): Promise<void> {
  const { error } = await supabase.from('iscrizioni').delete().eq('id', id)
  if (error) throw error
}

// --- Presenze ---

export async function listaPresenze(giornataId: string): Promise<Presenza[]> {
  const { data, error } = await supabase
    .from('presenze')
    .select('*')
    .eq('giornata_id', giornataId)
  if (error) throw error
  return (data as Presenza[]) ?? []
}

/** Registra o aggiorna la presenza di un atleta a una giornata. */
export async function registraPresenza(
  giornataId: string,
  atletaId: string,
  stato: StatoPresenza,
  registrataDa?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('presenze')
    .upsert(
      { giornata_id: giornataId, atleta_id: atletaId, stato, registrata_da: registrataDa || null },
      { onConflict: 'giornata_id,atleta_id' },
    )
  if (error) throw error
}
