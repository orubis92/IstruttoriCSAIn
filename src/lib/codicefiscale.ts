// Validazione del codice fiscale delle persone fisiche (16 caratteri):
// controllo di formato + carattere di controllo, e (facoltativo) coerenza tra il
// codice e la data di nascita. Gestisce l'omocodia (cifre sostituite da lettere).

const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}
const RESTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
// Lettere usate nell'omocodia per rappresentare le cifre 0-9 (in ordine).
const OMOCODIA = 'LMNPQRSTUV'
const MESI = 'ABCDEHLMPRST' // gennaio=A, febbraio=B, ... dicembre=T

function valorePari(c: string): number {
  return /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65
}

/** Cifra "reale" di un carattere che potrebbe essere omocodico (lettera→cifra). */
function cifra(c: string): string {
  if (/[0-9]/.test(c)) return c
  const i = OMOCODIA.indexOf(c)
  return i >= 0 ? String(i) : c
}

export interface EsitoCF {
  valido: boolean
  motivo?: string
}

/**
 * Valida un codice fiscale di persona fisica. Un valore vuoto è considerato
 * "valido" (il campo è facoltativo): la validazione scatta solo se compilato.
 */
export function validaCodiceFiscale(cfInput: string | null | undefined): EsitoCF {
  const cf = (cfInput ?? '').trim().toUpperCase()
  if (cf === '') return { valido: true }
  if (cf.length !== 16) return { valido: false, motivo: 'Deve avere 16 caratteri' }
  if (!/^[A-Z0-9]{16}$/.test(cf)) return { valido: false, motivo: 'Contiene caratteri non ammessi' }
  // Struttura: 6 lettere (cognome+nome), poi campi con possibile omocodia, check finale.
  if (!/^[A-Z]{6}[0-9A-Z]{2}[A-Z][0-9A-Z]{2}[A-Z][0-9A-Z]{3}[A-Z]$/.test(cf)) {
    return { valido: false, motivo: 'Formato non corretto' }
  }
  let somma = 0
  for (let i = 0; i < 15; i++) {
    const c = cf[i]
    somma += (i % 2 === 0 ? DISPARI[c] : valorePari(c)) // posizione 1-based dispari = indice 0
  }
  const atteso = RESTO[somma % 26]
  if (atteso !== cf[15]) return { valido: false, motivo: 'Carattere di controllo errato' }
  return { valido: true }
}

/** Estrae giorno, mese (1-12) e sesso dal codice fiscale, gestendo l'omocodia. */
export function datiDaCodiceFiscale(cfInput: string): { giorno: number; mese: number; sesso: 'M' | 'F' } | null {
  const cf = cfInput.trim().toUpperCase()
  if (validaCodiceFiscale(cf).valido !== true || cf === '') return null
  const mese = MESI.indexOf(cf[8]) + 1
  if (mese === 0) return null
  let giorno = Number(cifra(cf[9]) + cifra(cf[10]))
  const sesso: 'M' | 'F' = giorno > 40 ? 'F' : 'M'
  if (sesso === 'F') giorno -= 40
  if (giorno < 1 || giorno > 31) return null
  return { giorno, mese, sesso }
}

/**
 * Verifica che il codice fiscale sia coerente con la data di nascita indicata
 * (giorno e mese). Restituisce true anche se uno dei due manca o il CF non è
 * valido: la coerenza è un controllo aggiuntivo, non sostituisce la validazione.
 */
export function coerenteConData(cf: string | null | undefined, dataNascita: string | null | undefined): boolean {
  if (!cf || !dataNascita) return true
  const dati = datiDaCodiceFiscale(cf)
  if (!dati) return true
  const m = dataNascita.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return true
  return dati.giorno === Number(m[3]) && dati.mese === Number(m[2])
}
