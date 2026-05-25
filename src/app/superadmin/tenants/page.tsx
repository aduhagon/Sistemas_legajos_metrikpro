// ============================================================
// /app/superadmin/tenants/page.tsx
// Lista de todos los tenants con su estado
// ============================================================

import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Tenant {
  id: string
  nombre: string
  slug: string
  activo: boolean
  created_at: string
}

interface ModuloRow {
  grupo_id: string
  activo: boolean
}

interface AlertaRow {
  grupo_id: string
  severidad: string
  resuelta: boolean
}

async function fetchSupabase<T>(path: string): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json() as Promise<T>
}

export default async function TenantsPage() {
  // 1. Lista de tenants
  const tenants = await fetchSupabase<Tenant[]>(
    'grupos_trabajo?select=id,nombre,slug,activo,created_at&order=nombre.asc'
  )

  // 2. Conteo de módulos activos por tenant
  const modulos = await fetchSupabase<ModuloRow[]>(
    'grupos_modulos?select=grupo_id,activo'
  )
  const modulosPorTenant = new Map<string, { total: number; activos: number }>()
  for (const m of modulos) {
    const acc = modulosPorTenant.get(m.grupo_id) ?? { total: 0, activos: 0 }
    acc.total++
    if (m.activo) acc.activos++
    modulosPorTenant.set(m.grupo_id, acc)
  }

  // 3. Conteo de alertas no resueltas por tenant
  const alertas = await fetchSupabase<AlertaRow[]>(
    'superadmin_alertas?select=grupo_id,severidad,resuelta&resuelta=eq.false'
  )
  const alertasPorTenant = new Map<string, { total: number; criticas: number }>()
  for (const a of alertas) {
    const acc = alertasPorTenant.get(a.grupo_id) ?? { total: 0, criticas: 0 }
    acc.total++
    if (a.severidad === 'critica') acc.criticas++
    alertasPorTenant.set(a.grupo_id, acc)
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Tenants</h1>
        <p className="text-sm text-gray-400 mt-1">
          {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registrado{tenants.length !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tenant</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Módulos</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Alertas</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => {
              const mod = modulosPorTenant.get(t.id) ?? { total: 0, activos: 0 }
              const alr = alertasPorTenant.get(t.id) ?? { total: 0, criticas: 0 }
              return (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{t.nombre}</div>
                    <div className="text-xs text-gray-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {t.activo ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {mod.activos} / {mod.total}
                  </td>
                  <td className="px-4 py-3">
                    {alr.total === 0 ? (
                      <span className="text-sm text-gray-500">—</span>
                    ) : alr.criticas > 0 ? (
                      <span className="text-sm font-medium text-red-400">
                        {alr.total} ({alr.criticas} crítica{alr.criticas !== 1 ? 's' : ''})
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-amber-400">{alr.total}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay tenants registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
