// ============================================================
// /app/superadmin/alertas/page.tsx
// Listado de alertas operativas del sistema
// ============================================================

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

function severidadBadge(sev: string) {
  switch (sev) {
    case 'critica':
      return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'alta':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    case 'media':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

export default async function AlertasPage() {
  const [alertas, tenants] = await Promise.all([
    fetchSupabase<Alerta[]>('superadmin_alertas?select=*&order=created_at.desc&limit=200'),
    fetchSupabase<Tenant[]>('grupos_trabajo?select=id,nombre'),
  ])

  const tenantNombres = new Map(tenants.map(t => [t.id, t.nombre]))
  const noResueltas = alertas.filter(a => !a.resuelta).length
  const criticas = alertas.filter(a => !a.resuelta && a.severidad === 'critica').length

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Alertas</h1>
        <p className="text-sm text-gray-400 mt-1">
          {noResueltas} sin resolver · {criticas} crítica{criticas !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Severidad</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tenant</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Tipo</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Mensaje</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Fecha</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map(a => (
              <tr key={a.id} className={`border-b border-gray-800 hover:bg-gray-800/30 ${a.resuelta ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severidadBadge(a.severidad)}`}>
                    {a.severidad}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {tenantNombres.get(a.grupo_id) || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">{a.tipo}</td>
                <td className="px-4 py-3 text-sm text-gray-300 max-w-md truncate">{a.mensaje}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString('es-AR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  {a.resuelta ? (
                    <span className="text-xs text-gray-500">Resuelta</span>
                  ) : (
                    <span className="text-xs text-amber-400 font-medium">Pendiente</span>
                  )}
                </td>
              </tr>
            ))}
            {alertas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay alertas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
