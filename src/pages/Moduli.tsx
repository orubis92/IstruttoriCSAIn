import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, FilePlus2, Send, PenLine, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import {
  listaModelliModulo,
  listaModuliCompilati,
  moduliAtleta,
  creaModuloCompilato,
  cambiaStatoModulo,
} from '@/api/moduli'
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
  Alert,
} from '@/components/ui'
import { STATO_MODULO_LABEL, formatData, nomeCompleto } from '@/lib/format'
import type {
  CampoModulo,
  ModelloModulo,
  ModuloCompilato,
  StatoModulo,
  Utente,
} from '@/lib/database.types'

export default function Moduli() {
  const { asd, isStaff, profilo } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [compila, setCompila] = useState<ModelloModulo | null>(null)

  const modelli = useQuery({ queryKey: ['modelli-modulo'], queryFn: listaModelliModulo })
  const compilati = useQuery({
    queryKey: ['moduli-compilati', isStaff ? 'staff' : profilo?.id],
    queryFn: () => (isStaff ? listaModuliCompilati() : moduliAtleta(profilo!.id)),
    enabled: !!profilo,
  })
  const membri = useQuery({ queryKey: ['membri'], queryFn: listaMembri, enabled: isStaff })

  const mappaMembri = useMemo(() => {
    const m = new Map<string, Utente>()
    ;(membri.data ?? []).forEach((u) => m.set(u.id, u))
    return m
  }, [membri.data])

  const statoMut = useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: StatoModulo }) => cambiaStatoModulo(id, stato),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moduli-compilati'] })
      toast.successo('Modulo aggiornato.')
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  if (modelli.isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader titolo="Modulistica" sottotitolo={asd?.nome} />

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Moduli disponibili
      </h2>
      {(modelli.data ?? []).length === 0 ? (
        <Alert tono="giallo">
          Non ci sono ancora moduli configurati (iscrizione, privacy, ecc.). Vanno definiti come
          modelli in <code>modelli_modulo</code>.
        </Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(modelli.data ?? []).map((m) => (
            <Card key={m.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-slate-800">{m.titolo}</p>
                {m.descrizione && <p className="mt-0.5 text-sm text-slate-500">{m.descrizione}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {m.asd_id ? 'Modulo della ASD' : 'Modulo di piattaforma'}
                  {m.richiede_firma ? ' · richiede firma' : ''}
                </p>
              </div>
              <button className="btn-secondary shrink-0" onClick={() => setCompila(m)}>
                <FilePlus2 className="h-4 w-4" /> Compila
              </button>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {isStaff ? 'Moduli compilati' : 'I miei moduli'}
      </h2>
      {compilati.isLoading ? (
        <Spinner className="h-6 w-6 text-brand-600" />
      ) : (compilati.data ?? []).length === 0 ? (
        <EmptyState
          icona={<ClipboardList className="h-10 w-10" />}
          titolo="Nessun modulo compilato"
          descrizione="I moduli compilati appariranno qui."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {(compilati.data ?? []).map((mc) => {
            const modello = (modelli.data ?? []).find((m) => m.id === mc.modello_id)
            return (
              <div key={mc.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{modello?.titolo ?? 'Modulo'}</p>
                  <p className="text-xs text-slate-400">
                    {isStaff && `${nomeCompleto(mappaMembri.get(mc.atleta_id))} · `}
                    {formatData(mc.creato_il)}
                  </p>
                </div>
                <StatoModuloBadge stato={mc.stato} />
                <div className="flex gap-1">
                  {!isStaff && mc.stato === 'BOZZA' && (
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => statoMut.mutate({ id: mc.id, stato: 'INVIATO' })}
                    >
                      <Send className="h-3.5 w-3.5" /> Invia
                    </button>
                  )}
                  {isStaff && mc.stato !== 'FIRMATO' && (
                    <button
                      className="btn-ghost px-2 py-1 text-xs text-green-700"
                      onClick={() => statoMut.mutate({ id: mc.id, stato: 'FIRMATO' })}
                    >
                      <PenLine className="h-3.5 w-3.5" /> Firma
                    </button>
                  )}
                  {isStaff && mc.stato !== 'RIFIUTATO' && (
                    <button
                      className="btn-ghost px-2 py-1 text-xs text-red-600"
                      onClick={() => statoMut.mutate({ id: mc.id, stato: 'RIFIUTATO' })}
                    >
                      <X className="h-3.5 w-3.5" /> Rifiuta
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {compila && asd && profilo && (
        <ModalCompila
          modello={compila}
          asdId={asd.id}
          atletaId={profilo.id}
          onClose={() => setCompila(null)}
          onFatto={() => {
            setCompila(null)
            qc.invalidateQueries({ queryKey: ['moduli-compilati'] })
          }}
        />
      )}
    </div>
  )
}

function StatoModuloBadge({ stato }: { stato: StatoModulo }) {
  const tono =
    stato === 'FIRMATO' ? 'verde' : stato === 'INVIATO' ? 'blu' : stato === 'RIFIUTATO' ? 'rosso' : 'giallo'
  return <Badge tono={tono}>{STATO_MODULO_LABEL[stato]}</Badge>
}

function ModalCompila({
  modello,
  asdId,
  atletaId,
  onClose,
  onFatto,
}: {
  modello: ModelloModulo
  asdId: string
  atletaId: string
  onClose: () => void
  onFatto: () => void
}) {
  const toast = useToast()
  const [dati, setDati] = useState<Record<string, unknown>>({})

  const campi: CampoModulo[] = Array.isArray(modello.schema_campi) ? modello.schema_campi : []

  const set = (nome: string, valore: unknown) => setDati((d) => ({ ...d, [nome]: valore }))

  const mut = useMutation({
    mutationFn: () => creaModuloCompilato({ modelloId: modello.id, asdId, atletaId, dati }),
    onSuccess: () => {
      toast.successo('Modulo salvato in bozza. Ora puoi inviarlo.')
      onFatto()
    },
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  function invia(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Modal titolo={modello.titolo} aperto onClose={onClose}>
      <form onSubmit={invia} className="space-y-4">
        {modello.testo_legale && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {modello.testo_legale}
          </div>
        )}

        {campi.length === 0 && (
          <p className="text-sm text-slate-400">Questo modulo non ha campi da compilare.</p>
        )}

        {campi.map((c) => (
          <Field key={c.nome} label={c.etichetta} obbligatorio={c.obbligatorio}>
            {c.tipo === 'testo_lungo' ? (
              <textarea
                className="input min-h-[70px]"
                required={c.obbligatorio}
                onChange={(e) => set(c.nome, e.target.value)}
              />
            ) : c.tipo === 'checkbox' ? (
              <input type="checkbox" onChange={(e) => set(c.nome, e.target.checked)} />
            ) : (
              <input
                className="input"
                type={c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : c.tipo === 'email' ? 'email' : 'text'}
                required={c.obbligatorio}
                onChange={(e) => set(c.nome, e.target.value)}
              />
            )}
          </Field>
        ))}

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending && <Spinner className="h-4 w-4" />} Salva bozza
          </button>
        </div>
      </form>
    </Modal>
  )
}
