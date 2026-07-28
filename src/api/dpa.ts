import { supabase } from '@/lib/supabase'
import type { AccettazioneDpa, Dpa } from '@/lib/database.types'

/** Testo e versione correnti del DPA (dalle impostazioni di piattaforma). */
export async function getDpa(): Promise<Dpa> {
  const { data, error } = await supabase
    .from('impostazioni_piattaforma')
    .select('dpa_testo, dpa_versione')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  const r = data as { dpa_testo: string | null; dpa_versione: number } | null
  return { testo: r?.dpa_testo ?? null, versione: r?.dpa_versione ?? 1 }
}

/** Accettazione della ASD indicata per la versione data (null se non firmato). */
export async function accettazioneCorrente(
  asdId: string,
  versione: number,
): Promise<AccettazioneDpa | null> {
  const { data, error } = await supabase
    .from('accettazioni_dpa')
    .select('*')
    .eq('asd_id', asdId)
    .eq('versione', versione)
    .maybeSingle()
  if (error) throw error
  return (data as AccettazioneDpa) ?? null
}

export interface AccettaDpaInput {
  asdId: string
  versione: number
  accettatoDa: string
  firmatarioNome: string
  firmatarioRuolo?: string | null
  denominazione?: string | null
  codiceFiscale?: string | null
  sede?: string | null
  legaleRappresentante?: string | null
  foro?: string | null
}

export async function accettaDpa(i: AccettaDpaInput): Promise<void> {
  const { error } = await supabase.from('accettazioni_dpa').insert({
    asd_id: i.asdId,
    versione: i.versione,
    accettato_da: i.accettatoDa,
    firmatario_nome: i.firmatarioNome,
    firmatario_ruolo: i.firmatarioRuolo || null,
    denominazione: i.denominazione || null,
    codice_fiscale: i.codiceFiscale || null,
    sede: i.sede || null,
    legale_rappresentante: i.legaleRappresentante || null,
    foro: i.foro || null,
  })
  if (error) throw error
}

/** Aggiorna il testo/versione del DPA. Riservato ai programmatori (per policy). */
export async function aggiornaDpa(testo: string, versione: number): Promise<void> {
  const { error } = await supabase
    .from('impostazioni_piattaforma')
    .update({ dpa_testo: testo, dpa_versione: versione })
    .eq('id', 1)
  if (error) throw error
}

export interface DatiAsdDpa {
  denominazione?: string | null
  codice_fiscale?: string | null
  sede?: string | null
  legale_rappresentante?: string | null
  foro?: string | null
}

/** Sostituisce i segnaposto del testo del DPA con i dati della ASD. */
export function compilaTestoDpa(testo: string, d: DatiAsdDpa): string {
  const sost: Record<string, string> = {
    '[DENOMINAZIONE_ASD]': d.denominazione || '________',
    '[CF_ASD]': d.codice_fiscale || '________',
    '[SEDE_ASD]': d.sede || '________',
    '[LEGALE_RAPP_ASD]': d.legale_rappresentante || '________',
    '[FORO]': d.foro || '________',
  }
  let out = testo
  for (const [tok, val] of Object.entries(sost)) {
    out = out.split(tok).join(val)
  }
  return out
}
