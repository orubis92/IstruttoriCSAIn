import { supabase } from '@/lib/supabase'
import type { ModelloModulo, ModuloCompilato, StatoModulo } from '@/lib/database.types'

export async function listaModelliModulo(): Promise<ModelloModulo[]> {
  const { data, error } = await supabase
    .from('modelli_modulo')
    .select('*')
    .eq('attivo', true)
    .order('titolo', { ascending: true })
  if (error) throw error
  return (data as ModelloModulo[]) ?? []
}

export async function listaModuliCompilati(): Promise<ModuloCompilato[]> {
  const { data, error } = await supabase
    .from('moduli_compilati')
    .select('*')
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as ModuloCompilato[]) ?? []
}

export async function moduliAtleta(atletaId: string): Promise<ModuloCompilato[]> {
  const { data, error } = await supabase
    .from('moduli_compilati')
    .select('*')
    .eq('atleta_id', atletaId)
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as ModuloCompilato[]) ?? []
}

export interface CompilaModuloInput {
  modelloId: string
  asdId: string
  atletaId: string
  corsoId?: string | null
  dati: Record<string, unknown>
}

export async function creaModuloCompilato(input: CompilaModuloInput): Promise<ModuloCompilato> {
  const { data, error } = await supabase
    .from('moduli_compilati')
    .insert({
      modello_id: input.modelloId,
      asd_id: input.asdId,
      atleta_id: input.atletaId,
      corso_id: input.corsoId || null,
      dati: input.dati,
      stato: 'BOZZA',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ModuloCompilato
}

export async function aggiornaDatiModulo(
  id: string,
  dati: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('moduli_compilati').update({ dati }).eq('id', id)
  if (error) throw error
}

export async function cambiaStatoModulo(id: string, stato: StatoModulo): Promise<void> {
  const { error } = await supabase.from('moduli_compilati').update({ stato }).eq('id', id)
  if (error) throw error
}
