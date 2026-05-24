// ============================================================
// /app/superadmin/dashboard/page.tsx
// Dashboard de salud — KPIs globales + semáforo por tenant
// Server Component — acceso con service_role
// ============================================================

import { supabaseAdmin } from '@/lib/superadmin/supabase-admin'
import type { TenantConEstado, KPIsGlobales } from '@/types/superadmin'
import Link from 'next/link'

export const revalidate = 60 // revalidar cada 60 segundos

async function getKPIsYTenants(): Promise<{
  kpis: KPIsGlobales
  tenants: TenantConEstado[]
}> {
  // Tenants
  const { data: tenants } = await supabaseAdmin
    .from('grupos_trabajo')
    .select('id, nombre, slug, activo, created_at')
    .order('nombre')

  // Alertas activas por tenant
  const { data: alertas } = await supabaseAdmin
    .from('superadmin_alertas')
    .select('grupo_id, severidad')
    .eq('resuelta', false)

  // Proveedores por tenant
  const { data: proveedoresPorTenant } = await supabaseAdmin
    .from('proveedores')
    .select('grupo_id')

  // Módulos activos por tenant
  const { data: modulos } = await supabaseAdmin
    .from('grupos_modulos')
    .select('grupo_id, modulo')
    .eq('activo', true)

  const tenantsList = tenants ?? []
  const alertasList = alertas ?? []
  const proveedoresList = proveedoresPorTenant ?? []
  const modulosList = modulos ?? []

  // Calcular semáforo por tenant
  const tenantsConEstado: TenantConEstado[] = tenantsList.map(t => {
    const alertasTenant = alertasList.filter(a => a.grupo_id === t.id)
    const criticas = alertasTenant.filter(a => a.severidad === 'CRITICA').length
    const altas = alertasTenant.filter(a => a.severidad === 'ALTA' || a.severidad === 'MEDIA').length
    const proveedores = proveedoresList.filter(p => p.grupo_id === t.id).length
    const modulosActivos = modulosList.filter(m => m.grupo_id === t.id).map(m => m.modulo)

    let semaforo: 'verde' | 'amarillo' | 'rojo' = 'verde'
    if (criticas > 0) semaforo = 'rojo'
    else if (altas > 0) semaforo = 'amarillo'

    return {
      ...t,
      alertas_criticas: criticas,
      alertas_activas: alertasTenant.length,
      total_proveedores: proveedores,
      modulos_activos: modulosActivos,
      semaforo,
    }
  })

  const kpis: KPIsGlobales = {
    tenants_activos: tenantsList.filter(t => t.activo).length,
    tenants_totales: tenantsList.length,
    tenants_con_alertas: new Set(alertasList.map(a => a.grupo_id)).size,
    proveedores_totales: proveedoresList.length,
    alertas_criticas_activas: alertasList.filter(a => a.severidad === 'CRITICA').length,
  }

  return { kpis, tenants: tenantsConEstado }
}

const SEMAFORO_CONFIG = {
  verde:    { color: 'bg-green-500',  ring: 'ring-green-500/20',  label: 'Operativo',  text: 'text-green-400' },
  amarillo: { color: 'bg-yellow-400', ring: 'ring-yellow-400/20', label: 'Alerta',     text: 'text-yellow-400' },
  rojo:     { color: 'bg-red-500',    ring: 'ring-red-500/20',    label: 'Crítico',    text: 'text-red-400' },
}

export default async function SuperadminDashboard() {
  const { kpis, tenants } = await getKPIsYTenants()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard de salud</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estado operativo en tiempo real de todos los tenants</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Tenants activos" value={`${kpis.tenants_activos}/${kpis.tenants_totales}`} color="text-white" />
        <KpiCard label="Con alertas" value={kpis.tenants_con_alertas} color={kpis.tenants_con_alertas > 0 ? 'text-yellow-400' : 'text-white'} />
        <KpiCard label="Alertas críticas" value={kpis.alertas_criticas_activas} color={kpis.alertas_criticas_activas > 0 ? 'text-red-400' : 'text-white'} />
        <KpiCard label="Proveedores totales" value={kpis.proveedores_totales} color="text-white" />
        <KpiCard label="Actualizado" value="hace < 1min" color="text-gray-500" small />
      </div>

      {/* Grilla de tenants */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Tenants</h2>
        <div className="grid grid-cols-1 gap-2">
          {tenants.map(tenant => {
            const sem = SEMAFORO_CONFIG[tenant.semaforo]
            return (
              <Link
                key={tenant.id}
                href={`/superadmin/tenants/${tenant.id}`}
                className="flex items-center gap-4 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 hover:bg-gray-800/50 transition-all group"
              >
                {/* Semáforo */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sem.color} ring-4 ${sem.ring}`} />

                {/* Nombre + slug */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                    {tenant.nombre}
                  </p>
                  <p className="text-xs text-gray-600">{tenant.slug}</p>
                </div>

                {/* Estado */}
                <span className={`text-xs font-medium ${sem.text}`}>{sem.label}</span>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{tenant.total_proveedores} prov.</span>
                  <span>{tenant.modulos_activos.length} módulos</span>
                  {tenant.alertas_activas > 0 && (
                    <span className={tenant.alertas_criticas > 0 ? 'text-red-400' : 'text-yellow-400'}>
                      {tenant.alertas_activas} alerta{tenant.alertas_activas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}

          {tenants.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              No hay tenants registrados todavía.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, color, small
}: {
  label: string
  value: string | number
  color: string
  small?: boolean
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-semibold ${color} ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
    </div>
  )
}
