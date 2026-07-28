import { supabase } from '@/lib/supabase'
import type { AccessoAudit } from '@/lib/database.types'

/**
 * Registro degli accessi ai dati sanitari (art. 9 GDPR).
 * Visibile per policy solo allo staff della propria ASD e ai programmatori.
 */
export async function listaAccessi(limite = 200): Promise<AccessoAudit[]> {
  const { data, error } = await supabase
    .from('audit_accessi')
    .select('*')
    .order('creato_il', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data as AccessoAudit[]) ?? []
}
