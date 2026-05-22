'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Props = {
  docId: string
  estado: string
  fechaVencActual: string | null
  tipoVigencia: string
}

export default function AccionesDocumentoEquipo({ docId, estado, fechaVencActual, tipoVigencia }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showObs, setShowObs] = useState(false)
  const [obs, setObs] = useState('')
  const [editandoFecha, setEditandoFecha] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState(fechaVencActual ?? '')
  const [guardandoFecha, setGuardandoFecha] = useState(false)

  async function aprobar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('aprobar_documento_equipo', {
      p_doc_id: docId,
      p_evaluador_id: user?.id,
    })
    setLoading(false)
    router.refresh()
  }

  async function rechazar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('rechazar_documento_equipo', {
      p_doc_id: docId,
      p_evaluador_id: user?.id,
      p_observaciones: obs,
    })
    setLoading(false)
    setShowObs(false)
    router.refresh()
  }

  async function guardarFecha() {
    setGuardandoFecha(true)
    await supabase.from('documentos_equipo')
      .update({ fecha_venc: nuevaFecha || null, updated_at: new Date().toISOString() })
      .eq('id', docId)
    setGuardandoFecha(false)
    setEditandoFecha(false)
    router.refresh()
  }

  const necesitaFecha = tipoVigencia !== 'PERMANENTE'

  return (
    <div className="flex flex-col gap-2">
      {necesitaFecha && (
        <div className="flex items-center gap-2">
          {editandoFecha ? (
            <>
              <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-blue-500/60"/>
              <button onClick={guardarFecha} disabled={guardandoFecha}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1 rounded-lg disabled:opacity-40">
                {guardandoFecha ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => { setEditandoFecha(false); setNuevaFecha(fechaVencActual ?? '') }}
                className="text-zinc-500 hover:text-zinc-300 text-xs">Cancelar</button>
            </>
          ) : (
            <button onClick={() => setEditandoFecha(true)}
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {fechaVencActual
                ? `Vence: ${new Date(fechaVencActual).toLocaleDateString('es-AR')} — editar`
                : 'Agregar fecha de vencimiento'}
            </button>
          )}
        </div>
      )}

      {estado === 'CARGADO' && (
        <>
          {showObs ? (
            <div className="flex items-center gap-2">
              <input value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Motivo del rechazo..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50 w-52"/>
              <button onClick={rechazar} disabled={loading || !obs}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">
                Confirmar
              </button>
              <button onClick={() => setShowObs(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={aprobar} disabled={loading}
                className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">
                ✓ Aprobar
              </button>
              <button onClick={() => setShowObs(true)} disabled={loading}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">
                ✗ Rechazar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
