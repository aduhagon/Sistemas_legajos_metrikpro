// ============================================================
// /app/superadmin/alertas/page.tsx
// Server Component — fetch de alertas con filtros y paginación
// Filtros via searchParams: severidad, estado, tenant, page
// ============================================================

import AlertasTabla from './AlertasTabla'
import AlertasFiltros from './AlertasFiltros'

export const dynamic = 'force-dynamic'

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

interface Tenant {
  id: string
  nombre: string
}

const PAGE_SIZE = 30

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

async function fetchAlertasWithCount(qs: string): Promise<{ data: Alerta[]; total: number }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_alertas?${qs}`
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      Prefer:        'count=exact',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  const data = (await res.json()) as Alerta[]
  const cr = res.headers.get('content-range') ?? ''
  const total = parseInt(cr.split('/')[1] ?? '0', 10) || data.length
  return { data, total }
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{
    severidad?: string
    estado?: string
    tenant?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const severidad = sp.severidad ?? ''
  const estado    = sp.estado ?? 'pendientes'
  const tenantId  = sp.tenant ?? ''
  const page      = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const filtros: string[] = []
  if (severidad)               filtros.push(`severidad=eq.${severidad}`)
  if (estado === 'pendientes') filtros.push(`resuelta=eq.false`)
  if (estado === 'resueltas')  filtros.push(`resuelta=eq.true`)
  if (tenantId)                filtros.push(`grupo_id=eq.${tenantId}`)

  filtros.push('select=*')
  filtros.push('order=created_at.desc')

  const offset = (page - 1) * PAGE_SIZE
  filtros.push(`offset=${offset}`)
  filtros.push(`limit=${PAGE_SIZE}`)

  const [alertasResult, tenants] = await Promise.all([
    fetchAlertasWithCount(filtros.join('&')),
    fetchSupabase<Tenant[]>('grupos_trabajo?select=id,nombre&order=nombre.asc'),
  ])

  const tenantNombres: Record<string, string> = {}
  for (const t of tenants) tenantNombres[t.id] = t.nombre

  const totalPages = Math.max(1, Math.ceil(alertasResult.total / PAGE_SIZE))

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Alertas</h1>
        <p className="text-sm text-gray-400 mt-1">
          {alertasResult.total} alerta{alertasResult.total !== 1 ? 's' : ''} con los filtros actuales
        </p>
      </header>

      <AlertasFiltros tenants={tenants} />

      <AlertasTabla
        alertas={alertasResult.data}
        tenantNombres={tenantNombres}
        page={page}
        totalPages={totalPages}
        total={alertasResult.total}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
