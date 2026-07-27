import { supabase, BUCKET_DOCUMENTI } from '@/lib/supabase'
import type {
  DocScope,
  DocVisibilita,
  Documento,
  TipoDocumento,
} from '@/lib/database.types'

function estensione(nomeFile: string): string {
  const p = nomeFile.lastIndexOf('.')
  return p >= 0 ? nomeFile.slice(p) : ''
}

export async function listaDocumenti(): Promise<Documento[]> {
  const { data, error } = await supabase
    .from('documenti')
    .select('*')
    .order('creato_il', { ascending: false })
  if (error) throw error
  return (data as Documento[]) ?? []
}

export interface CaricaDocumentoInput {
  file: File
  titolo: string
  descrizione?: string
  tipo: TipoDocumento
  scope: DocScope
  asdId: string | null
  visibilita: DocVisibilita | null
  /** id dell'atleta a cui il documento si riferisce (certificati, ecc.) */
  atletaRiferimento?: string | null
  /** id dell'utente che carica (per costruire il percorso e il campo caricato_da) */
  caricatoDa: string
  /** true se chi carica è un atleta (cambia la cartella di destinazione) */
  comeAtleta?: boolean
  dataScadenza?: string | null
}

/** Carica il file nello Storage e crea la riga in "documenti". */
export async function caricaDocumento(input: CaricaDocumentoInput): Promise<Documento> {
  const ext = estensione(input.file.name)
  const uid = crypto.randomUUID()

  let path: string
  if (input.scope === 'GENERALE') {
    path = `generale/${uid}${ext}`
  } else if (input.comeAtleta) {
    path = `asd/${input.asdId}/atleti/${input.caricatoDa}/${uid}${ext}`
  } else {
    path = `asd/${input.asdId}/staff/${uid}${ext}`
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('documenti')
    .insert({
      titolo: input.titolo,
      descrizione: input.descrizione || null,
      tipo: input.tipo,
      scope: input.scope,
      asd_id: input.asdId,
      visibilita: input.visibilita,
      file_path: path,
      mime_type: input.file.type || null,
      dimensione_byte: input.file.size,
      atleta_riferimento: input.atletaRiferimento || null,
      caricato_da: input.caricatoDa,
      data_scadenza: input.dataScadenza || null,
    })
    .select('*')
    .single()

  if (error) {
    // rollback del file se la riga non è stata creata
    await supabase.storage.from(BUCKET_DOCUMENTI).remove([path])
    throw error
  }
  return data as Documento
}

/** URL temporaneo firmato per scaricare/visualizzare il file. */
export async function urlDownload(path: string, secondi = 120): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .createSignedUrl(path, secondi)
  if (error) throw error
  return data.signedUrl
}

export async function eliminaDocumento(doc: Documento): Promise<void> {
  const { error } = await supabase.from('documenti').delete().eq('id', doc.id)
  if (error) throw error
  await supabase.storage.from(BUCKET_DOCUMENTI).remove([doc.file_path])
}

// --- Destinatari dei documenti privati (documento_atleti) ---

export async function destinatariDocumento(documentoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('documento_atleti')
    .select('atleta_id')
    .eq('documento_id', documentoId)
  if (error) throw error
  return (data ?? []).map((r) => (r as { atleta_id: string }).atleta_id)
}

export async function impostaDestinatari(
  documentoId: string,
  atletiIds: string[],
): Promise<void> {
  // sostituisce l'elenco: cancella e reinserisce
  const { error: delErr } = await supabase
    .from('documento_atleti')
    .delete()
    .eq('documento_id', documentoId)
  if (delErr) throw delErr
  if (atletiIds.length === 0) return
  const righe = atletiIds.map((atleta_id) => ({ documento_id: documentoId, atleta_id }))
  const { error } = await supabase.from('documento_atleti').insert(righe)
  if (error) throw error
}
