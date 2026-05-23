import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import ReportesClient from './ReportesClient'

const VISITAS_SELECT = `
  id, visitado_at, resultado, estado_supervision,
  observacion, supervision_obs, offline, lat, lng,
  auditor:auditor_id ( nombre ),
  proveedor:proveedor_id ( razon_social, cuit ),
  establecimiento:establecimiento_id ( nombre ),
  checklist:visitas_checklist (
    cumple, observacion,
    item:checklist_id ( nombre )
  )
`

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (!usuario) redirect('/login')

  const grupoId = await getGrupoId()

  const [
    { data: proveedores },
    { data: vencimientos },
    { data: accesos },
    { data: equipos },
    { data: visitas },
  ] = await Promise.all([
    supabase
      .from('proveedores')
      .select('id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at, notif_vencimientos, rubro:rubro_id(nombre)')
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false }),

    supabase
      .from('documentos_legajo')
      .select('id, fecha_venc, estado, tipo_doc:tipo_doc_id(nombre), proveedor:proveedor_id(id, razon_social)')
      .not('fecha_venc', 'is', null)
      .in('estado', ['CARGADO', 'APROBADO', 'VENCIDO'])
      .eq('grupo_id', grupoId)
      .order('fecha_venc'),

    supabase
      .from('registros_acceso')
      .select('id, tipo, created_at, lat, lng, dentro_perimetro, habilitacion:habilitacion_id(proveedor:proveedor_id(razon_social, cuit))')
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('equipos_contratista')
      .select('id, dominio, marca, modelo, estado, tipo:tipo_equipo_id(nombre, icono), proveedor:proveedor_id(razon_social)')
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false }),

    supabase
      .from('visitas_auditoria')
      .select(VISITAS_SELECT)
      .eq('grupo_id', grupoId)
      .order('visitado_at', { ascending: false }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Reportes</h1>
        <p className="text-zinc-500 text-sm">Métricas, accesos, vencimientos y exportación de datos</p>
      </div>
      <ReportesClient
        proveedores={proveedores ?? []}
        vencimientos={vencimientos ?? []}
        accesos={accesos ?? []}
        equipos={equipos ?? []}
        visitas={visitas ?? []}
        rol={usuario.rol}
      />
    </div>
  )
}
