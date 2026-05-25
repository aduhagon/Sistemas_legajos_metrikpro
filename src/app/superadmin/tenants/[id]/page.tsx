// ============================================================
// /app/superadmin/tenants/[id]/page.tsx
// Detalle del tenant con tabs (General/Módulos/Admins/Datos/Config/Notas)
// ============================================================

import Link from 'next/link'
import TabsNav from './TabsNav'
import GeneralTab    from './tabs/GeneralTab'
import ModulosTab    from './tabs/ModulosTab'
import AdminsTab     from './tabs/AdminsTab'
import DatosTab      from './tabs/DatosTab'
import ConfigTab     from './tabs/ConfigTab'
import NotasTab      from './tabs/NotasTab'

export const dynamic = 'force-dynamic'

// ============================================================
// Tipos
// ============================================================
export interface Tenant {
  id: string
  nombre: string
  slug: string
  activo: boolean
  created_at: string
  plan: 'basico' | 'pro' | 'enterprise' | null
  plan_desde: string | null
  plan_hasta: string | null
  estado_cuenta: 'al_dia' | 'pendiente_pago' | 'suspendido'
  razon_social: string | null
  cuit: string | null
  direccion: string | null
  telefono: string | null
  contacto_facturacion_nombre: string | null
  contacto_facturacion_email: string | null
  contacto_tecnico_nombre: string | null
  contacto_tecnico_email: string | null
  importe_mensual: number | null
  moneda: string | null
}

export interface ModuloUI {
  modulo: string
  nombre: string
  descripcion: string
  plan: 'core' | 'addon' | 'premium'
  orden: number
  es_core_critico: boolean
  activo: boolean
  updated_at: string | null
}

export interface AdminUser {
  id: string
  nombre: string
  email: string
  primer_login: boolean
  activo: boolean
  created_at: string | null
}

export interface ConfigUI {
  nombre_display: string | null
  tagline: string | null
  color_primario: string
  color_acento: string
  color_fondo: string
  tipografia: string
  logo_url: string | null
  fondo_login_url: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_from_name: string | null
  smtp_from_email: string | null
  notif_evaluador_email: string | null
}

export interface NotaUI {
  id: string
  nota: string
  created_at: string
  superadmin_id: string
  superadmin_nombre: string
}

interface KpisUso {
  proveedores_total: number
  proveedores_activos_30d: number
  docs_total: number
  docs_30d: number
  accesos_30d: number
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

async function fetchKpis(grupoId: string): Promise<KpisUso> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/fn_kpis_tenant`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_grupo_id: grupoId }),
    cache: 'no-store',
  })
  if (!res.ok) {
    return { proveedores_total: 0, proveedores_activos_30d: 0, docs_total: 0, docs_30d: 0, accesos_30d: 0 }
  }
  return res.json() as Promise<KpisUso>
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const tabActiva = sp.tab ?? 'general'

  const [
    tenantArr,
    modulosTenant,
    catalogo,
    adminsArr,
    configArr,
    notasArr,
    superadmins,
    kpis,
  ] = await Promise.all([
    fetchSupabase<Tenant[]>(`grupos_trabajo?id=eq.${id}&select=*&limit=1`),
    fetchSupabase<{ id: string; modulo: string; activo: boolean; plan: string | null; updated_at: string | null }[]>(
      `grupos_modulos?grupo_id=eq.${id}&select=*`
    ),
    fetchSupabase<{
      modulo: string; nombre: string; descripcion: string;
      plan: string; orden: number; es_core_critico: boolean;
    }[]>(`catalogo_modulos?select=*&order=orden.asc`),
    fetchSupabase<AdminUser[]>(
      `usuarios?grupo_id=eq.${id}&rol=eq.admin&select=id,nombre,email,primer_login,activo,created_at&order=created_at.asc`
    ),
    fetchSupabase<ConfigUI[]>(`grupos_config?grupo_id=eq.${id}&select=*&limit=1`),
    fetchSupabase<{ id: string; nota: string; created_at: string; superadmin_id: string }[]>(
      `tenant_notas?grupo_id=eq.${id}&select=*&order=created_at.desc`
    ),
    fetchSupabase<{ id: string; nombre: string | null; email: string }[]>(
      `usuarios_metrikpro?select=id,nombre,email`
    ),
    fetchKpis(id),
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

  const estadoPorModulo = new Map(modulosTenant.map(m => [m.modulo, m]))
  const modulosUI: ModuloUI[] = catalogo.map(c => {
    const estado = estadoPorModulo.get(c.modulo)
    return {
      modulo:          c.modulo,
      nombre:          c.nombre,
      descripcion:     c.descripcion,
      plan:            c.plan as 'core' | 'addon' | 'premium',
      orden:           c.orden,
      es_core_critico: c.es_core_critico,
      activo:          estado?.activo ?? false,
      updated_at:      estado?.updated_at ?? null,
    }
  })

  const saMap = new Map(superadmins.map(s => [s.id, s.nombre || s.email]))
  const notasUI: NotaUI[] = notasArr.map(n => ({
    ...n,
    superadmin_nombre: saMap.get(n.superadmin_id) ?? '—',
  }))

  const config = configArr[0] ?? null
  const activosCount = modulosUI.filter(m => m.activo).length
  const planLabel = tenant.plan === 'basico' ? 'Básico' : tenant.plan === 'pro' ? 'Pro' : tenant.plan === 'enterprise' ? 'Enterprise' : '—'

  const estadoBadge = {
    al_dia:         { label: 'Al día',          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    pendiente_pago: { label: 'Pendiente de pago', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    suspendido:     { label: 'Suspendido',      color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }[tenant.estado_cuenta]

  return (
    <div className="p-8">
      <Link href="/superadmin/tenants" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
        ← Volver a tenants
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">{tenant.nombre}</h1>
          {tenant.activo ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              Suspendido
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${estadoBadge.color}`}>
            {estadoBadge.label}
          </span>
          {tenant.plan && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {planLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">{tenant.slug}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Proveedores" valor={kpis.proveedores_total} sublabel={`${kpis.proveedores_activos_30d} activos 30d`} />
        <KpiCard label="Documentos" valor={kpis.docs_total} sublabel={`${kpis.docs_30d} cargados 30d`} />
        <KpiCard label="Accesos QR 30d" valor={kpis.accesos_30d} />
        <KpiCard label="Módulos activos" valor={`${activosCount}/${modulosUI.length}`} />
        <KpiCard
          label="Plan vence"
          valor={tenant.plan_hasta ? new Date(tenant.plan_hasta + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
          sublabel={tenant.plan_hasta ? '' : 'sin vencimiento'}
        />
      </div>

      <TabsNav tabActiva={tabActiva} />

      <div className="mt-6">
        {tabActiva === 'general'  && <GeneralTab tenant={tenant} />}
        {tabActiva === 'modulos'  && <ModulosTab modulos={modulosUI} grupoId={tenant.id} />}
        {tabActiva === 'admins'   && <AdminsTab admins={adminsArr} grupoId={tenant.id} />}
        {tabActiva === 'datos'    && <DatosTab tenant={tenant} />}
        {tabActiva === 'config'   && <ConfigTab config={config} grupoId={tenant.id} />}
        {tabActiva === 'notas'    && <NotasTab notas={notasUI} grupoId={tenant.id} />}
      </div>
    </div>
  )
}

function KpiCard({ label, valor, sublabel }: { label: string; valor: string | number; sublabel?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-semibold text-white mt-1">{valor}</p>
      {sublabel && <p className="text-[10px] text-gray-500 mt-0.5">{sublabel}</p>}
    </div>
  )
}
