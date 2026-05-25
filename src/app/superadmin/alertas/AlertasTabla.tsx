// ============================================================
// /app/superadmin/alertas/AlertasTabla.tsx
// Client Component — tabla de alertas con botón resolver/reabrir
// ============================================================
'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Alerta {
  id: string
  grupo_id: string
  tipo: string
  severidad: string
  mensaje: string
  datos_json: Record<string, unknown> | null
  resuelta: boolean
  created_at: string
}

function severidadBadge(sev: string) {
  switch (sev) {
    case 'critica':
      return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'alta':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    case 'media':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

export default function AlertasTabla({
  alertas,
  tenantNombres,
}: {
  alertas: Alerta[]
  tenantNombres: Record<string, string>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function toggle(alertaId: string, resuelta: boolean) {
    setLoading(alertaId)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/resolver-alerta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alerta_id: alertaId,
          accion:    resuelta ? 'reabrir' : 'resolver',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  const noResueltas = alertas.filter(a => !a.resuelta).length
  const criticas    = alertas.filter(a => !a.resuelta && a.severidad === 'critica').length

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Alertas</h1>
        <p className="text-sm text-gray-400 mt-1">
          {noResueltas} sin resolver · {criticas} crítica{criticas !== 1 ? 's' : ''}
        </p>
      </header>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 w-24">Severidad</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tenant</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tipo</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Mensaje</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Fecha</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Acción</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map(a => {
              const tieneDatos = a.datos_json && Object.keys(a.datos_json).length > 0
              const isExpanded = expanded === a.id
              return (
                <Fragment key={a.id}>
                  <tr
                    className={`border-b border-gray-800 hover:bg-gray-800/30 transition ${a.resuelta ? 'opacity-50' : ''} ${tieneDatos ? 'cursor-pointer' : ''}`}
                    onClick={() => tieneDatos && setExpanded(isExpanded ? null : a.id)}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severidadBadge(a.severidad)}`}>
                        {a.severidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {tenantNombres[a.grupo_id] || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{a.tipo}</td>
                    <td className="px-4 py-3 text-sm text-gray-300 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{a.mensaje}</span>
                        {tieneDatos && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString('es-AR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggle(a.id, a.resuelta) }}
                        disabled={loading === a.id}
                        className={`text-xs font-medium px-2.5 py-1 rounded border transition ${
                          a.resuelta
                            ? 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                            : 'border-emerald-600/40 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                        } ${loading === a.id ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        {loading === a.id
                          ? '...'
                          : a.resuelta
                            ? 'Reabrir'
                            : 'Resolver'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && tieneDatos && (
                    <tr className="bg-gray-950/50 border-b border-gray-800">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="text-xs">
                          <p className="text-gray-500 font-medium mb-2 uppercase tracking-wider">Contexto técnico</p>
                          <pre className="text-gray-300 font-mono whitespace-pre-wrap break-words bg-black/30 p-3 rounded border border-gray-800">
                            {JSON.stringify(a.datos_json, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {alertas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay alertas registradas. Cuando algo falle (SMTP, cron, etc.) vas a verlo acá.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
