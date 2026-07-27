// Tipi che rispecchiano lo schema del database (vedi sql/00_schema.sql).
// Mantieni allineato questo file allo schema quando modifichi le tabelle.

export type RuoloUtente =
  | 'PROGRAMMATORE'
  | 'AMMINISTRATORE_ASD'
  | 'ISTRUTTORE'
  | 'ATLETA'

export type DocScope = 'GENERALE' | 'ASD'
export type DocVisibilita = 'PUBBLICO' | 'PRIVATO'

export type TipoDocumento =
  | 'GENERICO'
  | 'CERTIFICATO_MEDICO'
  | 'PRIVACY'
  | 'ISCRIZIONE'
  | 'TESSERAMENTO'
  | 'MATERIALE_CORSO'
  | 'REGOLAMENTO'

export type StatoCorso = 'BOZZA' | 'APERTO' | 'IN_CORSO' | 'CONCLUSO' | 'ANNULLATO'
export type StatoGiornata = 'PIANIFICATA' | 'SVOLTA' | 'ANNULLATA'
export type StatoIscrizione = 'RICHIESTA' | 'ATTIVA' | 'SOSPESA' | 'CONCLUSA' | 'RITIRATA'
export type StatoPresenza = 'PRESENTE' | 'ASSENTE' | 'GIUSTIFICATO'
export type StatoModulo = 'BOZZA' | 'INVIATO' | 'FIRMATO' | 'RIFIUTATO'

export interface Asd {
  id: string
  nome: string
  codice_affiliazione_csain: string | null
  codice_fiscale: string | null
  email: string | null
  telefono: string | null
  indirizzo: string | null
  attiva: boolean
  creata_il: string
  aggiornata_il: string
}

export interface Utente {
  id: string
  auth_id: string | null
  ruolo: RuoloUtente
  asd_id: string | null
  nome: string
  cognome: string
  data_nascita: string | null
  codice_fiscale: string | null
  n_tessera_csain: string | null
  email: string | null
  telefono: string | null
  attivo: boolean
  creato_da: string | null
  creato_il: string
  aggiornato_il: string
}

export interface Invito {
  id: string
  utente_id: string
  codice: string
  scade_il: string
  usato_il: string | null
  creato_da: string | null
  creato_il: string
}

export interface Documento {
  id: string
  titolo: string
  descrizione: string | null
  tipo: TipoDocumento
  scope: DocScope
  asd_id: string | null
  visibilita: DocVisibilita | null
  file_path: string
  mime_type: string | null
  dimensione_byte: number | null
  data_scadenza: string | null
  atleta_riferimento: string | null
  caricato_da: string | null
  creato_il: string
  aggiornato_il: string
}

export interface DocumentoAtleta {
  documento_id: string
  atleta_id: string
  asd_id: string
}

export interface ModelloCorso {
  id: string
  asd_id: string | null
  titolo: string
  descrizione: string | null
  livello: string | null
  creato_da: string | null
  creato_il: string
  aggiornato_il: string
}

export interface ModelloGiornata {
  id: string
  modello_corso_id: string
  ordine: number
  titolo: string
  obiettivi: string | null
  argomenti: string[]
  durata_minuti: number | null
}

export interface Corso {
  id: string
  asd_id: string
  titolo: string
  descrizione: string | null
  stato: StatoCorso
  data_inizio: string | null
  data_fine: string | null
  posti_massimi: number | null
  responsabile: string | null
  creato_da: string | null
  creato_il: string
  aggiornato_il: string
}

export interface Giornata {
  id: string
  corso_id: string
  asd_id: string
  ordine: number
  titolo: string
  obiettivi: string | null
  argomenti: string[]
  data: string | null
  ora_inizio: string | null
  durata_minuti: number | null
  luogo: string | null
  note: string | null
  stato: StatoGiornata
  creato_il: string
  aggiornato_il: string
}

export interface Iscrizione {
  id: string
  corso_id: string
  atleta_id: string
  asd_id: string
  stato: StatoIscrizione
  iscritto_il: string
  note: string | null
  aggiornato_il: string
}

export interface Presenza {
  id: string
  giornata_id: string
  atleta_id: string
  asd_id: string
  stato: StatoPresenza
  note: string | null
  registrata_da: string | null
  registrata_il: string
}

export interface CampoModulo {
  nome: string
  etichetta: string
  tipo: 'testo' | 'numero' | 'data' | 'checkbox' | 'testo_lungo' | 'email'
  obbligatorio?: boolean
}

export interface ModelloModulo {
  id: string
  asd_id: string | null
  codice: string
  titolo: string
  descrizione: string | null
  versione: number
  schema_campi: CampoModulo[]
  testo_legale: string | null
  richiede_firma: boolean
  attivo: boolean
  creato_il: string
  aggiornato_il: string
}

export interface ModuloCompilato {
  id: string
  modello_id: string
  asd_id: string
  atleta_id: string
  corso_id: string | null
  dati: Record<string, unknown>
  stato: StatoModulo
  firmato_il: string | null
  firma_path: string | null
  pdf_path: string | null
  creato_il: string
  aggiornato_il: string
}

export interface StaffAsd {
  id: string
  asd_id: string
  nome: string
  cognome: string
  ruolo: RuoloUtente
}
