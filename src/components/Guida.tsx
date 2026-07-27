import { useState, type ReactNode } from 'react'
import { ChevronDown, LifeBuoy } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import type { RuoloUtente } from '@/lib/database.types'

interface Sezione {
  id: string
  titolo: string
  /** ruoli a cui mostrare la sezione; se assente, a tutti */
  ruoli?: RuoloUtente[]
  contenuto: ReactNode
}

const SEZIONI: Sezione[] = [
  {
    id: 'intro',
    titolo: 'Che cos’è questa app',
    contenuto: (
      <>
        <p>
          IstruttoriCSAIn serve a gestire i corsi di tiro con l’arco della tua ASD: anagrafiche,
          corsi e giornate, documenti e modulistica. Ogni ASD vede solo i propri dati.
        </p>
        <p>
          A seconda del ruolo (amministratore, istruttore, atleta) vedrai voci e funzioni diverse.
        </p>
      </>
    ),
  },
  {
    id: 'accesso',
    titolo: 'Primo accesso',
    contenuto: (
      <>
        <p>
          Se sei tu a portare la tua ASD sulla piattaforma: crea un account, poi nella schermata di
          benvenuto scegli <b>«Registra la tua ASD»</b>. Diventi automaticamente il primo
          amministratore.
        </p>
        <p>
          Se invece lo staff ti ha creato il profilo: ti verrà dato un <b>codice invito</b>. Crea
          l’account e scegli <b>«Ho un codice invito»</b>, poi incolla il codice per attivare il
          tuo profilo.
        </p>
      </>
    ),
  },
  {
    id: 'membri',
    titolo: 'Gestire i membri',
    ruoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
    contenuto: (
      <>
        <p>
          Nella sezione <b>Membri</b> crei le anagrafiche di atleti e istruttori. Gli istruttori
          possono creare atleti; gli amministratori possono creare anche istruttori e altri
          amministratori.
        </p>
        <p>
          Dopo aver creato un membro, genera il <b>codice invito</b> e consegnalo alla persona: lo
          userà al primo accesso per attivare l’account. Codice fiscale e tessera si modificano dal
          pulsante <b>«Dati»</b>.
        </p>
      </>
    ),
  },
  {
    id: 'amministrazione',
    titolo: 'Amministrare la ASD',
    ruoli: ['AMMINISTRATORE_ASD'],
    contenuto: (
      <>
        <p>
          Come amministratore gestisci l’ente e i suoi utenti. Puoi avere più amministratori: è
          consigliato averne almeno due, così la ASD non resta bloccata se uno non è disponibile.
        </p>
        <p>
          Per motivi di sicurezza non puoi degradare, disattivare o cancellare il <b>tuo</b> profilo:
          deve farlo un altro amministratore.
        </p>
      </>
    ),
  },
  {
    id: 'corsi-staff',
    titolo: 'Creare e gestire i corsi',
    ruoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
    contenuto: (
      <>
        <p>
          Da <b>Corsi → Nuovo corso</b> puoi partire in due modi: <b>Guidata</b>, scegliendo una
          linea guida e assegnando a ciascuna giornata la sua data sul calendario (c'è anche un
          riempimento settimanale automatico come punto di partenza); oppure <b>Manuale</b>, creando
          il corso da zero e aggiungendo le giornate a mano.
        </p>
        <p>
          Nella scheda del corso cambi lo <b>stato</b> (metti «Aperto alle iscrizioni» per far
          candidare gli atleti), gestisci le <b>giornate</b> e gli <b>iscritti</b>, e registri le
          <b> presenze</b> giornata per giornata.
        </p>
      </>
    ),
  },
  {
    id: 'corsi-atleta',
    titolo: 'I tuoi corsi',
    ruoli: ['ATLETA'],
    contenuto: (
      <>
        <p>
          In <b>Corsi</b> vedi i corsi a cui sei iscritto e quelli aperti alle iscrizioni. Aprendo un
          corso aperto puoi premere <b>«Candidati»</b>: lo staff confermerà la tua iscrizione.
        </p>
        <p>Nella scheda del corso trovi le giornate con obiettivi e argomenti.</p>
      </>
    ),
  },
  {
    id: 'calendario',
    titolo: 'Calendario',
    contenuto: (
      <>
        <p>
          In <b>Calendario</b> vedi tutte le giornate dei corsi su un calendario mensile. Usa le
          frecce per cambiare mese; clicca un giorno per vederne il dettaglio, o una giornata per
          aprire direttamente il corso. Ogni corso ha un colore, riportato nella legenda in fondo.
        </p>
        <p>
          Le date delle giornate si impostano alla creazione guidata del corso — una data per ogni
          giornata — oppure aggiungendo/modificando le giornate dalla scheda del corso.
        </p>
      </>
    ),
  },
  {
    id: 'proponi-standard',
    titolo: 'Proporre un corso come standard',
    ruoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
    contenuto: (
      <>
        <p>
          Se hai costruito un buon corso, puoi proporlo come <b>corso standard</b> per tutte le ASD.
          Apri la scheda del corso e premi <b>«Proponi»</b> nel riquadro dedicato: verrà inviata una
          copia (titolo, descrizione e giornate) in revisione ai programmatori.
        </p>
        <p>
          Vedrai lo stato della proposta: in revisione, accettata o rifiutata (con la motivazione).
          Finché è in revisione puoi ritirarla.
        </p>
      </>
    ),
  },
  {
    id: 'standard-prog',
    titolo: 'Corsi standard e revisione',
    ruoli: ['PROGRAMMATORE'],
    contenuto: (
      <>
        <p>
          Nella sezione <b>Standard</b> gestisci le linee guida di piattaforma. Nella scheda
          <b> «Proposte in revisione»</b> trovi i corsi proposti dalle ASD: puoi <b>accettarli</b> —
          diventano subito una linea guida disponibile a tutte le ASD in modalità guidata — oppure
          <b> rifiutarli</b> indicando una motivazione.
        </p>
        <p>
          Nella scheda <b>«Corsi standard»</b> puoi anche crearne di nuovi da zero, con le relative
          giornate, ed eliminarli.
        </p>
      </>
    ),
  },
  {
    id: 'documenti',
    titolo: 'Documenti',
    contenuto: (
      <>
        <p>Ci sono tre tipi di documenti:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <b>Generale</b>: valido per tutte le ASD (lo pubblica la piattaforma).
          </li>
          <li>
            <b>ASD — Pubblico</b>: visibile a tutta la tua ASD.
          </li>
          <li>
            <b>ASD — Privato</b>: visibile solo agli atleti che lo staff indica.
          </li>
        </ul>
        <p className="mt-2">
          Premi <b>Carica</b> per aggiungere un documento e l’icona di download per scaricarlo. Come
          atleta puoi caricare la <b>tua</b> documentazione (es. certificato medico), visibile a te e
          allo staff.
        </p>
      </>
    ),
  },
  {
    id: 'moduli',
    titolo: 'Modulistica',
    contenuto: (
      <>
        <p>
          In <b>Modulistica</b> trovi i moduli pronti (iscrizione, privacy, ecc.). Premi
          <b> «Compila»</b>, riempi i campi e salvi la bozza.
        </p>
        <p>
          L’atleta poi <b>invia</b> il modulo; lo staff lo <b>firma</b> (approva) o lo rifiuta. La data
          di firma viene registrata automaticamente.
        </p>
      </>
    ),
  },
  {
    id: 'commenti-storico',
    titolo: 'Commenti e storico dei corsi',
    contenuto: (
      <>
        <p>
          In ogni corso, la scheda <b>«Commenti»</b> permette allo staff e agli atleti iscritti di
          annotare com'è andata e i problemi ricorrenti, sul corso in generale o su una singola
          giornata. Serve a tenere memoria e a migliorare i corsi successivi.
        </p>
        <p>
          In <b>Corsi</b> il selettore <b>«Attivi / Storico»</b> mostra i corsi conclusi o annullati.
          Le valutazioni degli atleti si trovano nella scheda «Iscritti» del corso (pulsante
          «Valuta»).
        </p>
      </>
    ),
  },
  {
    id: 'diplomi',
    titolo: 'Diplomi',
    ruoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
    contenuto: (
      <>
        <p>
          Nella scheda <b>«Diplomi»</b> del corso associ gli istruttori che vi hanno partecipato e ne
          raccogli la <b>firma</b> (si disegna col dito o col mouse). Poi <b>«Apri diplomi»</b> genera
          un diploma per ogni atleta partecipante, già compilato con nome, lezioni frequentate,
          argomenti trattati e le firme, pronto da <b>stampare</b> (o salvare in PDF dalla stampa).
        </p>
      </>
    ),
  },
  {
    id: 'chat',
    titolo: 'Chat',
    contenuto: (
      <>
        <p>
          In <b>Chat</b> puoi scrivere agli altri membri della tua ASD e ai programmatori. Usa
          <b> «Nuova chat»</b> per una conversazione singola o <b>«Nuovo gruppo»</b> per crearne una
          con più persone. Le conversazioni sono private: solo i partecipanti le vedono.
        </p>
      </>
    ),
  },
  {
    id: 'certificati',
    titolo: 'Certificato medico',
    ruoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
    contenuto: (
      <>
        <p>
          In <b>Membri</b>, sull'atleta, il pulsante <b>«Certificato»</b> permette di registrare i
          dati del certificato medico (tipo, date di rilascio e scadenza, ente, medico, note). Il
          sistema segnala i certificati scaduti o in scadenza.
        </p>
        <p>L'atleta vede il proprio certificato nella pagina del profilo.</p>
      </>
    ),
  },
  {
    id: 'impostazioni',
    titolo: 'Impostazioni e logo',
    ruoli: ['AMMINISTRATORE_ASD'],
    contenuto: (
      <>
        <p>
          Dall'icona a forma di ingranaggio in alto a destra apri le <b>Impostazioni</b>: qui
          l'amministratore modifica i dati della ASD (nome, contatti, codice CSAIN) e carica il
          <b> logo</b>.
        </p>
        <p>
          Il logo compare in alto a sinistra nell'app e sui <b>diplomi</b> stampati. Consigliata
          un'immagine quadrata; viene ridimensionata in automatico.
        </p>
      </>
    ),
  },
  {
    id: 'logo-csain',
    titolo: 'Logo CSAIN',
    ruoli: ['PROGRAMMATORE'],
    contenuto: (
      <>
        <p>
          Dalle <b>Impostazioni</b> (ingranaggio in alto a destra) puoi caricare il <b>logo CSAIN</b>
          valido per tutte le ASD. Compare a sinistra del logo di ogni ASD nell'app e in alto a destra
          sui diplomi stampati. Solo i programmatori possono modificarlo.
        </p>
      </>
    ),
  },
  {
    id: 'notifiche',
    titolo: 'Notifiche',
    contenuto: (
      <>
        <p>
          La <b>campanella</b> in alto a destra mostra i <b>messaggi non letti</b> della chat e le
          <b> prossime lezioni</b> dei tuoi corsi. Il numero rosso indica i messaggi da leggere; una
          conversazione si segna come letta quando la apri.
        </p>
        <p>
          Dal <b>tuo profilo</b>, nella sezione «Notifiche», scegli quando ricevere i promemoria delle
          lezioni (il giorno prima, la mattina, o alcune ore prima) e su quali canali. Le notifiche
          dentro l'app sono già attive; email e push saranno abilitate in seguito.
        </p>
      </>
    ),
  },
  {
    id: 'privacy',
    titolo: 'Privacy e dati',
    contenuto: (
      <>
        <p>
          I dati sensibili (codice fiscale, certificati medici) sono protetti: ogni ASD accede solo ai
          propri dati e i certificati medici sono dati sanitari, trattati solo per l’idoneità
          sportiva.
        </p>
        <p>
          Puoi modificare i tuoi recapiti dal <b>tuo profilo</b>; codice fiscale e tessera li aggiorna
          lo staff.
        </p>
      </>
    ),
  },
]

