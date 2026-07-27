import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import type {
  RuoloUtente,
  StatoCorso,
  StatoIscrizione,
  StatoModulo,
  StatoPresenza,
  TipoDocumento,
} from './database.types'

export function formatData(value: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), pattern, { locale: it })
  } catch {
    return value
  }
}

export function formatDataOra(value: string | null | undefined): string {
  return formatData(value, "dd/MM/yyyy 'alle' HH:mm")
}

export function formatDimensione(byte: number | null | undefined): string {
  if (!byte) return '—'
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}

export const RUOLO_LABEL: Record<RuoloUtente, string> = {
  PROGRAMMATORE: 'Programmatore',
  AMMINISTRATORE_ASD: 'Amministratore ASD',
  ISTRUTTORE: 'Istruttore',
  ATLETA: 'Atleta',
}

export const STATO_CORSO_LABEL: Record<StatoCorso, string> = {
  BOZZA: 'Bozza',
  APERTO: 'Aperto alle iscrizioni',
  IN_CORSO: 'In corso',
  CONCLUSO: 'Concluso',
  ANNULLATO: 'Annullato',
}

export const STATO_ISCRIZIONE_LABEL: Record<StatoIscrizione, string> = {
  RICHIESTA: 'Richiesta',
  ATTIVA: 'Attiva',
  SOSPESA: 'Sospesa',
  CONCLUSA: 'Conclusa',
  RITIRATA: 'Ritirata',
}

export const STATO_PRESENZA_LABEL: Record<StatoPresenza, string> = {
  PRESENTE: 'Presente',
  ASSENTE: 'Assente',
  GIUSTIFICATO: 'Giustificato',
}

export const STATO_MODULO_LABEL: Record<StatoModulo, string> = {
  BOZZA: 'Bozza',
  INVIATO: 'Inviato',
  FIRMATO: 'Firmato',
  RIFIUTATO: 'Rifiutato',
}

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  GENERICO: 'Generico',
  CERTIFICATO_MEDICO: 'Certificato medico',
  PRIVACY: 'Privacy',
  ISCRIZIONE: 'Iscrizione',
  TESSERAMENTO: 'Tesseramento',
  MATERIALE_CORSO: 'Materiale del corso',
  REGOLAMENTO: 'Regolamento',
}

export function nomeCompleto(u: { nome: string; cognome: string } | null | undefined): string {
  if (!u) return '—'
  return `${u.nome} ${u.cognome}`.trim()
}

export function iniziali(u: { nome: string; cognome: string } | null | undefined): string {
  if (!u) return '?'
  return `${u.nome?.[0] ?? ''}${u.cognome?.[0] ?? ''}`.toUpperCase() || '?'
}
