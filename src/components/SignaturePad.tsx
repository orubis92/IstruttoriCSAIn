import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eraser } from 'lucide-react'

/**
 * Piccolo riquadro per disegnare una firma col dito o col mouse.
 * Alla fine di ogni tratto richiama onChange con l'immagine (data URL PNG),
 * oppure null se la firma viene cancellata.
 */
export function SignaturePad({
  valore,
  onChange,
}: {
  valore: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [disegnando, setDisegnando] = useState(false)
  const [vuoto, setVuoto] = useState(!valore)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    // Se c'è già una firma salvata, la disegniamo sul canvas.
    if (valore) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = valore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }
  }

  const inizia = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    setDisegnando(true)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  const muovi = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!disegnando) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setVuoto(false)
  }
  const termina = () => {
    if (!disegnando) return
    setDisegnando(false)
    onChange(vuoto ? null : canvasRef.current!.toDataURL('image/png'))
  }

  const cancella = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setVuoto(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        onPointerDown={inizia}
        onPointerMove={muovi}
        onPointerUp={termina}
        onPointerLeave={termina}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
      />
      <button type="button" className="btn-ghost mt-1 px-2 py-1 text-xs" onClick={cancella}>
        <Eraser className="h-3.5 w-3.5" /> Cancella
      </button>
    </div>
  )
}
