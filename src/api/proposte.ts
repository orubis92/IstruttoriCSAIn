import { supabase } from '@/lib/supabase'
import type { GiornataSnapshot, PropostaCorso } from '@/lib/database.types'

export async function listaProposte(): Promise<PropostaCorso[]> {
  const { data, error } = await supabase
    .from('proposte_corso')
    .select('*')
    .order('proposto_il', { ascending: false })
  if (error) throw error
  return (data as PropostaCorso[]) ?? []
}

export async function proposteDelCorso(corsoId: string): Promise<PropostaCorso[]> {
  const { data, error } = await supabase
    .from('proposte_corso')
    .select('*')
    .eq('corso_id', corsoId)
    .order('proposto_il', { ascending: false })
  if (error) throw error
  return (data as PropostaCorso[]) ?? []
}

export interface NuovaPropostaInput {
  asdId: string
  corsoId: string | null
  titolo: string
  descrizione?: string | null
  livello?: string | null
  giornate: GiornataSnapshot[]
  propostoDa?: string | null
}

/** Propone un corso della ASD come corso standard (in revisione ai programmatori). */
export async function creaProposta(input: NuovaPropostaInput): Promise<PropostaCorso> {
  const { data, error } = await supabase
    .from('proposte_corso')
    .insert({
      asd_id: input.asdId,
      corso_id: input.corsoId,
      titolo: input.titolo,
      descrizione: input.descrizione ?? null,
      livello: input.livello ?? null,
      giornate: input.giornate,
      proposto_da: input.propostoDa ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as PropostaCorso
}

export async function ritiraProposta(id: string): Promise<void> {
  const { error } = await supabase.from('proposte_corso').delete().eq('id', id)
  if (error) throw error
}

/** Accetta la proposta: la trasforma in corso standard di piattaforma. */
export async function accettaProposta(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('accetta_proposta', { p_proposta: id })
  if (error) throw error
  return data as string
}

export async function rifiutaProposta(id: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('rifiuta_proposta', { p_proposta: id, p_note: note })
  if (error) throw error
}
