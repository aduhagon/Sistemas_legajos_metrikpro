import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PortalClient from './PortalClient'

export default async function ProveedorPortalPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/proveedor/login')

  const { data: provVerif } = await supabase
    .rpc('verificar_proveedor_usuario', { p_user_id: user.id })

  if (!provVerif) redirect('/proveedor/login')

  const [
    { data: proveedor },
    { data: docs },
    { data: habilitacion },
    { data: operarios },
    { data: visitasAuditoria },
  ] = await Promise.all([
    supabase
      .from('proveedores')
      .select('id, razon_social, cuit, estado, email, telefono, notif_vencimientos, rubros(nombre), created_at')
      .eq('id', provVerif.proveedor_id)
      .single(),
    supabase
      .from('documentos_legajo')
      .select('id, estado, fecha_venc, archivo_url, observaciones, documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)')
      .eq('proveedor_id', provVerif.proveedor_id),
    supabase
      .from('habilitaciones')
      .select('id, qr_token, estado, fecha_venc')
      .eq('proveedor_id', provVerif.proveedor_id)
      .eq('estado', 'VIGENTE')
      .maybeSingle(),
    provVerif.rol === 'titular' ? supabase
      .from('proveedores_usuarios')
      .select('id, rol, nombre, cuil, activo, user_id')
      .eq('proveedor_id', provVerif.proveedor_id) : Promise.resolve({ data: [] }),
    supabase
      .from('visitas_auditoria')
      .select(`
        id, visitado_at, resultado, estado_supervision,
        observacion, supervision_obs, lat, lng,
        auditor:auditor_id ( nombre ),
        establecimiento:establecimiento_id ( nombre ),
        checklist:visitas_checklist (
          cumple, observacion,
          item:checklist_id ( nombre )
        )
      `)
      .eq('proveedor_id', provVerif.proveedor_id)
      .order('visitado_at', { ascending: false }),
  ])

  if (!proveedor) redirect('/proveedor/login')

  // Historial de documentos
  const docIds = (docs ?? []).map((d: any) => d.id)
  const { data: historialRaw } = docIds.length > 0
    ? await supabase
        .from('documentos_legajo_historial')
        .select('id, documento_id, estado_anterior, estado_nuevo, actor_tipo, observaciones, created_at')
        .in('documento_id', docIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const historialPorDoc: Record<string, any[]> = {}
  for (const h of historialRaw ?? []) {
    if (!historialPorDoc[h.documento_id]) historialPorDoc[h.documento_id] = []
    historialPorDoc[h.documento_id].push(h)
  }

  // Accesos
  let accesos: any[] = []
  if (habilitacion) {
    const { data: accData } = await supabase
      .from('registros_acceso')
      .select('id, tipo, created_at, lat, lng')
      .eq('habilitacion_id', habilitacion.id)
      .order('created_at', { ascending: false })
      .limit(20)
    accesos = accData ?? []
  }

  return (
    <PortalClient
      proveedor={proveedor}
      docs={docs ?? []}
      habilitacion={habilitacion}
      operarios={operarios ?? []}
      accesos={accesos}
      historialPorDoc={historialPorDoc}
      miRol={provVerif.rol}
      visitasAuditoria={visitasAuditoria ?? []}
    />
  )
}