export function GuidaButton() {
  const [aperto, setAperto] = useState(false)
  return (
    <>
      <button onClick={() => setAperto(true)} className="icon-btn" aria-label="Guida" title="Guida">

        <LifeBuoy className="h-5 w-5" />
      </button>
      <Guida aperto={aperto} onClose={() => setAperto(false)} />
    </>
  )
}

function Guida({ aperto, onClose }: { aperto: boolean; onClose: () => void }) {
  const { ruolo } = useAuth()
  const [apertaId, setApertaId] = useState<string | null>('intro')

  const sezioni = SEZIONI.filter((s) => !s.ruoli || (ruolo && s.ruoli.includes(ruolo)))

  return (
    <Modal titolo="Guida all’uso" aperto={aperto} onClose={onClose} larghezza="max-w-2xl">
      <p className="mb-4 text-sm text-slate-500">
        Una guida rapida alle funzioni dell’app. Tocca una voce per aprirla.
      </p>
      <div className="space-y-2">
        {sezioni.map((s) => {
          const attiva = apertaId === s.id
          return (
            <div key={s.id} className="overflow-hidden rounded-lg border border-slate-200">
              <button
                onClick={() => setApertaId(attiva ? null : s.id)}
                className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                {s.titolo}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${attiva ? 'rotate-180' : ''}`}
                />
              </button>
              {attiva && (
                <div className="space-y-2 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  {s.contenuto}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
