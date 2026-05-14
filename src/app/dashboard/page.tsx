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

  // Stats
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
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link href="/dashboard/legajos"
            className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-6 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <span className="font-medium group-hover:text-blue-300 transition-colors">Legajos de proveedores</span>
            </div>
            <p className="text-zinc-500 text-sm">Revisá, aprobá o rechazá los legajos pendientes</p>
          </Link>

          <Link href="/registro"
            className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-6 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <span className="font-medium group-hover:text-green-300 transition-colors">Portal de registro</span>
            </div>
            <p className="text-zinc-500 text-sm">Ver el portal público de autoregistro de proveedores</p>
          </Link>
        </div>

        {/* Estado sprint */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <p className="text-zinc-500 text-xs font-medium mb-4 uppercase tracking-wide">Estado del Sprint 1</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Infraestructura',   desc: 'Supabase + Next.js + Vercel', status: 'listo',       color: 'green'  },
              { label: 'Base de datos',     desc: '12 tablas + seed data',       status: 'listo',       color: 'green'  },
              { label: 'Autenticación',     desc: 'Login + roles + RLS',         status: 'listo',       color: 'green'  },
              { label: 'M1 Autoregistro',   desc: 'Portal público proveedores',  status: 'listo',       color: 'green'  },
              { label: 'M2 Panel evaluador',desc: 'Lista + detalle + acciones',  status: 'listo',       color: 'green'  },
              { label: 'M3 Evaluación IA',  desc: 'Claude API — Fase 2',         status: 'pendiente',   color: 'zinc'   },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.color === 'green' ? 'bg-green-400' : 'bg-zinc-600'
                }`}/>
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