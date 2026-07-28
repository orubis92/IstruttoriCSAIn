import { supabase } from '@/lib/supabase'
import type { CertificatoMedico, CertificatoStato, TipoCertificato } from '@/lib/database.types'

/**
 * Legge i certificati di un atleta passando dalla RPC dedicata: quando a leggere
 * è un membro dello staff (non l'atleta stesso), l'accesso ai dati sanitari viene
 * registrato nel registro accessi (art. 9 GDPR).
 */
export async function certificatiAtleta(atletaId: string): Promise<CertificatoMedico[]> {
  const { data, error } = await supabase.rpc('leggi_certificati_atleta', { p_atleta: atletaId })
  if (error) throw error
  return (data as CertificatoMedico[]) ?? []
}

/** Stato del certificato più recente per gli atleti visibili (vista v_certificati_atleti). */
export async function statoCertificati(): Promise<CertificatoStato[]> {
  const { data, error } = await supabase
    .from('v_certificati_atleti')
    .select('*')
    .order('data_scadenza', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data as CertificatoStato[]) ?? []
}

export async function mieiCertificati(): Promise<CertificatoMedico[]> {
  const { data, error } = await supabase
    .from('certificati_medici')
    .select('*')
    .order('data_scadenza', { ascending: false })
  if (error) throw error
  return (data as CertificatoMedico[]) ?? []
}

export interface NuovoCertificatoInput {
  atletaId: string
  asdId: string
  tipo: TipoCertificato | null
  dataRilascio?: string | null
  dataScadenza?: string | null
  enteRilascio?: string | null
  medico?: string | null
  note?: string | null
  creatoDa?: string | null
}

export async function creaCertificato(input: NuovoCertificatoInput): Promise<CertificatoMedico> {
  const { data, error } = await supabase
    .from('certificati_medici')
    .insert({
      atleta_id: input.atletaId,
      asd_id: input.asdId,
      tipo: input.tipo,
      data_rilascio: input.dataRilascio || null,
      data_scadenza: input.dataScadenza || null,
      ente_rilascio: input.enteRilascio || null,
      medico: input.medico || null,
      note: input.note || null,
      creato_da: input.creatoDa || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CertificatoMedico
}

export async function eliminaCertificato(id: string): Promise<void> {
  const { error } = await supabase.from('certificati_medici').delete().eq('id', id)
  if (error) throw error
}
