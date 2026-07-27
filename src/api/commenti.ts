import { supabase } from '@/lib/supabase'
import type { Commento } from '@/lib/database.types'

export async function commentiCorso(corsoId: string): Promise<Commento[]> {
  const { data, error } = await supabase
    .from('commenti')
    .select('*')
    .eq('corso_id', corsoId)
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as Commento[]) ?? []
}

export interface NuovoCommentoInput {
  asdId: string
  corsoId: string
  giornataId?: string | null
  autoreId: string
  testo: string
}

export async function creaCommento(input: NuovoCommentoInput): Promise<Commento> {
  const { data, error } = await supabase
    .from('commenti')
    .insert({
      asd_id: input.asdId,
      corso_id: input.corsoId,
      giornata_id: input.giornataId ?? null,
      autore_id: input.autoreId,
      testo: input.testo,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Commento
}

export async function eliminaCommento(id: string): Promise<void> {
  const { error } = await supabase.from('commenti').delete().eq('id', id)
  if (error) throw error
}
