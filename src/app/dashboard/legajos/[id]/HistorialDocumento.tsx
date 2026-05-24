'use client'

import { useState } from 'react'

type Evento = {
  id: string
  estado_anterior: string | null
  estado_nuevo: string
  actor_tipo: string
  observaciones: string | null
  created_at: string
}

const actorColor: Record<string, string> = {
  proveedor: 'bg-blue-500/10 text-blue-400',
  evaluador: 'bg-purple-500/10 text-purple-400',
  sistema:   'bg-zinc-500/10 text-zinc-500',
}

export default function HistorialDocumento({
  historial,
  expandidoPorDefecto = false,
}: {
  historial: Evento[]
  expandidoPorDefecto?: boolean
}) {
  const [abierto, setAbierto] = useState(expandidoPorDefecto)

  if (historial.length === 0) return null

  const ultimo = historial[historial.length - 1]

  return (
    <div className="mt-2">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${abierto ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span>
          {abierto
            ? 'Ocultar historial'
            : `Ver historial (${historial.length} evento${historial.length !== 1 ? 's' : ''})`}
        </span>
        {!abierto && (
          <span className="text-zinc-700 ml-1">
            — último: {ultimo.estado_nuevo.toLowerCase()} el{' '}
            {new Date(ultimo.created_at).toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        )}
      </button>

      {abierto && (
        <div className="mt-2 pl-3 border-l border-white/[0.06] space-y-1.5">
          {historial.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-xs flex-wrap">
              <span className={`px-1.5 py-0.5 rounded ${actorColor[h.actor_tipo] ?? actorColor.sistema}`}>
                {h.actor_tipo}
              </span>
              <span className="text-zinc-600">
                {h.estado_anterior && <>{h.estado_anterior.toLowerCase()} → </>}
                <span className="text-zinc-400">{h.estado_nuevo.toLowerCase()}</span>
              </span>
              {h.observaciones && (
                <span className="text-orange-400 italic">"{h.observaciones}"</span>
              )}
              <span className="text-zinc-700 ml-auto">
                {new Date(h.created_at).toLocaleString('es-AR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
