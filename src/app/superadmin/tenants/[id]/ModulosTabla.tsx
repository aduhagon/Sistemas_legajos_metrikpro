// ============================================================
// /app/superadmin/tenants/[id]/ModulosTabla.tsx
// Client Component — tabla con toggles de módulos
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Modulo {
  id: string
  grupo_id: string
  modulo: string
  activo: boolean
  plan: string | null
  updated_at: string | null
}

export default function ModulosTabla({
  modulos,
  grupoId,
}: {
  modulos: Modulo[]
  grupoId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(modulo: string, nuevoEstado: boolean) {
    setLoading(modulo)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/toggle-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_id: grupoId, modulo, activo: nuevoEstado }),
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

  return (
    <>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Módulo</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Plan</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Actualizado</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {modulos.map(m => (
              <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm text-white font-mono">{m.modulo}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{m.plan || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {m.updated_at
                    ? new Date(m.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(m.modulo, !m.activo)}
                    disabled={loading === m.modulo}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      m.activo ? 'bg-emerald-500' : 'bg-gray-700'
                    } ${loading === m.modulo ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
                        m.activo ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
            {modulos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay módulos configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
