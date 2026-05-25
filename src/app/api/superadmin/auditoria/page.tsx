// ============================================================
// /app/superadmin/auditoria/page.tsx
// Log de auditoría de acciones del superadmin
// ============================================================

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
  nombre: string
  email: string
}

interface Tenant {
  id: string
  nombre: string
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

export default async function AuditoriaPage() {
  const [logs, superadmins, tenants] = await Promise.all([
    fetchSupabase<AuditLog[]>('superadmin_audit_log?select=*&order=created_at.desc&limit=200'),
    fetchSupabase<Superadmin[]>('usuarios_metrikpro?select=id,nombre,email'),
    fetchSupabase<Tenant[]>('grupos_trabajo?select=id,nombre'),
  ])

  const saNombres = new Map(superadmins.map(s => [s.id, s.nombre || s.email]))
  const tenantNombres = new Map(tenants.map(t => [t.id, t.nombre]))

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Auditoría</h1>
        <p className="text-sm text-gray-400 mt-1">
          Últimas {logs.length} acciones del panel SuperAdmin
        </p>
      </header>

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
                  {saNombres.get(l.superadmin_id) || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-blue-400">{l.accion}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {l.grupo_id ? (tenantNombres.get(l.grupo_id) || '—') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono max-w-md truncate">
                  {l.datos_json ? JSON.stringify(l.datos_json) : '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay registros de auditoría.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
