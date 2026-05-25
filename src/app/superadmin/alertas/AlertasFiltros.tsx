// ============================================================
// /app/superadmin/alertas/AlertasFiltros.tsx
// Client Component — UI de filtros (severidad, estado, tenant)
// Empuja cambios a la URL via router.push para mantener server-side rendering
// ============================================================
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Tenant {
  id: string
  nombre: string
}

export default function AlertasFiltros({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter()
  const sp = useSearchParams()

  const severidad = sp.get('severidad') ?? ''
  const estado    = sp.get('estado') ?? 'pendientes'
  const tenant    = sp.get('tenant') ?? ''

  function aplicar(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else       params.delete(key)
    // Cualquier cambio de filtro resetea la página
    params.delete('page')
    router.push(`/superadmin/alertas?${params.toString()}`)
  }

  function limpiar() {
    router.push('/superadmin/alertas')
  }

  const hayFiltros = severidad !== '' || estado !== 'pendientes' || tenant !== ''

  return (
    <div className="mb-4 flex flex-wrap gap-3 items-center">
      <select
        value={estado}
        onChange={(e) => aplicar('estado', e.target.value === 'pendientes' ? '' : e.target.value)}
        className="bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 hover:border-gray-700 transition"
      >
        <option value="pendientes">Solo pendientes</option>
        <option value="resueltas">Solo resueltas</option>
        <option value="todas">Todas</option>
      </select>

      <select
        value={severidad}
        onChange={(e) => aplicar('severidad', e.target.value)}
        className="bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 hover:border-gray-700 transition"
      >
        <option value="">Todas las severidades</option>
        <option value="critica">Crítica</option>
        <option value="alta">Alta</option>
        <option value="media">Media</option>
        <option value="info">Info</option>
      </select>

      <select
        value={tenant}
        onChange={(e) => aplicar('tenant', e.target.value)}
        className="bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 hover:border-gray-700 transition"
      >
        <option value="">Todos los tenants</option>
        {tenants.map(t => (
          <option key={t.id} value={t.id}>{t.nombre}</option>
        ))}
      </select>

      {hayFiltros && (
        <button
          onClick={limpiar}
          className="text-xs text-gray-400 hover:text-gray-200 underline transition"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
