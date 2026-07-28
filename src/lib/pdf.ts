// Generazione PDF lato client (nessun invio al server) per diplomi e report
// presenze dei corsi. Usa jsPDF + jspdf-autotable, già presenti fra le
// dipendenze del progetto. Le funzioni qui NON eseguono query: ricevono i dati
// già caricati dalle pagine (corso, giornate, presenze, iscritti, ecc.).

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { scaricaCsv, type ColonnaCsv } from '@/lib/csv'
import { formatData } from '@/lib/format'
import type { AccettazioneDpa, Corso, Giornata, Presenza, StatoPresenza, EsitoCorso } from '@/lib/database.types'

// Colore brand-700 (#262a5a) usato per bordi/testi in evidenza sui documenti.
const BRAND: [number, number, number] = [38, 42, 90]
const GRIGIO: [number, number, number] = [100, 116, 139]

// Lettera sintetica mostrata in tabella/CSV per lo stato di presenza.
const LETTERA_PRESENZA: Record<StatoPresenza, string> = {
  PRESENTE: 'P',
  ASSENTE: 'A',
  GIUSTIFICATO: 'G',
}

/**
 * Aggiunge un'immagine (data URL) al PDF in modo difensivo: se il formato non è
 * riconosciuto da jsPDF o l'immagine è malformata, l'errore viene ignorato e il
 * documento viene generato comunque senza logo/firma.
 */
function aggiungiImmagine(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  larghezza: number,
  altezza: number,
): boolean {
  if (!dataUrl) return false
  try {
    // Con un data URL jsPDF ricava il formato dal prefisso; passiamo comunque
    // una stringa vuota come formato per lasciarglielo dedurre.
    doc.addImage(dataUrl, '', x, y, larghezza, altezza)
    return true
  } catch {
    return false
  }
}

// --- Diplomi ---------------------------------------------------------------

/** Un atleta da diplomare, con i dati già risolti dalla pagina. */
export interface DiplomaAtleta {
  atletaId: string
  nomeCompleto: string
  esito: EsitoCorso | null
  valutazione: string | null
}

/** Un istruttore firmatario del diploma. */
export interface IstruttoreDiploma {
  nomeCompleto: string
  firma: string | null // data URL della firma, se presente
}

export interface DiplomiPdfOpts {
  corso: Pick<Corso, 'titolo' | 'data_inizio'>
  asdNome: string
  /** Logo dell'ASD come data URL (opzionale). */
  asdLogo?: string | null
  /** Logo CSAIN come data URL (opzionale). */
  logoCsain?: string | null
  giornate: Giornata[]
  presenze: Presenza[]
  istruttori: IstruttoreDiploma[]
  atleti: DiplomaAtleta[]
}

/**
 * Genera un unico PDF (una pagina A4 orizzontale per atleta) con i diplomi del
 * corso, replicando le informazioni mostrate nella pagina DiplomiCorso:
 * attestato, nome atleta, titolo corso, lezioni frequentate, argomenti trattati
 * e firme degli istruttori.
 */
