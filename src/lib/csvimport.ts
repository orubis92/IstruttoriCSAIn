// Lettura di un file CSV lato client per l'import massivo. Riconosce il
// separatore (';' o ','), gestisce virgolette e campi su più righe, e rimuove
// il BOM iniziale prodotto da Excel.

export interface CsvLetto {
  intestazioni: string[]
  righe: string[][]
}

export function leggiCsv(testo: string): CsvLetto {
  let t = testo.replace(/^﻿/, '')
  // Rileva il separatore dalla prima riga.
  const primaRiga = t.slice(0, t.search(/\r?\n/) >= 0 ? t.search(/\r?\n/) : t.length)
  const sep = primaRiga.split(';').length > primaRiga.split(',').length ? ';' : ','

  const righe: string[][] = []
  let campo = ''
  let riga: string[] = []
  let inVirgolette = false

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inVirgolette) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          inVirgolette = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      inVirgolette = true
    } else if (c === sep) {
      riga.push(campo)
      campo = ''
    } else if (c === '\n') {
      riga.push(campo)
      righe.push(riga)
      riga = []
      campo = ''
    } else if (c === '\r') {
      // ignorato: gestito insieme a \n
    } else {
      campo += c
    }
  }
  if (campo.length > 0 || riga.length > 0) {
    riga.push(campo)
    righe.push(riga)
  }

  const pulite = righe.filter((r) => r.some((cell) => cell.trim() !== ''))
  const intestazioni = (pulite.shift() ?? []).map((h) => h.trim())
  return { intestazioni, righe: pulite }
}

/** Normalizza un'intestazione: minuscolo, senza accenti né spazi ai bordi. */
export function normalizzaIntestazione(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Converte una data in formato ISO 'YYYY-MM-DD'. Accetta 'gg/mm/aaaa',
 * 'gg-mm-aaaa' e 'aaaa-mm-gg'. Restituisce null se non riconosciuta.
 */
export function dataIso(valore: string): string | null {
  const v = valore.trim()
  if (!v) return null
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}
