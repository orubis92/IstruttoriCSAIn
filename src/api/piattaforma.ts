import { supabase } from '@/lib/supabase'

/** Logo CSAIN di piattaforma (data URL), o null se non impostato. */
export async function getLogoCsain(): Promise<string | null> {
  const { data, error } = await supabase
    .from('impostazioni_piattaforma')
    .select('logo_csain')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return (data as { logo_csain: string | null } | null)?.logo_csain ?? null
}

/** Imposta il logo CSAIN. Riservato ai programmatori (per policy). */
export async function aggiornaLogoCsain(logo: string | null): Promise<void> {
  const { error } = await supabase
    .from('impostazioni_piattaforma')
    .update({ logo_csain: logo })
    .eq('id', 1)
  if (error) throw error
}
