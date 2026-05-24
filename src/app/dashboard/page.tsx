import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count: totalProveedores } = await supabase
    .from('proveedores').select('*', { count: 'exact', head: true })

  const { count: pendientes } = await supabase
    .from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'PENDIENTE')

  const { count: aprobados } = await supabase
    .from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'APROBADO')

  const { count: enRevision } = await supabase
    .from('proveedores').select('*', { count: 'exact', head: true }).eq('estado', 'EN_REVISION')

  const hoy = new Date()
  const en7dias = new Date(hoy)
  en7dias.setDate(hoy.getDate() + 7)
  const hoyStr = hoy.toISOString().split('T')[0]
  const en7diasStr = en7dias.toISOString().split('T')[0]

  // Docs del legajo por vencer
  const { data: porVencer } = await supabase
    .from('documentos_legajo')
    .select('id, fecha_venc, documentos_requeridos(nombre), proveedores(id, razon_social)')
    .not('fecha_venc', 'is', null)
    .lte('fecha_venc', en7diasStr)
    .gte('fecha_venc', hoyStr)
    .in('estado', ['CARGADO', 'APROBADO'])
    .order('fecha_venc')
    .limit(5)

  // Docs de EQUIPOS por vencer en 7 días — con link al legajo del proveedor
  const { data: equiposPorVencer } = await supabase
    .from('documentos_equipo')
    .select(`
      id, fecha_venc,
      documentos_requeridos_equipo(nombre),
      equipos_contratista(dominio, tipos_equipo(icono), proveedores(id, razon_social))
    `)
    .not('fecha_venc', 'is', null)
    .lte('fecha_venc', en7diasStr)
    .gte('fecha_venc', hoyStr)
    .in('estado', ['CARGADO', 'APROBADO'])
    .order('fecha_venc')
    .limit(5)

  // Docs de equipos VENCIDOS — con datos del proveedor para linkear al legajo
  const { data: equiposVencidosData } = await supabase
    .from('documentos_equipo')
    .select(`
      id,
      equipos_contratista(proveedores(id, razon_social))
    `)
    .eq('estado', 'VENCIDO')
    .limit(5)

  const equiposVencidos = equiposVencidosData?.length ?? 0

  // FIX UX-H-01: variables booleanas explícitas para evitar render de "0"
  const hayEquiposVencidos  = equiposVencidos > 0
  const hayEquiposPorVencer = (equiposPorVencer?.length ?? 0) > 0

  // Para el link al primer legajo con equipo vencido (caso más frecuente: 1 solo proveedor)
  const primerProveedorConEquipoVencido = (equiposVencidosData?.[0] as any)
    ?.equipos_contratista?.proveedores?.id ?? null

  return (
    <div>

      {/* Alerta vencimientos — legajo */}
      {porVencer && porVencer.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="flex-1">
            <p className="text-yellow-400 text-sm font-medium mb-1">
              {porVencer.length} documento{porVencer.length > 1 ? 's' : ''} de legajo por vencer en los próximos 7 días
            </p>
            <div className="space-y-0.5">
              {porVencer.map((doc: any) => (
                <p key={doc.id} className="text-zinc-500 text-xs">
                  {/* UX-P-03: link directo al legajo del proveedor */}
                  <Link
                    href={`/dashboard/legajos/${doc.proveedores?.id}`}
                    className="text-zinc-400 hover:text-white transition-colors">
                    {doc.proveedores?.razon_social}
                  </Link>
                  {' — '}{doc.documentos_requeridos?.nombre}
                  <span className="text-yellow-600 ml-1">
                    ({new Date(doc.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})
                  </span>
                </p>
              ))}
            </div>
            {/* Link directo a la sección vencimientos en Reportes */}
            <Link
              href="/dashboard/reportes?tab=vencimientos"
              className="inline-block mt-2 text-yellow-600 hover:text-yellow-400 text-xs transition-colors">
              Ver todos los vencimientos →
            </Link>
          </div>
        </div>
      )}

      {/* Alerta vencimientos — equipos */}
      {(hayEquiposPorVencer || hayEquiposVencidos) && (
        <div className={`border rounded-2xl p-4 mb-4 flex items-start gap-3 ${
          hayEquiposVencidos
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-orange-500/5 border-orange-500/20'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={hayEquiposVencidos ? '#ef4444' : '#f97316'}
            strokeWidth="2" className="shrink-0 mt-0.5">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <path d="M16 8h4l3 3v4h-7z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          <div className="flex-1">
            {hayEquiposVencidos && (
              <p className="text-red-400 text-sm font-medium mb-1">
                🔴 {equiposVencidos} documento{equiposVencidos > 1 ? 's' : ''} de equipos vencido{equiposVencidos > 1 ? 's' : ''}
                {' — '}
                {/* UX-P-03: si hay un solo proveedor afectado, link directo al legajo; si hay varios, a reportes */}
                {primerProveedorConEquipoVencido && equiposVencidos === 1 ? (
                  <Link
                    href={`/dashboard/legajos/${primerProveedorConEquipoVencido}`}
                    className="text-red-300 hover:text-red-200 underline transition-colors">
                    Ver legajo →
                  </Link>
                ) : (
                  <Link
                    href="/dashboard/reportes?tab=vencimientos"
                    className="text-red-300 hover:text-red-200 underline transition-colors">
                    Ver en reportes →
                  </Link>
                )}
              </p>
            )}
            {hayEquiposPorVencer && (
              <>
                <p className={`text-sm font-medium mb-1 ${hayEquiposVencidos ? 'text-orange-400' : 'text-orange-300'}`}>
                  {equiposPorVencer!.length} documento{equiposPorVencer!.length > 1 ? 's' : ''} de equipos por vencer en 7 días
                </p>
                <div className="space-y-0.5">
                  {equiposPorVencer!.map((doc: any) => {
                    const equipo = doc.equipos_contratista
                    return (
                      <p key={doc.id} className="text-zinc-500 text-xs">
                        <span className="mr-1">{equipo?.tipos_equipo?.icono}</span>
                        {/* UX-P-03: link directo al legajo del proveedor del equipo */}
                        <Link
                          href={`/dashboard/legajos/${equipo?.proveedores?.id}`}
                          className="text-zinc-400 hover:text-white transition-colors">
                          {equipo?.proveedores?.razon_social}
                        </Link>
                        {' · '}<span className="font-mono text-zinc-500">{equipo?.dominio}</span>
                        {' — '}{doc.documentos_requeridos_equipo?.nombre}
                        <span className="text-orange-600 ml-1">
                          ({new Date(doc.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})
                        </span>
                      </p>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total',       value: totalProveedores ?? 0, color: 'white'  },
          { label: 'Pendientes',  value: pendientes ?? 0,       color: 'yellow' },
          { label: 'En revisión', value: enRevision ?? 0,       color: 'blue'   },
          { label: 'Aprobados',   value: aprobados ?? 0,        color: 'green'  },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-3xl font-medium ${
              s.color === 'yellow' ? 'text-yellow-400' :
              s.color === 'blue'   ? 'text-blue-400' :
              s.color === 'green'  ? 'text-green-400' : 'text-white'
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/legajos"
          className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-5 transition-all group">
          <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <p className="font-medium text-sm group-hover:text-blue-300 transition-colors mb-1">Legajos</p>
          <p className="text-zinc-500 text-xs">Revisá y aprobá proveedores</p>
          {(pendientes ?? 0) > 0 && (
            <span className="mt-2 inline-block bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs px-2 py-0.5 rounded-full">
              {pendientes} pendiente{(pendientes ?? 0) > 1 ? 's' : ''}
            </span>
          )}
        </Link>

        <Link href="/registro" target="_blank"
          className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-5 transition-all group">
          <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <p className="font-medium text-sm group-hover:text-green-300 transition-colors mb-1">Portal público</p>
          <p className="text-zinc-500 text-xs">Registro y documentación</p>
        </Link>

        <Link href="/dashboard/reportes"
          className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-5 transition-all group">
          <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <p className="font-medium text-sm group-hover:text-purple-300 transition-colors mb-1">Reportes</p>
          <p className="text-zinc-500 text-xs">Métricas y exportación</p>
          {hayEquiposVencidos && (
            <span className="mt-2 inline-block bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2 py-0.5 rounded-full">
              {equiposVencidos} equipo{equiposVencidos > 1 ? 's' : ''} vencido{equiposVencidos > 1 ? 's' : ''}
            </span>
          )}
        </Link>
      </div>
    </div>
  )
}
