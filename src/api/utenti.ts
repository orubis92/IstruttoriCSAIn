import { supabase } from '@/lib/supabase'
import type { RuoloUtente, StaffAsd, Utente } from '@/lib/database.types'

export async function listaMembri(): Promise<Utente[]> {
  const { data, error } = await supabase
    .from('utenti')
    .select('*')
    .order('cognome', { ascending: true })
  if (error) throw error
  return (data as Utente[]) ?? []
}

export async function getUtente(id: string): Promise<Utente | null> {
  const { data, error } = await supabase.from('utenti').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Utente) ?? null
}

/** Dati del genitore/tutore, per gli atleti minorenni. */
export interface GenitoreInput {
  genitoreNome?: string | null
  genitoreCognome?: string | null
  genitoreCodiceFiscale?: string | null
  genitoreEmail?: string | null
  genitoreTelefono?: string | null
  genitoreRelazione?: string | null
}

export interface NuovoUtenteInput extends GenitoreInput {
  ruolo: RuoloUtente
  asdId: string
  nome: string
  cognome: string
  dataNascita?: string | null
  codiceFiscale?: string | null
  nTesseraCsain?: string | null
  email?: string | null
  telefono?: string | null
  creatoDa?: string | null
}

function campiGenitore(input: GenitoreInput) {
  return {
    genitore_nome: input.genitoreNome || null,
    genitore_cognome: input.genitoreCognome || null,
    genitore_codice_fiscale: input.genitoreCodiceFiscale || null,
    genitore_email: input.genitoreEmail || null,
    genitore_telefono: input.genitoreTelefono || null,
    genitore_relazione: input.genitoreRelazione || null,
  }
}

/**
 * Crea l'anagrafica di un nuovo membro (senza account di login).
 * L'attivazione avviene poi tramite invito.
 */
export async function creaUtente(input: NuovoUtenteInput): Promise<Utente> {
  const { data, error } = await supabase
    .from('utenti')
    .insert({
      ruolo: input.ruolo,
      asd_id: input.asdId,
      nome: input.nome,
      cognome: input.cognome,
      data_nascita: input.dataNascita || null,
      codice_fiscale: input.codiceFiscale || null,
      n_tessera_csain: input.nTesseraCsain || null,
      email: input.email || null,
      telefono: input.telefono || null,
      creato_da: input.creatoDa || null,
      ...campiGenitore(input),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Utente
}

/** Aggiorna i recapiti/anagrafica non sensibili (compresi i dati del genitore). */
export async function aggiornaUtente(
  id: string,
  patch: Partial<
    Pick<
      Utente,
      | 'nome'
      | 'cognome'
      | 'data_nascita'
      | 'email'
      | 'telefono'
      | 'ruolo'
      | 'attivo'
      | 'genitore_nome'
      | 'genitore_cognome'
      | 'genitore_codice_fiscale'
      | 'genitore_email'
      | 'genitore_telefono'
      | 'genitore_relazione'
    >
  >,
): Promise<void> {
  const { error } = await supabase.from('utenti').update(patch).eq('id', id)
  if (error) throw error
}

/** Codice fiscale e tessera passano dalla funzione dedicata (riservata allo staff). */
export async function aggiornaDatiAnagrafici(
  utenteId: string,
  codiceFiscale?: string | null,
  nTessera?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('aggiorna_dati_anagrafici', {
    p_utente: utenteId,
    p_codice_fiscale: codiceFiscale ?? null,
    p_n_tessera_csain: nTessera ?? null,
  })
  if (error) throw error
}

export async function attivaDisattiva(id: string, attivo: boolean): Promise<void> {
  const { error } = await supabase.from('utenti').update({ attivo }).eq('id', id)
  if (error) throw error
}

/** Elenco (sola lettura) dello staff della propria ASD, per gli atleti. */
export async function staffAsd(): Promise<StaffAsd[]> {
  const { data, error } = await supabase.from('v_staff_asd').select('*')
  if (error) throw error
  return (data as StaffAsd[]) ?? []
}
