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
  logo: string | null
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
  // Dati del genitore/tutore (per gli atleti minorenni)
  genitore_nome: string | null
  genitore_cognome: string | null
  genitore_codice_fiscale: string | null
  genitore_email: string | null
  genitore_telefono: string | null
  genitore_relazione: string | null
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

export type EsitoCorso = 'SUPERATO' | 'NON_SUPERATO'

export interface Iscrizione {
  id: string
  corso_id: string
  atleta_id: string
  asd_id: string
  stato: StatoIscrizione
  iscritto_il: string
  note: string | null
  esito: EsitoCorso | null
  valutazione: string | null
  aggiornato_il: string
}

export interface Commento {
  id: string
  asd_id: string
  corso_id: string
  giornata_id: string | null
  autore_id: string | null
  testo: string
  creato_il: string
}

export interface CorsoIstruttore {
  id: string
  corso_id: string
  asd_id: string
  istruttore_id: string
  firma: string | null
  creato_il: string
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

export type TipoCertificato = 'AGONISTICO' | 'NON_AGONISTICO'

export interface CertificatoMedico {
  id: string
  atleta_id: string
  asd_id: string
  tipo: TipoCertificato | null
  data_rilascio: string | null
  data_scadenza: string | null
  ente_rilascio: string | null
  medico: string | null
  note: string | null
  documento_id: string | null
  creato_da: string | null
  creato_il: string
  aggiornato_il: string
}

/** Riga della vista v_programmatore_corsi: metadati di un corso (no dati personali). */
export interface ProgrammatoreCorso {
  corso_id: string
  asd_id: string
  asd_nome: string
  titolo: string
  stato: StatoCorso
  data_inizio: string | null
  data_fine: string | null
  posti_massimi: number | null
  creato_il: string
  n_iscritti: number
  n_iscritti_attivi: number
}

/** Riga della vista v_programmatore_asd: aggregati per ASD (solo conteggi). */
export interface ProgrammatoreAsd {
  asd_id: string
  asd_nome: string
  attiva: boolean
  n_corsi_totali: number
  n_corsi_attivi: number
  n_corsi_conclusi: number
  n_iscrizioni_attive: number
  n_atleti: number
  n_staff: number
}

export type StatoCertificato = 'ASSENTE' | 'SCADUTO' | 'IN_SCADENZA' | 'VALIDO'

/** Riga della vista v_certificati_atleti: stato del certificato più recente. */
export interface CertificatoStato {
  atleta_id: string
  asd_id: string
  nome: string
  cognome: string
  tipo: TipoCertificato | null
  data_scadenza: string | null
  stato: StatoCertificato
  giorni_alla_scadenza: number | null
}

/** Riga del registro accessi ai dati sanitari (art. 9 GDPR). */
export interface AccessoAudit {
  id: string
  asd_id: string | null
  attore_id: string | null
  attore_nome: string | null
  oggetto_tipo: string
  oggetto_id: string | null
  atleta_id: string | null
  atleta_nome: string | null
  azione: 'LETTURA' | 'CREAZIONE' | 'MODIFICA' | 'CANCELLAZIONE'
  creato_il: string
}

export type TipoConversazione = 'DIRETTA' | 'GRUPPO'

export interface Conversazione {
  id: string
  tipo: TipoConversazione
  nome: string | null
  asd_id: string | null
  creato_da: string | null
  creato_il: string
  ultimo_messaggio_il: string
}

export interface ConversazioneMembro {
  conversazione_id: string
  utente_id: string
  aggiunto_il: string
}

export interface Messaggio {
  id: string
  conversazione_id: string
  mittente_id: string | null
  testo: string
  creato_il: string
}

export interface Contatto {
  id: string
  nome: string
  cognome: string
  ruolo: RuoloUtente
  asd_id: string | null
}

export interface ConteggioNonLetti {
  conversazione_id: string
  non_letti: number
}

export interface PreferenzeNotifiche {
  utente_id: string
  giorno_prima: boolean
  mattina: boolean
  ore_prima: number | null
  via_email: boolean
  via_push: boolean
  aggiornato_il: string
}

export type StatoProposta = 'IN_REVISIONE' | 'ACCETTATA' | 'RIFIUTATA'

/** Giornata dentro lo snapshot di una proposta o di un modello. */
export interface GiornataSnapshot {
  ordine: number
  titolo: string
  obiettivi?: string | null
  argomenti: string[]
  durata_minuti?: number | null
}

export interface PropostaCorso {
  id: string
  asd_id: string
  corso_id: string | null
  titolo: string
  descrizione: string | null
  livello: string | null
  giornate: GiornataSnapshot[]
  stato: StatoProposta
  note_revisione: string | null
  modello_id: string | null
  proposto_da: string | null
  proposto_il: string
  revisionato_da: string | null
  revisionato_il: string | null
}
