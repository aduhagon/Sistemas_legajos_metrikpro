// ============================================================
// /app/superadmin/tenants/[id]/tabs/NotasTab.tsx
// Tab Notas — notas internas del SuperAdmin sobre el tenant
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { NotaUI } from '../page'

export default function NotasTab({ notas, grupoId }: { notas: NotaUI[]; grupoId: string }) {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!nueva.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/tenant-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion:   'add_nota',
          grupo_id: grupoId,
          payload:  { nota: nueva.trim() },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error')
      setNueva('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Form de nueva nota */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-1">Agregar nota interna</h3>
        <p className="text-xs text-gray-500 mb-3">
          Notas internas del SuperAdmin. No son visibles para el cliente. Útiles para anotar tickets, llamadas, condiciones especiales.
        </p>
        <textarea
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Llamó Pedro a las 14h pidiendo aumento de cuota..."
          rows={3}
          className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none resize-y"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={guardar}
            disabled={loading || !nueva.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition"
          >
            {loading ? 'Guardando...' : 'Agregar nota'}
          </button>
        </div>
      </div>

      {/* Listado de notas */}
      <h3 className="text-sm font-semibold text-white mb-3">
        Historial de notas {notas.length > 0 && <span className="text-gray-500 font-normal">({notas.length})</span>}
      </h3>

      {notas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500">Todavía no hay notas sobre este tenant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map(n => (
            <div key={n.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-gray-400 font-medium">{n.superadmin_nombre}</span>
                <span className="text-gray-500">
                  {new Date(n.created_at).toLocaleString('es-AR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.nota}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
