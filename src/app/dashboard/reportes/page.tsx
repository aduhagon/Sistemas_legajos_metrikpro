// src/app/dashboard/reportes/page.tsx
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import ReportesClient from './ReportesClient'

export default async function ReportesPage() {
  const supabase      = createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol, supervisor_scope').eq('id', user.id).single()
  if (!usuario) redirect('/login')

  const grupoId = await getGrupoId()
  const hoyStr = new Date().toISOString().split('T')[0]
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)
  const en30diasStr = en30dias.toISOString().split('T')[0]

  // ── Scope de establecimientos ──────────────────────────────────────────────
  const ROLES_SIN_SCOPE = ['admin', 'operador_acceso', 'auditor', 'operario']
  const tieneScope = !ROLES_SIN_SCOPE.includes(usuario.rol) && usuario.supervisor_scope === 'asignados'

  let establecimientosFiltro: string[] | null = null
  if (tieneScope) {
    const { data: estabsAsignados } = await supabase
      .from('usuario_establecimientos')
      .select('establecimiento_id')
      .eq('usuario_id', user.id)
    establecimientosFiltro = (estabsAsignados ?? []).map((r: any) => r.establecimiento_id)
  }

  // ── Proveedores — admin client para bypassar RLS ───────────────────────────
  let queryProveedores = supabaseAdmin
    .from('proveedores')
    .select('id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at, notif_vencimientos, establecimiento_id, rubros(nombre), documentos_legajo(id, estado)')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  if (tieneScope && establecimientosFiltro !== null && establecimientosFiltro.length > 0) {
    queryProveedores = queryProveedores.in('establecimiento_id', establecimientosFiltro)
  } else if (tieneScope && establecimientosFiltro?.length === 0) {
    // Sin establecimientos asignados → array vacío
  }

  const { data: todosProveedores } = await queryProveedores

  const provs   = todosProveedores ?? []
  const provIds = provs.map((p: any) => p.id)

  const stats = {
    total:       provs.length,
    pendientes:  provs.filter((p: any) => p.estado === 'PENDIENTE').length,
    enRevision:  provs.filter((p: any) => p.estado === 'EN_REVISION').length,
    aprobados:   provs.filter((p: any) => p.estado === 'APROBADO').length,
    rechazados:  provs.filter((p: any) => p.estado === 'RECHAZADO').length,
    suspendidos: provs.filter((p: any) => p.estado === 'SUSPENDIDO').length,
  }

  // ── Vencimientos — admin client ────────────────────────────────────────────
  const baseDocQuery = (estados: string[], desde?: string, hasta?: string) => {
    let q = supabaseAdmin
      .from('documentos_legajo')
      .select('id, fecha_venc, estado, documentos_requeridos(nombre), proveedores(id, razon_social, cuit, rubros(nombre))')
      .not('fecha_venc', 'is', null)
      .in('estado', estados)
      .order('fecha_venc', { ascending: desde ? true : false })
    if (desde) q = q.gte('fecha_venc', desde)
    if (hasta) q = q.lte('fecha_venc', hasta)
    if (provIds.length > 0) q = q.in('proveedor_id', provIds)
    return q
  }

  const [
    { data: vencidos },
    { data: vencimientos },
    { data: establecimientos },
    { data: accesos },
    { data: todosEquipos },
    { data: docsEquipoVencidos },
    { data: docsEquipoPorVencer },
    { data: actividad },
    { data: visitas },
  ] = await Promise.all([
    baseDocQuery(['CARGADO', 'APROBADO', 'VENCIDO'], undefined, hoyStr),
    baseDocQuery(['CARGADO', 'APROBADO'], hoyStr, en30diasStr),
    supabaseAdmin.from('establecimientos')
      .select('id, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('nombre'),
    supabaseAdmin.from('registros_acceso')
      .select(`id, tipo, created_at, lat, lng, dentro_perimetro, establecimiento_id,
        habilitaciones:habilitacion_id(proveedores:proveedor_id(id, razon_social, cuit, rubros(nombre)))`)
      .order('created_at', { ascending: false })
      .limit(500),
    // ── Equipos — admin client (bypasa RLS que bloqueaba estos datos) ─────────
    supabaseAdmin.from('equipos_contratista')
      .select(`id, dominio, marca, modelo, anio, estado, created_at,
        tipos_equipo(nombre, icono), proveedores(id, razon_social, cuit),
        documentos_equipo(id, estado, fecha_venc)`)
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('documentos_equipo')
      .select(`id, fecha_venc, documentos_requeridos_equipo(nombre),
        equipos_contratista(dominio, tipos_equipo(icono), proveedores(id, razon_social))`)
      .eq('estado', 'VENCIDO')
      .order('fecha_venc', { ascending: false }),
    supabaseAdmin.from('documentos_equipo')
      .select(`id, fecha_venc, documentos_requeridos_equipo(nombre),
        equipos_contratista(dominio, tipos_equipo(icono), proveedores(id, razon_social))`)
      .not('fecha_venc', 'is', null)
      .gte('fecha_venc', hoyStr)
      .lte('fecha_venc', en30diasStr)
      .in('estado', ['CARGADO', 'APROBADO'])
      .order('fecha_venc', { ascending: true }),
    supabase.rpc('fn_actividad_reciente', { p_limit: 50 }),
    supabaseAdmin.from('visitas_auditoria')
      .select(`id, visitado_at, resultado, estado_supervision,
        observacion, supervision_obs, offline, lat, lng,
        auditor:auditor_id ( nombre ),
        proveedor:proveedor_id ( razon_social, cuit ),
        establecimiento:establecimiento_id ( nombre ),
        checklist:visitas_checklist ( cumple, observacion, item:checklist_id ( nombre ) )`)
      .eq('grupo_id', grupoId)
      .order('visitado_at', { ascending: false }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Reportes</h1>
        <p className="text-zinc-500 text-sm">Métricas, accesos, vencimientos y exportación de datos</p>
        {tieneScope && (
          <p className="text-amber-400 text-xs mt-1">
            📍 Mostrando datos de tus establecimientos asignados únicamente
          </p>
        )}
      </div>
      <ReportesClient
        stats={stats}
        vencimientos={vencimientos ?? []}
        vencidos={vencidos ?? []}
        porRubro={provs}
        actividad={actividad ?? []}
        todosProveedores={provs}
        accesos={accesos ?? []}
        establecimientos={establecimientos ?? []}
        todosEquipos={todosEquipos ?? []}
        docsEquipoVencidos={docsEquipoVencidos ?? []}
        docsEquipoPorVencer={docsEquipoPorVencer ?? []}
        visitas={visitas ?? []}
        rol={usuario.rol}
      />
    </div>
  )
}
