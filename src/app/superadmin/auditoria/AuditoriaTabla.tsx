// ============================================================
// /app/superadmin/auditoria/AuditoriaTabla.tsx
// Client Component — tabla con paginación
// ============================================================
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface AuditLog {
  id: string
  superadmin_id: string
  accion: string
  grupo_id: string | null
  datos_json: Record<string, unknown> | null
  created_at: string
}

export default function AuditoriaTabla({
  logs,
  saNombres,
  tenantNombres,
  page,
  totalPages,
  total,
  pageSize,
}: {
  logs: AuditLog[]
  saNombres: Record<string, string>
  tenantNombres: Record<string, string>
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function irAPagina(p: number) {
    const params = new URLSearchParams(sp.toString())
    if (p <= 1) params.delete('page')
    else        params.set('page', String(p))
    router.push(`/superadmin/auditoria?${params.toString()}`)
  }

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Fecha</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Superadmin</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Acción</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tenant</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('es-AR', {
                    day: '2-digit', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {saNombres[l.superadmin_id] || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-blue-400">{l.accion}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {l.grupo_id ? (tenantNombres[l.grupo_id] || '—') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono max-w-md truncate">
                  {l.datos_json ? JSON.stringify(l.datos_json) : '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay registros con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <p>Mostrando {desde}–{hasta} de {total}</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => irAPagina(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-800 hover:border-gray-700 hover:text-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-gray-500">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => irAPagina(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-gray-800 hover:border-gray-700 hover:text-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
