import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PortalClient from './PortalClient'

// Server Component — corre en el servidor, lee cookies directamente
export default async function ProveedorPortalPage() {
  const supabase = createClient()

  // 1. Obtener usuario del servidor (lee cookie directamente)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/proveedor/login')

  // 2. Verificar que es proveedor (función SECURITY DEFINER)
  const { data: provVerif } = await supabase
    .rpc('verificar_proveedor_usuario', { p_user_id: user.id })

  if (!provVerif) {
    redirect('/proveedor/login')
  }

  // 3. Cargar todos los datos en el servidor
  const [
    { data: proveedor },
    { data: docs },
    { data: habilitacion },
    { data: operarios },
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
      .select('id, rol, nombre, activo, user_id')
      .eq('proveedor_id', provVerif.proveedor_id) : Promise.resolve({ data: [] }),
  ])

  if (!proveedor) redirect('/proveedor/login')

  // Cargar accesos si hay habilitación
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
      miRol={provVerif.rol}
    />
  )
}