export function scaricaDiplomiPdf(opts: DiplomiPdfOpts): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const larghezzaPagina = doc.internal.pageSize.getWidth() // ~297 mm
  const centro = larghezzaPagina / 2

  // Giornate a cui l'atleta è risultato PRESENTE, in ordine.
  const giornatePresenti = (atletaId: string): Giornata[] =>
    opts.giornate.filter((g) =>
      opts.presenze.some(
        (p) => p.giornata_id === g.id && p.atleta_id === atletaId && p.stato === 'PRESENTE',
      ),
    )

  opts.atleti.forEach((atleta, indice) => {
    if (indice > 0) doc.addPage()

    // Bordo decorativo brand.
    doc.setDrawColor(...BRAND)
    doc.setLineWidth(1.5)
    doc.rect(8, 8, larghezzaPagina - 16, doc.internal.pageSize.getHeight() - 16)

    // Intestazione: logo + nome ASD a sinistra, CSAIN a destra.
    aggiungiImmagine(doc, opts.asdLogo, 16, 14, 16, 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text(opts.asdNome || 'ASD', opts.asdLogo ? 35 : 16, 24)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRIGIO)
    const testoCsain = "Tiro con l'arco · CSAIN"
    doc.text(testoCsain, larghezzaPagina - 34, 22, { align: 'right' })
    aggiungiImmagine(doc, opts.logoCsain, larghezzaPagina - 32, 14, 16, 16)

    // Titolo attestato.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...BRAND)
    doc.text('DIPLOMA DI PARTECIPAZIONE', centro, 48, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...GRIGIO)
    doc.text('Si attesta che', centro, 60, { align: 'center' })

    // Nome atleta.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(30)
    doc.setTextColor(15, 23, 42)
    doc.text(atleta.nomeCompleto || '—', centro, 74, { align: 'center' })

    // Frase di partecipazione (con eventuale data di inizio ed esito).
    const inizio = opts.corso.data_inizio ? ` con inizio il ${formatData(opts.corso.data_inizio)}` : ''
    const esitoTxt = atleta.esito === 'SUPERATO' ? ', superandolo con esito positivo' : ''
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(51, 65, 85)
    const frase = `ha partecipato al corso "${opts.corso.titolo}"${inizio}${esitoTxt}.`
    const righeFrase = doc.splitTextToSize(frase, 220)
    doc.text(righeFrase, centro, 86, { align: 'center' })

    // Due colonne: lezioni frequentate / argomenti trattati.
    const presenti = giornatePresenti(atleta.atletaId)
    const argomenti = Array.from(
      new Set((presenti.length > 0 ? presenti : opts.giornate).flatMap((g) => g.argomenti ?? [])),
    )

    const colY = 104
    const colSx = 30
    const colDx = centro + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...GRIGIO)
    doc.text(
      `LEZIONI FREQUENTATE (${presenti.length}/${opts.giornate.length})`,
      colSx,
      colY,
    )
    doc.text('ARGOMENTI TRATTATI', colDx, colY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    const righeLezioni =
      presenti.length === 0
        ? ['—']
        : presenti.map(
            (g) => `${g.ordine}. ${g.titolo}${g.data ? ` (${formatData(g.data)})` : ''}`,
          )
    doc.text(righeLezioni, colSx, colY + 7)

    const argomentiTxt = argomenti.length > 0 ? argomenti.join(', ') : '—'
    doc.text(doc.splitTextToSize(argomentiTxt, centro - colDx + 110), colDx, colY + 7)
    if (atleta.valutazione) {
      const yVal = colY + 7 + Math.min(argomenti.length, 1) * 5 + 12
      doc.setFont('helvetica', 'bold')
      doc.text('Valutazione:', colDx, yVal)
      doc.setFont('helvetica', 'normal')
      doc.text(doc.splitTextToSize(atleta.valutazione, centro - colDx + 110), colDx, yVal + 5)
    }

    // Firme istruttori, distribuite nella parte bassa della pagina.
    const yFirma = 175
    const firmatari = opts.istruttori.length > 0 ? opts.istruttori : [null]
    const passo = larghezzaPagina / (firmatari.length + 1)
    firmatari.forEach((it, i) => {
      const cx = passo * (i + 1)
      if (it?.firma) aggiungiImmagine(doc, it.firma, cx - 22, yFirma - 16, 44, 15)
      // Riga per la firma.
      doc.setDrawColor(...GRIGIO)
      doc.setLineWidth(0.3)
      doc.line(cx - 30, yFirma, cx + 30, yFirma)
      doc.setFont('helvetica', it ? 'bold' : 'normal')
      doc.setFontSize(9)
      doc.setTextColor(it ? 51 : 100, it ? 65 : 116, it ? 85 : 139)
      doc.text(it ? it.nomeCompleto : "L'istruttore", cx, yFirma + 5, { align: 'center' })
    })
  })

  doc.save(`diplomi-${nomeFileCorso(opts.corso.titolo)}.pdf`)
}

// --- Report presenze -------------------------------------------------------

/** Un atleta nel report presenze, con dati già risolti dalla pagina. */
export interface AtletaPresenze {
  atletaId: string
  nomeCompleto: string
}

export interface ReportPresenzeOpts {
  corso: Pick<Corso, 'titolo'>
  asdNome: string
  /** Logo dell'ASD come data URL (opzionale). */
  asdLogo?: string | null
  giornate: Giornata[]
  presenze: Presenza[]
  atleti: AtletaPresenze[]
}

/**
 * Restituisce la lettera (P/A/G) dello stato di presenza di un atleta in una
 * giornata, oppure '—' se non registrata.
 */
function letteraPresenza(
  presenze: Presenza[],
  giornataId: string,
  atletaId: string,
): string {
  const p = presenze.find((x) => x.giornata_id === giornataId && x.atleta_id === atletaId)
  return p ? LETTERA_PRESENZA[p.stato] : '—'
}

/** Intestazione compatta di una giornata usata nelle colonne del report. */
function intestazioneGiornata(g: Giornata): string {
  const data = g.data ? formatData(g.data) : ''
  return `G${g.ordine}${data ? `\n${data}` : ''}`
}

