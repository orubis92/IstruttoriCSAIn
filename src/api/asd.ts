import { supabase } from '@/lib/supabase'
import type { Asd } from '@/lib/database.types'

export interface RegistraAsdInput {
  nomeAsd: string
  nome: string
  cognome: string
  codiceCsain?: string
  email?: string
}

/** Iscrive una nuova ASD e rende chi chiama il primo amministratore. */
export async function registraAsd(input: RegistraAsdInput): Promise<string> {
  const { data, error } = await supabase.rpc('registra_asd', {
    p_nome_asd: input.nomeAsd,
    p_nome: input.nome,
    p_cognome: input.cognome,
    p_codice_csain: input.codiceCsain ?? null,
    p_email: input.email ?? null,
  })
  if (error) throw error
  return data as string
}

export async function getAsd(id: string): Promise<Asd | null> {
  const { data, error } = await supabase.from('asd').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Asd) ?? null
}

export async function aggiornaAsd(id: string, patch: Partial<Asd>): Promise<void> {
  const { error } = await supabase.from('asd').update(patch).eq('id', id)
  if (error) throw error
}
