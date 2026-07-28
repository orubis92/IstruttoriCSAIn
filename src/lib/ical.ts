// Generazione di un file calendario (.ics) dalle giornate di un corso, da
// aggiungere al calendario del telefono/PC. Usa orari "locali" (floating), così
// l'evento compare all'ora indicata sul dispositivo di chi lo importa.

import type { Giornata } from '@/lib/database.types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// 'YYYY-MM-DD' + 'HH:MM[:SS]' -> 'YYYYMMDDTHHMMSS'
function dataOra(data: string, ora: string): string {
  const [y, m, d] = data.split('-')
  const [hh = '0', mm = '0', ss = '0'] = ora.split(':')
  return `${y}${m}${d}T${pad(Number(hh))}${pad(Number(mm))}${pad(Number(ss))}`
}

// inizio + durata (minuti) -> 'YYYYMMDDTHHMMSS' (calcolo in ora locale)
function fine(data: string, ora: string, minuti: number): string {
  const [y, m, d] = data.split('-').map(Number)
  const [hh = 0, mm = 0] = ora.split(':').map(Number)
  const dt = new Date(y, m - 1, d, hh, mm)
  dt.setMinutes(dt.getMinutes() + minuti)
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
}

function nomeFileSicuro(titolo: string): string {
  return (
    titolo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'corso'
  )
}

/** Costruisce il contenuto .ics dalle giornate (solo quelle con una data). */
export function costruisciIcsCorso(corsoTitolo: string, giornate: Giornata[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IstruttoriCSAIn//Corsi//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const g of giornate) {
    if (!g.data) continue
    righe.push('BEGIN:VEVENT')
    righe.push(`UID:${g.id}@istruttoricsain`)
    righe.push(`DTSTAMP:${stamp}`)
    if (g.ora_inizio) {
      righe.push(`DTSTART:${dataOra(g.data, g.ora_inizio)}`)
      righe.push(`DTEND:${fine(g.data, g.ora_inizio, g.durata_minuti ?? 60)}`)
    } else {
      const [y, m, d] = g.data.split('-')
      righe.push(`DTSTART;VALUE=DATE:${y}${m}${d}`)
    }
    righe.push(`SUMMARY:${escapeIcs(`${g.titolo} — ${corsoTitolo}`)}`)
    if (g.luogo) righe.push(`LOCATION:${escapeIcs(g.luogo)}`)
    const descr = [
      g.obiettivi ?? '',
      g.argomenti && g.argomenti.length ? `Argomenti: ${g.argomenti.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    if (descr) righe.push(`DESCRIPTION:${escapeIcs(descr)}`)
    righe.push('END:VEVENT')
  }
  righe.push('END:VCALENDAR')
  return righe.join('\r\n')
}

/** Genera e scarica il file .ics del corso. */
export function scaricaIcsCorso(corsoTitolo: string, giornate: Giornata[]): void {
  const ics = costruisciIcsCorso(corsoTitolo, giornate)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calendario-${nomeFileSicuro(corsoTitolo)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
