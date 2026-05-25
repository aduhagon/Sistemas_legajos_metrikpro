// ============================================================
// /app/superadmin/alertas/page.tsx
// Server Component — fetch de alertas + tenants
// ============================================================

import AlertasTabla from './AlertasTabla'

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

export default async function AlertasPage() {
  const [alertas, tenants] = await Promise.all([
    fetchSupabase<Alerta[]>('superadmin_alertas?select=*&order=created_at.desc&limit=200'),
    fetchSupabase<Tenant[]>('grupos_trabajo?select=id,nombre'),
  ])

  const tenantNombres: Record<string, string> = {}
  for (const t of tenants) tenantNombres[t.id] = t.nombre

  return <AlertasTabla alertas={alertas} tenantNombres={tenantNombres} />
}
