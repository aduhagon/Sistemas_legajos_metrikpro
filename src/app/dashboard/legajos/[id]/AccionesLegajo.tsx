'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Props = {
  proveedorId: string
  estadoActual: string
  puedeAprobar?: boolean
  mensajeBloqueo?: string
}

export default function AccionesLegajo({ proveedorId, estadoActual, puedeAprobar = true, mensajeBloqueo }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [obs, setObs] = useState('')
  const [showObs, setShowObs] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function aprobar() {
    setLoading(true)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/legajos/accion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion:       'aprobar',
        proveedor_id: proveedorId,
        evaluador_id: user?.id,
      }),
    })
    const json = await res.json() as { ok: boolean; error?: string }

    if (!json.ok) {
      setErrorMsg(json.error ?? 'Error al aprobar')
      setLoading(false)
      return
    }
    setLoading(false)
    router.refresh()
  }

  async function rechazar() {
    setLoading(true)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/legajos/accion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion:        'rechazar',
        proveedor_id:  proveedorId,
        evaluador_id:  user?.id,
        observaciones: obs,
      }),
    })
    const json = await res.json() as { ok: boolean; error?: string }

    if (!json.ok) {
      setErrorMsg(json.error ?? 'Error al rechazar')
    }
    setLoading(false)
    setShowObs(false)
    router.refresh()
  }

  async function cambiarEstado(nuevoEstado: string) {
    setLoading(true)
    await supabase.from('proveedores')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', proveedorId)

    // Dispatch webhook si se suspende
    if (nuevoEstado === 'SUSPENDIDO') {
      fetch('/api/legajos/accion', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion:       'suspender',
          proveedor_id: proveedorId,
          evaluador_id: '',
        }),
      }).catch(() => {})
    }

    setLoading(false)
    router.refresh()
  }

  if (estadoActual === 'APROBADO') {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-3 py-1.5 rounded-full">✓ Aprobado</span>
        <button onClick={() => cambiarEstado('SUSPENDIDO')} disabled={loading}
          className="text-zinc-500 hover:text-red-400 text-xs transition-colors px-2">Suspender</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
      {showObs ? (
        <div className="flex items-center gap-2">
          <input value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Motivo del rechazo..."
            className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50 w-48"/>
          <button onClick={rechazar} disabled={loading || !obs}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Confirmar rechazo
          </button>
          <button onClick={() => setShowObs(false)} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancelar</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => cambiarEstado('EN_REVISION')} disabled={loading}
            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Marcar en revisión
          </button>
          <div className="relative group">
            <button onClick={aprobar} disabled={loading || !puedeAprobar}
              className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Aprobar legajo
            </button>
            {!puedeAprobar && mensajeBloqueo && (
              <div className="absolute right-0 top-8 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {mensajeBloqueo}
              </div>
            )}
          </div>
          <button onClick={() => setShowObs(true)} disabled={loading}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            Rechazar
          </button>
        </div>
      )}
    </div>
  )
}
