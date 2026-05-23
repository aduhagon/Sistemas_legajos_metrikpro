'use client'

import { useState } from 'react'

type Visita = {
  id: string
  visitado_at: string
  resultado: string
  estado_supervision: string
  observacion: string | null
  supervision_obs: string | null
  lat: number | null
  lng: number | null
  auditor: { nombre: string } | null
  establecimiento: { nombre: string } | null
  checklist: { cumple: boolean; observacion: string | null; item: { nombre: string } | null }[]
}

const RESULTADO_COLOR: Record<string, string> = {
  CONFORME:    'bg-green-500/10 text-green-400 border-green-500/20',
  NO_CONFORME: 'bg-red-500/10 text-red-400 border-red-500/20',
  URGENTE:     'bg-red-600/15 text-red-300 border-red-600/30',
  OBSERVACION: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}
const RESULTADO_LABEL: Record<string, string> = {
  CONFORME: 'Conforme', NO_CONFORME: 'No conforme', URGENTE: 'Urgente', OBSERVACION: 'Observación',
}
const SUPERVISION_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  APROBADA:  'bg-green-500/10 text-green-400 border-green-500/20',
  RECHAZADA: 'bg-red-500/10 text-red-400 border-red-500/20',
}
const SUPERVISION_DESC: Record<string, string> = {
  PENDIENTE: 'El supervisor aún no revisó esta visita',
  APROBADA:  'El supervisor aprobó esta visita',
  RECHAZADA: 'El supervisor rechazó esta visita',
}

export default function AuditoriasProveedor({ visitas }: { visitas: Visita[] }) {
  const [detalle, setDetalle] = useState<Visita | null>(null)

  if (visitas.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6 py-12 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" className="mx-auto mb-3">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
        <p className="text-zinc-500 text-sm">No tenés visitas de auditoría registradas</p>
      </div>
    )
  }

  const urgentes  = visitas.filter(v => v.resultado === 'URGENTE').length
  const pendientes = visitas.filter(v => v.estado_supervision === 'PENDIENTE').length

  return (
    <div className="space-y-4">

      {/* Alertas */}
      {urgentes > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm font-medium">
            {urgentes} visita{urgentes > 1 ? 's' : ''} marcada{urgentes > 1 ? 's' : ''} como urgente — revisá las observaciones
          </p>
        </div>
      )}

      {pendientes > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
          <p className="text-yellow-400 text-sm">
            {pendientes} visita{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de revisión por el supervisor
          </p>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-medium">{visitas.length} visita{visitas.length !== 1 ? 's' : ''} de auditoría</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {visitas.map(v => (
            <button key={v.id} onClick={() => setDetalle(v)}
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
                  </div>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {v.establecimiento?.nombre ?? '—'}
                    {' · '}{new Date(v.visitado_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </p>
                  {v.observacion && <p className="text-zinc-600 text-xs mt-1 truncate">{v.observacion}</p>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="shrink-0 mt-1">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal detalle — solo lectura */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#13151f] border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div>
                <p className="font-medium">Visita de auditoría</p>
                <p className="text-zinc-500 text-xs">
                  {new Date(detalle.visitado_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-zinc-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Establecimiento</p>
                  <p className="text-white">{detalle.establecimiento?.nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Resultado</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${RESULTADO_COLOR[detalle.resultado]}`}>
                    {RESULTADO_LABEL[detalle.resultado]}
                  </span>
                </div>
                {detalle.lat && detalle.lng && (
                  <div className="col-span-2">
                    <p className="text-zinc-500 text-xs mb-0.5">Ubicación de la visita</p>
                    <a href={`https://maps.google.com/?q=${detalle.lat},${detalle.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 text-xs hover:underline">Ver en Google Maps →</a>
                  </div>
                )}
              </div>

              {/* Checklist */}
              {detalle.checklist?.length > 0 && (
                <div>
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Checklist evaluado</p>
                  <div className="space-y-2">
                    {detalle.checklist.map((c, i) => (
                      <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg ${
                        c.cumple ? 'bg-green-500/5 border border-green-500/15' : 'bg-red-500/5 border border-red-500/15'
                      }`}>
                        <span className={`text-sm font-medium shrink-0 ${c.cumple ? 'text-green-400' : 'text-red-400'}`}>
                          {c.cumple ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className="text-white text-sm">{c.item?.nombre ?? '—'}</p>
                          {c.observacion && <p className="text-zinc-500 text-xs mt-0.5">{c.observacion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observación del auditor */}
              {detalle.observacion && (
                <div>
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-1">Observación del auditor</p>
                  <p className="text-zinc-300 text-sm bg-white/[0.03] rounded-lg px-3 py-2">{detalle.observacion}</p>
                </div>
              )}

              {/* Estado supervisión */}
              <div className={`rounded-xl border px-4 py-3 ${SUPERVISION_COLOR[detalle.estado_supervision]}`}>
                <p className="text-sm font-medium">
                  {detalle.estado_supervision.charAt(0) + detalle.estado_supervision.slice(1).toLowerCase()}
                </p>
                <p className="text-xs mt-0.5 opacity-70">{SUPERVISION_DESC[detalle.estado_supervision]}</p>
                {detalle.supervision_obs && (
                  <p className="text-xs mt-1.5 font-medium">Observación del supervisor: {detalle.supervision_obs}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
