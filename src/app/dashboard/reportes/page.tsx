import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import ReportesClient from './ReportesClient'

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (!usuario) redirect('/login')

  const grupoId = await getGrupoId()
  const hoyStr = new Date().toISOString().split('T')[0]
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)
  const en30diasStr = en30dias.toISOString().split('T')[0]

  // ── Proveedores ──────────────────────────────────────────
  const { data: todosProveedores } = await supabase
    .from('proveedores')
    .select('id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at, notif_vencimientos, rubros(nombre), documentos_legajo(id, estado)')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  const provs = todosProveedores ?? []
  const stats = {
    total:       provs.length,
    pendientes:  provs.filter((p: any) => p.estado === 'PENDIENTE').length,
    enRevision:  provs.filter((p: any) => p.estado === 'EN_REVISION').length,
    aprobados:   provs.filter((p: any) => p.estado === 'APROBADO').length,
    rechazados:  provs.filter((p: any) => p.estado === 'RECHAZADO').length,
    suspendidos: provs.filter((p: any) => p.estado === 'SUSPENDIDO').length,
  }

  // ── Vencimientos del legajo ──────────────────────────────
  const { data: vencidos } = await supabase
    .from('documentos_legajo')
    .select('id, fecha_venc, estado, documentos_requeridos(nombre), proveedores(id, razon_social, cuit, rubros(nombre))')
    .not('fecha_venc', 'is', null)
    .lt('fecha_venc', hoyStr)
    .in('estado', ['CARGADO', 'APROBADO', 'VENCIDO'])
    .order('fecha_venc', { ascending: false })

  const { data: vencimientos } = await supabase
    .from('documentos_legajo')
    .select('id, fecha_venc, estado, documentos_requeridos(nombre), proveedores(id, razon_social, cuit, rubros(nombre))')
    .not('fecha_venc', 'is', null)
    .gte('fecha_venc', hoyStr)
    .lte('fecha_venc', en30diasStr)
    .in('estado', ['CARGADO', 'APROBADO'])
    .order('fecha_venc', { ascending: true })

  // ── Establecimientos (para filtros) ──────────────────────
  const { data: establecimientos } = await supabase
    .from('establecimientos')
    .select('id, nombre')
    .eq('grupo_id', grupoId)
    .eq('activo', true)
    .order('nombre')

  // ── Accesos ──────────────────────────────────────────────
  const { data: accesos } = await supabase
    .from('registros_acceso')
    .select(`
      id, tipo, created_at, lat, lng, dentro_perimetro, establecimiento_id,
      habilitaciones:habilitacion_id(
        proveedores:proveedor_id(id, razon_social, cuit, rubros(nombre))
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  // ── Equipos ──────────────────────────────────────────────
  const { data: todosEquipos } = await supabase
    .from('equipos_contratista')
    .select(`
      id, dominio, marca, modelo, anio, estado, created_at,
      tipos_equipo(nombre, icono),
      proveedores(id, razon_social, cuit),
      documentos_equipo(id, estado, fecha_venc)
    `)
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  const { data: docsEquipoVencidos } = await supabase
    .from('documentos_equipo')
    .select(`
      id, fecha_venc,
      documentos_requeridos_equipo(nombre),
      equipos_contratista(
        dominio, tipos_equipo(icono),
        proveedores(id, razon_social)
      )
    `)
    .eq('estado', 'VENCIDO')
    .order('fecha_venc', { ascending: false })

  const { data: docsEquipoPorVencer } = await supabase
    .from('documentos_equipo')
    .select(`
      id, fecha_venc,
      documentos_requeridos_equipo(nombre),
      equipos_contratista(
        dominio, tipos_equipo(icono),
        proveedores(id, razon_social)
      )
    `)
    .not('fecha_venc', 'is', null)
    .gte('fecha_venc', hoyStr)
    .lte('fecha_venc', en30diasStr)
    .in('estado', ['CARGADO', 'APROBADO'])
    .order('fecha_venc', { ascending: true })

  // ── Actividad — UX-P-04: query enriquecida con nombres de negocio ──
  // JOIN con usuarios, proveedores y documentos para mostrar lenguaje natural
  const { data: actividadRaw } = await supabase
    .from('audit_log')
    .select(`
      id, accion, entidad, entidad_id, user_id, datos_json, created_at,
      usuarios:user_id ( nombre )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  // Enriquecer con nombres de proveedores y documentos según el tipo de entidad
  const actividad = await Promise.all(
    (actividadRaw ?? []).map(async (ev: any) => {
      let proveedor_nombre = null
      let proveedor_id = null
      let doc_nombre = null

      if (ev.entidad === 'proveedores' && ev.entidad_id) {
        const { data: p } = await supabase
          .from('proveedores')
          .select('id, razon_social')
          .eq('id', ev.entidad_id)
          .maybeSingle()
        proveedor_nombre = p?.razon_social ?? null
        proveedor_id = p?.id ?? null

      } else if (ev.entidad === 'documentos_legajo' && ev.entidad_id) {
        const { data: dl } = await supabase
          .from('documentos_legajo')
          .select('proveedor_id, documentos_requeridos(nombre), proveedores(id, razon_social)')
          .eq('id', ev.entidad_id)
          .maybeSingle()
        doc_nombre = (dl?.documentos_requeridos as any)?.nombre ?? null
        proveedor_nombre = (dl?.proveedores as any)?.razon_social ?? null
        proveedor_id = (dl?.proveedores as any)?.id ?? null

      } else if (ev.entidad === 'documentos_equipo' && ev.entidad_id) {
        const { data: de } = await supabase
          .from('documentos_equipo')
          .select('equipos_contratista(proveedores(id, razon_social)), documentos_requeridos_equipo(nombre)')
          .eq('id', ev.entidad_id)
          .maybeSingle()
        doc_nombre = (de?.documentos_requeridos_equipo as any)?.nombre ?? null
        const prov = (de?.equipos_contratista as any)?.proveedores
        proveedor_nombre = prov?.razon_social ?? null
        proveedor_id = prov?.id ?? null

      } else if (ev.entidad === 'visitas_auditoria' && ev.entidad_id) {
        const { data: va } = await supabase
          .from('visitas_auditoria')
          .select('proveedor_id, proveedores(id, razon_social)')
          .eq('id', ev.entidad_id)
          .maybeSingle()
        proveedor_nombre = (va?.proveedores as any)?.razon_social ?? null
        proveedor_id = (va?.proveedores as any)?.id ?? null

      } else if (ev.entidad === 'equipos_contratista' && ev.entidad_id) {
        const { data: ec } = await supabase
          .from('equipos_contratista')
          .select('proveedores(id, razon_social)')
          .eq('id', ev.entidad_id)
          .maybeSingle()
        proveedor_nombre = (ec?.proveedores as any)?.razon_social ?? null
        proveedor_id = (ec?.proveedores as any)?.id ?? null
      }

      return {
        ...ev,
        usuario_nombre: (ev.usuarios as any)?.nombre ?? null,
        proveedor_nombre,
        proveedor_id,
        doc_nombre,
      }
    })
  )

  // ── Visitas de auditoría ─────────────────────────────────
  const { data: visitas } = await supabase
    .from('visitas_auditoria')
    .select(`
      id, visitado_at, resultado, estado_supervision,
      observacion, supervision_obs, offline, lat, lng,
      auditor:auditor_id ( nombre ),
      proveedor:proveedor_id ( razon_social, cuit ),
      establecimiento:establecimiento_id ( nombre ),
      checklist:visitas_checklist (
        cumple, observacion,
        item:checklist_id ( nombre )
      )
    `)
    .eq('grupo_id', grupoId)
    .order('visitado_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Reportes</h1>
        <p className="text-zinc-500 text-sm">Métricas, accesos, vencimientos y exportación de datos</p>
      </div>
      <ReportesClient
        stats={stats}
        vencimientos={vencimientos ?? []}
        vencidos={vencidos ?? []}
        porRubro={provs}
        actividad={actividad}
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
