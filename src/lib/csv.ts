// Utilità per esportare dati in CSV lato client (nessun invio al server).
// Il CSV usa il punto e virgola come separatore e include il BOM UTF-8, così
// Excel in italiano apre correttamente le colonne e gli accenti.

export interface ColonnaCsv<T> {
  intestazione: string
  valore: (riga: T) => string | number | null | undefined
}

function cella(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // Racchiude tra virgolette se contiene separatore, virgolette o a capo.
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function costruisciCsv<T>(righe: T[], colonne: ColonnaCsv<T>[]): string {
  const testa = colonne.map((c) => cella(c.intestazione)).join(';')
  const corpo = righe
    .map((r) => colonne.map((c) => cella(c.valore(r))).join(';'))
    .join('\r\n')
  return testa + '\r\n' + corpo
}

/** Genera e scarica un file CSV nel browser. */
export function scaricaCsv<T>(nomeFile: string, righe: T[], colonne: ColonnaCsv<T>[]): void {
  const csv = costruisciCsv(righe, colonne)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile.endsWith('.csv') ? nomeFile : `${nomeFile}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
