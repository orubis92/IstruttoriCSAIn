import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/Toast'
import { getPrivacy, haConsensoPrivacy, registraConsensoPrivacy } from '@/api/piattaforma'
import { messaggioErrore } from '@/api/errors'
import { Spinner } from '@/components/ui'

/**
 * Mostra l'informativa privacy come schermata bloccante finché l'utente non
 * presta il consenso alla versione corrente. Si ripresenta se viene pubblicata
 * una nuova versione dell'informativa.
 */
export function GateConsensoPrivacy() {
  const { profilo } = useAuth()
  const toast = useToast()
  const [accetta, setAccetta] = useState(false)

  const privacy = useQuery({ queryKey: ['privacy'], queryFn: getPrivacy })
  const consenso = useQuery({
    queryKey: ['consenso-privacy', profilo?.id, privacy.data?.versione],
    queryFn: () => haConsensoPrivacy(profilo!.id, privacy.data!.versione),
    enabled: !!profilo && !!privacy.data,
  })

  const registra = useMutation({
    mutationFn: () => registraConsensoPrivacy(profilo!.id, privacy.data!.versione),
    onSuccess: () => consenso.refetch(),
    onError: (e) => toast.errore(messaggioErrore(e)),
  })

  // Non mostrare nulla finché non sappiamo, o se non c'è un'informativa, o se già
  // consentita.
  if (!profilo) return null
  if (!privacy.data || !privacy.data.testo) return null
  if (consenso.isLoading || consenso.data === undefined) return null
  if (consenso.data === true) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div className="card flex max-h-[95vh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-b-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <ShieldCheck className="h-6 w-6 text-brand-700" />
          <h2 className="text-lg font-semibold text-slate-900">Informativa sulla privacy</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {privacy.data.testo}
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-200 px-5 py-4">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={accetta}
              onChange={(e) => setAccetta(e.target.checked)}
            />
            <span>Ho letto e accetto l'informativa sul trattamento dei dati personali.</span>
          </label>
          <button
            className="btn-primary w-full"
            disabled={!accetta || registra.isPending}
            onClick={() => registra.mutate()}
          >
            {registra.isPending && <Spinner className="h-4 w-4" />} Accetta e continua
          </button>
          <p className="text-center text-xs text-slate-400">
            Per usare l'applicazione è necessario prestare il consenso.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
