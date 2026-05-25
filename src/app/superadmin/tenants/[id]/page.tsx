// ============================================================
// /app/superadmin/tenants/[id]/page.tsx
// Detalle de un tenant — info + toggle de módulos
// ============================================================

import Link from 'next/link'
import ModulosTabla from './ModulosTabla'

export const dynamic = 'force-dynamic'

interface Tenant {
  id: string
  nombre: string
  slug: string
  activo: boolean
  created_at: string
}

interface Modulo {
  id: string
  grupo_id: string
  modulo: string
  activo: boolean
  plan: string | null
  config: Record<string, unknown> | null
  updated_at: string | null
}

interface Proveedor {
  id: string
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

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [tenantArr, modulos, proveedores] = await Promise.all([
    fetchSupabase<Tenant[]>(`grupos_trabajo?id=eq.${id}&select=*&limit=1`),
    fetchSupabase<Modulo[]>(`grupos_modulos?grupo_id=eq.${id}&select=*&order=modulo.asc`),
    fetchSupabase<Proveedor[]>(`proveedores?grupo_id=eq.${id}&select=id`),
  ])

  const tenant = tenantArr[0]

  if (!tenant) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-400">Tenant no encontrado.</p>
        <Link href="/superadmin/tenants" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
          ← Volver
        </Link>
      </div>
    )
  }

  const activosCount = modulos.filter(m => m.activo).length

  return (
    <div className="p-8">
      <Link href="/superadmin/tenants" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
        ← Volver a tenants
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-semibold text-white">{tenant.nombre}</h1>
          {tenant.activo ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              Inactivo
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">{tenant.slug}</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Módulos activos</p>
          <p className="text-2xl font-semibold text-white mt-1">
            {activosCount} <span className="text-base text-gray-500 font-normal">/ {modulos.length}</span>
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Proveedores</p>
          <p className="text-2xl font-semibold text-white mt-1">{proveedores.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Creado</p>
          <p className="text-sm font-medium text-white mt-2">
            {new Date(tenant.created_at).toLocaleDateString('es-AR', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Módulos */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Módulos</h2>
        <ModulosTabla modulos={modulos} grupoId={tenant.id} />
      </section>
    </div>
  )
}