/**
 * Genera un PDF A4 con la tabella delle presenze del corso (righe = atleti,
 * colonne = giornate con P/A/G), preceduta da nome ASD, titolo corso ed
 * eventuale logo.
 */
export function scaricaReportPresenzePdf(opts: ReportPresenzeOpts): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Intestazione con logo + nome ASD e titolo corso.
  const logoOk = aggiungiImmagine(doc, opts.asdLogo, 14, 12, 16, 16)
  const xTesto = logoOk ? 34 : 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 41, 59)
  doc.text(opts.asdNome || 'ASD', xTesto, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...GRIGIO)
  doc.text(`Registro presenze — ${opts.corso.titolo}`, xTesto, 27)

  const head = [['Atleta', ...opts.giornate.map(intestazioneGiornata)]]
  const body = opts.atleti.map((a) => [
    a.nomeCompleto,
    ...opts.giornate.map((g) => letteraPresenza(opts.presenze, g.id, a.atletaId)),
  ])

  autoTable(doc, {
    head,
    body,
    startY: 34,
    styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: BRAND, halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 60 } },
    theme: 'grid',
  })

  // Legenda in fondo alla tabella.
  const fineY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
  doc.setFontSize(8)
  doc.setTextColor(...GRIGIO)
  doc.text('P = Presente · A = Assente · G = Giustificato · — = non registrato', 14, fineY + 8)

  doc.save(`presenze-${nomeFileCorso(opts.corso.titolo)}.pdf`)
}

/**
 * Esporta la stessa tabella presenze in CSV (una riga per atleta, una colonna
 * per giornata con P/A/G), usando l'utilità condivisa scaricaCsv.
 */
export function reportPresenzeCsv(opts: ReportPresenzeOpts): void {
  const colonne: ColonnaCsv<AtletaPresenze>[] = [
    { intestazione: 'Atleta', valore: (a) => a.nomeCompleto },
    ...opts.giornate.map<ColonnaCsv<AtletaPresenze>>((g) => ({
      intestazione: `G${g.ordine} ${g.titolo}${g.data ? ` (${formatData(g.data)})` : ''}`,
      valore: (a) => letteraPresenza(opts.presenze, g.id, a.atletaId),
    })),
  ]
  scaricaCsv(`presenze-${nomeFileCorso(opts.corso.titolo)}`, opts.atleti, colonne)
}

// --- DPA firmato ------------------------------------------------------------

/**
 * Genera il PDF del DPA firmato: il testo (già compilato con i dati della ASD)
 * su formato A4, seguito dal blocco di accettazione con firmatario, data e versione.
 */
export function scaricaDpaPdf(opts: { testoCompilato: string; acc: AccettazioneDpa }): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margine = 18
  const larghezza = doc.internal.pageSize.getWidth() - margine * 2
  const fondo = 282
  let y = margine

  const scrivi = (testo: string, grassetto = false) => {
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal')
    const linee = doc.splitTextToSize(testo === '' ? ' ' : testo, larghezza)
    for (const l of linee) {
      if (y > fondo) {
        doc.addPage()
        y = margine
      }
      doc.text(l, margine, y)
      y += 5
    }
  }

  doc.setFontSize(10)
  for (const paragrafo of opts.testoCompilato.split('\n')) scrivi(paragrafo)

  // Blocco di accettazione.
  if (y > fondo - 40) {
    doc.addPage()
    y = margine
  }
  y += 6
  doc.setDrawColor(...GRIGIO)
  doc.line(margine, y, margine + larghezza, y)
  y += 8
  scrivi('ACCETTAZIONE', true)
  const acc = opts.acc
  const dataTxt = (() => {
    try {
      return new Date(acc.accettato_il).toLocaleString('it-IT')
    } catch {
      return acc.accettato_il
    }
  })()
  scrivi(`Firmatario: ${acc.firmatario_nome}${acc.firmatario_ruolo ? ` — ${acc.firmatario_ruolo}` : ''}`)
  if (acc.denominazione) scrivi(`Per conto di: ${acc.denominazione}`)
  scrivi(`Data di accettazione: ${dataTxt}`)
  scrivi(`Versione del documento: ${acc.versione}`)
  scrivi('Accettazione registrata elettronicamente tramite la piattaforma IstruttoriCSAIn.')

  doc.save('dpa-firmato.pdf')
}

/** Normalizza il titolo del corso per usarlo come nome file. */
function nomeFileCorso(titolo: string): string {
  return (
    titolo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // rimuove accenti
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'corso'
  )
}
