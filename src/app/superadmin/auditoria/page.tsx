// ============================================================
// /app/superadmin/auditoria/page.tsx
// Server Component — fetch de audit log con filtros y paginación
// Filtros: superadmin, accion, tenant, page
// ============================================================

import AuditoriaTabla from './AuditoriaTabla'
import AuditoriaFiltros from './AuditoriaFiltros'

export const dynamic = 'force-dynamic'

interface AuditLog {
  id: string
  superadmin_id: string
  accion: string
  grupo_id: string | null
  datos_json: Record<string, unknown> | null
  created_at: string
}

interface Superadmin {
  id: string
  nombre: string | null
  email: string
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

async function fetchLogsWithCount(qs: string): Promise<{ data: AuditLog[]; total: number }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_audit_log?${qs}`
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      Prefer:        'count=exact',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  const data = (await res.json()) as AuditLog[]
  const cr = res.headers.get('content-range') ?? ''
  const total = parseInt(cr.split('/')[1] ?? '0', 10) || data.length
  return { data, total }
}

async function fetchAccionesUnicas(): Promise<string[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_audit_log?select=accion&limit=1000`
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { accion: string }[]
  return Array.from(new Set(data.map(d => d.accion))).sort()
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    superadmin?: string
    accion?: string
    tenant?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const superadminId = sp.superadmin ?? ''
  const accion       = sp.accion ?? ''
  const tenantId     = sp.tenant ?? ''
  const page         = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const filtros: string[] = []
  if (superadminId) filtros.push(`superadmin_id=eq.${superadminId}`)
  if (accion)       filtros.push(`accion=eq.${accion}`)
  if (tenantId)     filtros.push(`grupo_id=eq.${tenantId}`)

  filtros.push('select=*')
  filtros.push('order=created_at.desc')

  const offset = (page - 1) * PAGE_SIZE
  filtros.push(`offset=${offset}`)
  filtros.push(`limit=${PAGE_SIZE}`)

  const [logsResult, superadmins, tenants, acciones] = await Promise.all([
    fetchLogsWithCount(filtros.join('&')),
    fetchSupabase<Superadmin[]>('usuarios_metrikpro?select=id,nombre,email&order=nombre.asc'),
    fetchSupabase<Tenant[]>('grupos_trabajo?select=id,nombre&order=nombre.asc'),
    fetchAccionesUnicas(),
  ])

  const saNombres: Record<string, string> = {}
  for (const s of superadmins) saNombres[s.id] = s.nombre || s.email

  const tenantNombres: Record<string, string> = {}
  for (const t of tenants) tenantNombres[t.id] = t.nombre

  const totalPages = Math.max(1, Math.ceil(logsResult.total / PAGE_SIZE))

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Auditoría</h1>
        <p className="text-sm text-gray-400 mt-1">
          {logsResult.total} registro{logsResult.total !== 1 ? 's' : ''} con los filtros actuales
        </p>
      </header>

      <AuditoriaFiltros
        superadmins={superadmins}
        tenants={tenants}
        acciones={acciones}
      />

      <AuditoriaTabla
        logs={logsResult.data}
        saNombres={saNombres}
        tenantNombres={tenantNombres}
        page={page}
        totalPages={totalPages}
        total={logsResult.total}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
