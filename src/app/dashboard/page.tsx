import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol')
    .eq('id', user.id)
    .single()

  const nombre = usuario?.nombre ?? user.email ?? 'Usuario'
  const rol = usuario?.rol ?? 'admin'

  const { count: totalProveedores } = await supabase
    .from('proveedores')
    .select('*', { count: 'exact', head: true })

  const { count: pendientes } = await supabase
    .from('proveedores')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'PENDIENTE')

  const { count: aprobados } = await supabase
    .from('proveedores')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'APROBADO')

  // Documentos por vencer en 7 días
  const hoy = new Date()
  const en7dias = new Date(hoy)
  en7dias.setDate(hoy.getDate() + 7)

  const { data: porVencer } = await supabase
    .from('documentos_legajo')
    .select(`
      id, fecha_venc,
      documentos_requeridos(nombre),
      proveedores(razon_social, cuit)
    `)
    .not('fecha_venc', 'is', null)
    .lte('fecha_venc', en7dias.toISOString().split('T')[0])
    .gte('fecha_venc', hoy.toISOString().split('T')[0])
    .eq('estado', 'APROBADO')
    .order('fecha_venc')
    .limit(5)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="font-semibold tracking-tight">Sistema Legajos</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">{nombre}</span>
            <span className="bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-2.5 py-1 rounded-full capitalize">
              {rol.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Alerta de vencimientos */}
        {porVencer && porVencer.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                <polygon points="12 2 22 21 2 21"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-yellow-400 text-sm font-medium">
                {porVencer.length} documento{porVencer.length > 1 ? 's' : ''} por vencer en los próximos 7 días
              </span>
            </div>
            <div className="space-y-2">
              {porVencer.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">
                    <span className="text-zinc-300">{doc.proveedores?.razon_social}</span>
                    {' — '}{doc.documentos_requeridos?.nombre}
                  </span>
                  <span className="text-yellow-500">
                    {new Date(doc.fecha_venc).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            <p className="text-zinc-500 text-xs mb-1">Total proveedores</p>
            <p className="text-3xl font-medium">{totalProveedores ?? 0}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            <p className="text-zinc-500 text-xs mb-1">Pendientes de revisión</p>
            <p className="text-3xl font-medium text-yellow-400">{pendientes ?? 0}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            <p className="text-zinc-500 text-xs mb-1">Aprobados</p>
            <p className="text-3xl font-medium text-green-400">{aprobados ?? 0}</p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-3 gap-4 mb-8">
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
          </Link>

          <Link href="/dashboard/configuracion"
            className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-5 transition-all group">
            <div className="w-8 h-8 bg-zinc-500/10 border border-zinc-500/20 rounded-lg flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <p className="font-medium text-sm group-hover:text-zinc-300 transition-colors mb-1">Configuración</p>
            <p className="text-zinc-500 text-xs">Email y ajustes del sistema</p>
          </Link>

          <Link href="/registro"
            className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-5 transition-all group">
            <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </div>
            <p className="font-medium text-sm group-hover:text-green-300 transition-colors mb-1">Portal registro</p>
            <p className="text-zinc-500 text-xs">Ver portal público</p>
          </Link>
        </div>

        {/* Estado sprint */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
          <p className="text-zinc-500 text-xs font-medium mb-4 uppercase tracking-wide">Estado del proyecto</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Infraestructura',     desc: 'Supabase + Next.js + Vercel', done: true },
              { label: 'M1 Autoregistro',     desc: 'Portal público proveedores',  done: true },
              { label: 'M2 Panel evaluador',  desc: 'Lista + detalle + acciones',  done: true },
              { label: 'M3 Notificaciones',   desc: 'Email configurable',          done: true },
              { label: 'M4 Documentos',       desc: 'Carga PDF a Storage',         done: true },
              { label: 'M5 Carnet QR',        desc: 'QR dinámico + validación',    done: true },
              { label: 'M6 QR automático',    desc: 'Alta al aprobar',             done: true },
              { label: 'M7 Evaluación IA',    desc: 'Claude API — próximo',        done: false },
              { label: 'M8 Alertas venc.',    desc: 'Cron job 7 días antes',       done: false },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.done ? 'bg-green-400' : 'bg-zinc-600'}`}/>
                <div>
                  <p className="text-xs text-white">{item.label}</p>
                  <p className="text-xs text-zinc-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}