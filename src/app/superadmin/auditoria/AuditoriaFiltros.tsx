// ============================================================
// /app/superadmin/auditoria/AuditoriaFiltros.tsx
// Client Component — filtros (superadmin, acción, tenant)
// ============================================================
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Superadmin {
  id: string
  nombre: string | null
  email: string
}

interface Tenant {
  id: string
  nombre: string
}

export default function AuditoriaFiltros({
  superadmins,
  tenants,
  acciones,
}: {
  superadmins: Superadmin[]
  tenants: Tenant[]
  acciones: string[]
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const supId  = sp.get('superadmin') ?? ''
  const accion = sp.get('accion') ?? ''
  const tenant = sp.get('tenant') ?? ''

  function aplicar(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else       params.delete(key)
    params.delete('page')
    router.push(`/superadmin/auditoria?${params.toString()}`)
  }

  function limpiar() {
    router.push('/superadmin/auditoria')
  }

  const hayFiltros = supId !== '' || accion !== '' || tenant !== ''

  return (
    <div className="mb-4 flex flex-wrap gap-3 items-center">
      <select
        value={supId}
        onChange={(e) => aplicar('superadmin', e.target.value)}
        className="bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 hover:border-gray-700 transition"
      >
        <option value="">Todos los superadmins</option>
        {superadmins.map(s => (
          <option key={s.id} value={s.id}>{s.nombre || s.email}</option>
        ))}
      </select>

      <select
        value={accion}
        onChange={(e) => aplicar('accion', e.target.value)}
        className="bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 hover:border-gray-700 transition"
      >
        <option value="">Todas las acciones</option>
        {acciones.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
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
