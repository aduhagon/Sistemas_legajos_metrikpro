import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ReportesClient from './ReportesClient'

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hoy = new Date()
  const en30dias = new Date(hoy)
  en30dias.setDate(hoy.getDate() + 30)

  // Stats generales
  const [
    { count: total },
    { count: pendientes },
    { count: enRevision },
    { count: aprobados },
    { count: rechazados },
    { count: suspendidos },
  ] = await Promise.all([
    supabase.from('proveedores').select('*', { count: 'exact', head: true }),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'PENDIENTE'),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'EN_REVISION'),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'APROBADO'),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'RECHAZADO'),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'SUSPENDIDO'),
  ])

  // Documentos por vencer en 30 días
  const { data: vencimientos } = await supabase
    .from('documentos_legajo')
    .select(`
      id, fecha_venc, estado,
      documentos_requeridos(codigo, nombre, tipo_vigencia),
      proveedores(id, razon_social, cuit, email, rubros(nombre))
    `)
    .not('fecha_venc', 'is', null)
    .lte('fecha_venc', en30dias.toISOString().split('T')[0])
    .gte('fecha_venc', hoy.toISOString().split('T')[0])
    .in('estado', ['CARGADO', 'APROBADO'])
    .order('fecha_venc')

  // Documentos vencidos
  const { data: vencidos } = await supabase
    .from('documentos_legajo')
    .select(`
      id, fecha_venc, estado,
      documentos_requeridos(codigo, nombre),
      proveedores(id, razon_social, cuit, rubros(nombre))
    `)
    .lt('fecha_venc', hoy.toISOString().split('T')[0])
    .eq('estado', 'VENCIDO')
    .order('fecha_venc', { ascending: false })
    .limit(50)

  // Proveedores por rubro
  const { data: porRubro } = await supabase
    .from('proveedores')
    .select('rubros(nombre), estado')

  // Actividad reciente — últimos 20 cambios
  const { data: actividad } = await supabase
    .from('audit_log')
    .select('id, accion, entidad, datos_json, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  // Todos los proveedores para exportar
  const { data: todosProveedores } = await supabase
    .from('proveedores')
    .select(`
      id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at, notif_vencimientos,
      rubros(nombre),
      documentos_legajo(id, estado, fecha_venc, documentos_requeridos(nombre))
    `)
    .order('razon_social')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Reportes</h1>
        <p className="text-zinc-500 text-sm">Métricas, vencimientos y exportación de datos</p>
      </div>
      <ReportesClient
        stats={{ total: total ?? 0, pendientes: pendientes ?? 0, enRevision: enRevision ?? 0, aprobados: aprobados ?? 0, rechazados: rechazados ?? 0, suspendidos: suspendidos ?? 0 }}
        vencimientos={vencimientos ?? []}
        vencidos={vencidos ?? []}
        porRubro={porRubro ?? []}
        actividad={actividad ?? []}
        todosProveedores={todosProveedores ?? []}
      />
    </div>
  )
}
