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

// --- Informativa privacy e consensi ---

export interface Privacy {
  testo: string | null
  versione: number
}

export async function getPrivacy(): Promise<Privacy> {
  const { data, error } = await supabase
    .from('impostazioni_piattaforma')
    .select('privacy_testo, privacy_versione')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  const r = data as { privacy_testo: string | null; privacy_versione: number } | null
  return { testo: r?.privacy_testo ?? null, versione: r?.privacy_versione ?? 1 }
}

export async function aggiornaPrivacy(testo: string, versione: number): Promise<void> {
  const { error } = await supabase
    .from('impostazioni_piattaforma')
    .update({ privacy_testo: testo, privacy_versione: versione })
    .eq('id', 1)
  if (error) throw error
}

export async function haConsensoPrivacy(utenteId: string, versione: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('consensi_privacy')
    .select('utente_id')
    .eq('utente_id', utenteId)
    .eq('versione', versione)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function registraConsensoPrivacy(utenteId: string, versione: number): Promise<void> {
  const { error } = await supabase
    .from('consensi_privacy')
    .insert({ utente_id: utenteId, versione })
  if (error) throw error
}
