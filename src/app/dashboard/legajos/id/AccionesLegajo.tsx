'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Props = { proveedorId: string; estadoActual: string }

export default function AccionesLegajo({ proveedorId, estadoActual }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [obs, setObs] = useState('')
  const [showObs, setShowObs] = useState(false)

  async function cambiarEstado(nuevoEstado: string) {
    setLoading(true)
    await supabase
      .from('proveedores')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', proveedorId)
    setLoading(false)
    setShowObs(false)
    router.refresh()
  }

  if (estadoActual === 'APROBADO') {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-3 py-1.5 rounded-full">
          ✓ Aprobado
        </span>
        <button onClick={() => cambiarEstado('SUSPENDIDO')} disabled={loading}
          className="text-zinc-500 hover:text-red-400 text-xs transition-colors px-2">
          Suspender
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showObs ? (
        <div className="flex items-center gap-2">
          <input
            value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Motivo del rechazo..."
            className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50 w-48"
          />
          <button onClick={() => cambiarEstado('RECHAZADO')} disabled={loading || !obs}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Confirmar rechazo
          </button>
          <button onClick={() => setShowObs(false)}
            className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => cambiarEstado('EN_REVISION')} disabled={loading}
            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Marcar en revisión
          </button>
          <button onClick={() => cambiarEstado('APROBADO')} disabled={loading}
            className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Aprobar legajo
          </button>
          <button onClick={() => setShowObs(true)} disabled={loading}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Rechazar
          </button>
        </>
      )}
    </div>
  )
}
