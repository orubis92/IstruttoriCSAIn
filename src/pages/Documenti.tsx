import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, Trash2, FileText, Globe, Building2, Lock, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaDocumenti,
  caricaDocumento,
  urlDownload,
  eliminaDocumento,
  destinatariDocumento,
  impostaDestinatari,
} from '@/api/documenti'
import { listaMembri } from '@/api/utenti'
import { messaggioErrore } from '@/api/errors'
import {
  Card,
  PageHeader,
  Badge,
  Modal,
  Field,
  Spinner,
  EmptyState,
  PageLoader,
} from '@/components/ui'
import { TIPO_DOCUMENTO_LABEL, formatData, formatDimensione } from '@/lib/format'
import type {
  DocScope,
  DocVisibilita,
  Documento,
  TipoDocumento,
  Utente,
} from '@/lib/database.types'

const TIPI: TipoDocumento[] = [
  'GENERICO',
  'CERTIFICATO_MEDICO',
  'PRIVACY',
  'ISCRIZIONE',
  'TESSERAMENTO',
  'MATERIALE_CORSO',
  'REGOLAMENTO',
]

export default function Documenti() {
  const { asd, isStaff, isProgrammatore, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [carica, setCarica] = useState(false)
  const [filtro, setFiltro] = useState<'TUTTI' | 'GENERALE' | 'ASD'>('TUTTI')
  const [destinatariDi, setDestinatariDi] = useState<Documento | null>(null)

  const docs = useQuery({ queryKey: ['documenti'], queryFn: listaDocumenti })

  const scarica = async (d: Documento) => {
    try {
      const url = await urlDownload(d.file_path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.errore(messaggioErrore(e))
    }
  }

  const eliminaMut = useMutation({
    mutationFn: (d: Documento) => eliminaDocumento(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documenti'] })
      toast.successo('Documento eliminato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  const filtrati = useMemo(
    () => (docs.data ?? []).filter((d) => filtro === 'TUTTI' || d.scope === filtro),
    [docs.data, filtro],
  )

  if (docs.isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        titolo="Documenti"
        sottotitolo="Documentazione generale e della tua ASD"
        azioni={
          <button className="btn-primary" onClick={() => setCarica(true)}>
            <Upload className="h-4 w-4" /> Carica
          </button>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {(['TUTTI', 'GENERALE', 'ASD'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-1 rounded-md py-1.5 font-medium ${
              filtro === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {f === 'TUTTI' ? 'Tutti' : f === 'GENERALE' ? 'Generale' : 'Della ASD'}
          </button>
        ))}
      </div>

      {filtrati.length === 0 ? (
        <EmptyState
          icona={<FileText className="h-10 w-10" />}
          titolo="Nessun documento"
          descrizione="Carica il primo documento."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {filtrati.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 p-4">
              <IconaScope scope={d.scope} visibilita={d.visibilita} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{d.titolo}</p>
                <p className="text-xs text-slate-400">
                  {TIPO_DOCUMENTO_LABEL[d.tipo]} · {formatDimensione(d.dimensione_byte)} ·{' '}
                  {formatData(d.creato_il)}
                  {d.data_scadenza && ` · scade ${formatData(d.data_scadenza)}`}
                </p>
              </div>
              <EtichettaScope scope={d.scope} visibilita={d.visibilita} />
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => scarica(d)}>
                  <Download className="h-4 w-4" />
                </button>
                {isStaff && d.scope === 'ASD' && d.visibilita === 'PRIVATO' && (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDestinatariDi(d)}>
                    <Users className="h-4 w-4" />
                  </button>
                )}
                {(isStaff || isProgrammatore || d.caricato_da === profilo?.id) && (
                  <button
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => {
                      if (confirm('Eliminare il documento?')) eliminaMut.mutate(d)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {carica && (
        <ModalCarica
          asdId={asd?.id ?? null}
          caricatoDa={profilo?.id ?? ''}
          isStaff={isStaff}
          isProgrammatore={isProgrammatore}
          onClose={() => setCarica(false)}
          onFatto={() => {
            setCarica(false)
            qc.invalidateQueries({ queryKey: ['documenti'] })
          }}
        />
      )}

      {destinatariDi && (
        <ModalDestinatari documento={destinatariDi} onClose={() => setDestinatariDi(null)} />
      )}
    </div>
  )
}

function IconaScope({ scope, visibilita }: { scope: DocScope; visibilita: DocVisibilita | null }) {
  if (scope === 'GENERALE') return <Globe className="h-5 w-5 shrink-0 text-blue-500" />
  if (visibilita === 'PRIVATO') return <Lock className="h-5 w-5 shrink-0 text-amber-500" />
  return <Building2 className="h-5 w-5 shrink-0 text-brand-600" />
}

function EtichettaScope({ scope, visibilita }: { scope: DocScope; visibilita: DocVisibilita | null }) {
  if (scope === 'GENERALE') return <Badge tono="blu">Generale</Badge>
  if (visibilita === 'PRIVATO') return <Badge tono="giallo">Privato</Badge>
  return <Badge tono="brand">Pubblico ASD</Badge>
}

function ModalCarica({
  asdId,
  caricatoDa,
  isStaff,
  isProgrammatore,
  onClose,
  onFatto,
}: {
  asdId: string | null
  caricatoDa: string
  isStaff: boolean
  isProgrammatore: boolean
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  // destinazione: dove finisce il documento
  type Dest = 'GENERALE' | 'ASD_PUBBLICO' | 'ASD_PRIVATO' | 'MIO'
  const opzioni: { val: Dest; label: string }[] = isProgrammatore
    ? [{ val: 'GENERALE', label: 'Generale (tutte le ASD)' }]
    : isStaff
      ? [
          { val: 'ASD_PUBBLICO', label: 'ASD — Pubblico' },
          { val: 'ASD_PRIVATO', label: 'ASD — Privato' },
        ]
      : [{ val: 'MIO', label: 'La mia documentazione (privata)' }]

  const [dest, setDest] = useState<Dest>(opzioni[0].val)
  const [titolo, setTitolo] = useState('')
  const [tipo, setTipo] = useState<TipoDocumento>('GENERICO')
  const [file, setFile] = useState<File | null>(null)
  const [scadenza, setScadenza] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Seleziona un file.')
      let scope: DocScope = 'ASD'
      let visibilita: DocVisibilita | null = 'PUBBLICO'
      let comeAtleta = false
      let atletaRiferimento: string | null = null
      if (dest === 'GENERALE') {
        scope = 'GENERALE'
        visibilita = null
      } else if (dest === 'ASD_PUBBLICO') {
        visibilita = 'PUBBLICO'
      } else if (dest === 'ASD_PRIVATO') {
        visibilita = 'PRIVATO'
      } else {
        visibilita = 'PRIVATO'
        comeAtleta = true
        atletaRiferimento = caricatoDa
      }
      await caricaDocumento({
        file,
        titolo,
        tipo,
        scope,
        asdId: scope === 'GENERALE' ? null : asdId,
        visibilita,
        comeAtleta,
        atletaRiferimento,
        caricatoDa,
        dataScadenza: scadenza || null,
      })
    },
    onSuccess: () => {
      toast.successo('Documento caricato.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Modal titolo="Carica documento" aperto onClose={onClose}>
      <form onSubmit={invia} className="space-y-4">
        <Field label="Destinazione">
          <select className="input" value={dest} onChange={(e) => setDest(e.target.value as Dest)}>
            {opzioni.map((o) => (
              <option key={o.val} value={o.val}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titolo" obbligatorio>
          <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
        </Field>
        <Field label="Tipo">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {TIPI.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        {tipo === 'CERTIFICATO_MEDICO' && (
          <Field label="Data di scadenza">
            <input className="input" type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
          </Field>
        )}
        <Field label="File" obbligatorio>
          <input
            className="input py-2"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </Field>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Carica
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalDestinatari({ documento, onClose }: { documento: Documento; onClose: () => void }) {
  const toast = useToast()
  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri })
  const attuali = useQuery({
    queryKey: ['destinatari', documento.id],
    queryFn: () => destinatariDocumento(documento.id),
  })
  const [sel, setSel] = useState<Set<string> | null>(null)

  const atleti: Utente[] = (membri.data ?? []).filter((m) => m.ruolo === 'ATLETA')
  const selezione = sel ?? new Set(attuali.data ?? [])

  const toggle = (id: string) => {
    const nuovo = new Set(selezione)
    if (nuovo.has(id)) nuovo.delete(id)
    else nuovo.add(id)
    setSel(nuovo)
  }

  const mut = useMutation({
    mutationFn: () => impostaDestinatari(documento.id, Array.from(selezione)),
    onSuccess: () => {
      toast.successo('Destinatari aggiornati.')
      onClose()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  return (
    <Modal titolo="Destinatari del documento privato" aperto onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        Seleziona gli atleti che potranno vedere «{documento.titolo}». Lo staff lo vede sempre.
      </p>
      {membri.isLoading || attuali.isLoading ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {atleti.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            >
              <input type="checkbox" checked={selezione.has(a.id)} onChange={() => toggle(a.id)} />
              <span className="text-sm text-slate-700">
                {a.nome} {a.cognome}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Annulla
        </button>
        <button className="btn-primary flex-1" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Spinner className="h-4 w-4" />} Salva
        </button>
      </div>
    </Modal>
  )
}
