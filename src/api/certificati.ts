import { supabase } from '@/lib/supabase'
import type { CertificatoMedico, TipoCertificato } from '@/lib/database.types'

export async function certificatiAtleta(atletaId: string): Promise<CertificatoMedico[]> {
  const { data, error } = await supabase
    .from('certificati_medici')
    .select('*')
    .eq('atleta_id', atletaId)
    .order('data_scadenza', { ascending: false })
  if (error) throw error
  return (data as CertificatoMedico[]) ?? []
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
