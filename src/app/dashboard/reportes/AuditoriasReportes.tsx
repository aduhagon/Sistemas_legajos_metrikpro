'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

type Visita = {
  id: string
  visitado_at: string
  resultado: string
  estado_supervision: string
  observacion: string | null
  supervision_obs: string | null
  offline: boolean
  lat: number | null
  lng: number | null
  auditor:    { nombre: string } | null
  proveedor:  { razon_social: string; cuit: string } | null
  establecimiento: { nombre: string } | null
  checklist: { cumple: boolean; observacion: string | null; item: { nombre: string } | null }[]
}


// Helper: Supabase puede devolver joins como objeto o como array dependiendo del select
function pick(v: any) {
  if (v == null) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

const RESULTADO_COLOR: Record<string, string> = {
  CONFORME:    'bg-green-500/10 text-green-400 border-green-500/20',
  NO_CONFORME: 'bg-red-500/10 text-red-400 border-red-500/20',
  URGENTE:     'bg-red-600/15 text-red-300 border-red-600/30',
  OBSERVACION: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}
const RESULTADO_LABEL: Record<string, string> = {
  CONFORME:    'Conforme',
  NO_CONFORME: 'No conforme',
  URGENTE:     'Urgente',
  OBSERVACION: 'Observación',
}
const SUPERVISION_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  APROBADA:  'bg-green-500/10 text-green-400 border-green-500/20',
  RECHAZADA: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function AuditoriasReportes({
  visitas: visitas_init,
  rol,
}: {
  visitas: any[]
  rol: string
}) {
  const [visitas, setVisitas]           = useState(visitas_init)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroRes, setFiltroRes]       = useState<string>('todos')
  const [detalle, setDetalle]           = useState<Visita | null>(null)
  const [obsRechazo, setObsRechazo]     = useState('')
  const [loading, setLoading]           = useState(false)
  const [msg, setMsg]                   = useState('')

  const puedeSuperviar = ['admin', 'evaluador'].includes(rol)

  const filtradas = visitas.filter(v => {
    const okEstado = filtroEstado === 'todos' || v.estado_supervision === filtroEstado
    const okRes    = filtroRes    === 'todos' || v.resultado          === filtroRes
    return okEstado && okRes
  })

  const pendientes = visitas.filter(v => v.estado_supervision === 'PENDIENTE').length

  async function supervisar(visita: Visita, estado: 'APROBADA' | 'RECHAZADA') {
    if (estado === 'RECHAZADA' && !obsRechazo.trim()) {
      setMsg('Ingresá una observación para rechazar la visita')
      return
    }
    setLoading(true)
    const { data } = await supabase.rpc('supervisar_visita_auditoria', {
      p_visita_id: visita.id,
      p_estado:    estado,
      p_obs:       estado === 'RECHAZADA' ? obsRechazo : null,
    })
    if (data?.ok) {
      setVisitas(prev => prev.map(v =>
        v.id === visita.id
          ? { ...v, estado_supervision: estado, supervision_obs: obsRechazo || null }
          : v
      ))
      setDetalle(null)
      setObsRechazo('')
      setMsg(`Visita ${estado === 'APROBADA' ? 'aprobada' : 'rechazada'} correctamente`)
      setTimeout(() => setMsg(''), 3000)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',     value: visitas.length,                                              color: 'text-white' },
          { label: 'Pendientes',value: pendientes,                                                  color: 'text-yellow-400' },
          { label: 'Urgentes',  value: visitas.filter(v => v.resultado === 'URGENTE').length,       color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alerta pendientes */}
      {pendientes > 0 && puedeSuperviar && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-yellow-400 text-sm">
            {pendientes} visita{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de supervisión
          </p>
        </div>
      )}

      {msg && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-blue-300 text-sm">{msg}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos','PENDIENTE','APROBADA','RECHAZADA'].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filtroEstado === e
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
            }`}>
            {e === 'todos' ? 'Todos' : e.charAt(0) + e.slice(1).toLowerCase()}
          </button>
        ))}
        <div className="w-px bg-white/[0.08]"/>
        {['todos','CONFORME','NO_CONFORME','URGENTE','OBSERVACION'].map(r => (
          <button key={r} onClick={() => setFiltroRes(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filtroRes === r
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
            }`}>
            {r === 'todos' ? 'Todos los resultados' : RESULTADO_LABEL[r]}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-medium">{filtradas.length} visita{filtradas.length !== 1 ? 's' : ''}</p>
        </div>
        {filtradas.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-10">No hay visitas con esos filtros</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtradas.map(v => (
              <button key={v.id} onClick={() => { setDetalle(v); setObsRechazo('') }}
                className="w-full px-6 py-4 text-left hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${RESULTADO_COLOR[v.resultado]}`}>
                        {RESULTADO_LABEL[v.resultado]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${SUPERVISION_COLOR[v.estado_supervision]}`}>
                        {v.estado_supervision.charAt(0) + v.estado_supervision.slice(1).toLowerCase()}
                      </span>
                      {v.offline && (
                        <span className="text-xs text-zinc-600">offline</span>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">
                      {pick(v.proveedor)?.razon_social ?? '—'}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {pick(v.establecimiento)?.nombre ?? '—'}
                      {' · '}{pick(v.auditor)?.nombre ?? '—'}
                      {' · '}{new Date(v.visitado_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </p>
                    {v.observacion && (
                      <p className="text-zinc-600 text-xs mt-1 truncate">{v.observacion}</p>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="shrink-0 mt-1">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#13151f] border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div>
                <p className="font-medium">{pick(detalle.proveedor)?.razon_social}</p>
                <p className="text-zinc-500 text-xs">{pick(detalle.proveedor)?.cuit}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-zinc-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Auditor</p>
                  <p className="text-white">{pick(detalle.auditor)?.nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Establecimiento</p>
                  <p className="text-white">{pick(detalle.establecimiento)?.nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Fecha y hora</p>
                  <p className="text-white">
                    {new Date(detalle.visitado_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Resultado</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${RESULTADO_COLOR[detalle.resultado]}`}>
                    {RESULTADO_LABEL[detalle.resultado]}
                  </span>
                </div>
                {detalle.lat && detalle.lng && (
                  <div className="col-span-2">
                    <p className="text-zinc-500 text-xs mb-0.5">Ubicación GPS</p>
                    <a href={`https://maps.google.com/?q=${detalle.lat},${detalle.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 text-xs hover:underline">
                      Ver en Google Maps →
                    </a>
                  </div>
                )}
              </div>

              {/* Checklist */}
              {detalle.checklist?.length > 0 && (
                <div>
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Checklist</p>
                  <div className="space-y-2">
                    {detalle.checklist.map((c, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg ${
                        c.cumple ? 'bg-green-500/5 border border-green-500/15' : 'bg-red-500/5 border border-red-500/15'
                      }`}>
                        <span className={`text-sm font-medium shrink-0 ${c.cumple ? 'text-green-400' : 'text-red-400'}`}>
                          {c.cumple ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className="text-white text-sm">{pick(c.item)?.nombre ?? '—'}</p>
                          {c.observacion && <p className="text-zinc-500 text-xs mt-0.5">{c.observacion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observación */}
              {detalle.observacion && (
                <div>
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-1">Observación general</p>
                  <p className="text-zinc-300 text-sm bg-white/[0.03] rounded-lg px-3 py-2">{detalle.observacion}</p>
                </div>
              )}

              {/* Estado actual */}
              <div className={`rounded-xl border px-4 py-3 ${SUPERVISION_COLOR[detalle.estado_supervision]}`}>
                <p className="text-sm font-medium">
                  Supervisión: {detalle.estado_supervision.charAt(0) + detalle.estado_supervision.slice(1).toLowerCase()}
                </p>
                {detalle.supervision_obs && (
                  <p className="text-xs mt-1 opacity-80">{detalle.supervision_obs}</p>
                )}
              </div>

              {/* Acciones de supervisión */}
              {puedeSuperviar && detalle.estado_supervision === 'PENDIENTE' && (
                <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Supervisar visita</p>
                  <button onClick={() => supervisar(detalle, 'APROBADA')} disabled={loading}
                    className="w-full bg-green-600/80 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                    Aprobar visita
                  </button>
                  <div className="space-y-2">
                    <textarea
                      value={obsRechazo}
                      onChange={e => setObsRechazo(e.target.value)}
                      rows={2}
                      placeholder="Observación para el rechazo (requerida)..."
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/60 transition-all placeholder:text-zinc-600 resize-none"
                    />
                    <button onClick={() => supervisar(detalle, 'RECHAZADA')} disabled={loading || !obsRechazo.trim()}
                      className="w-full bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                      Rechazar visita
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
