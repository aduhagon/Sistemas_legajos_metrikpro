import { redirect } from 'next/navigation'
import { getUsuarioSesion } from '@/lib/auth'

export default async function DashboardPage() {
  const usuario = await getUsuarioSesion()
  if (!usuario) redirect('/login')

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
            <span className="text-zinc-400 text-sm">{usuario.nombre}</span>
            <span className="bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-2.5 py-1 rounded-full capitalize">
              {usuario.rol.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Bienvenida */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 mb-6">
          <h1 className="text-2xl font-medium mb-2">¡Bienvenido, {usuario.nombre.split(' ')[0]}!</h1>
          <p className="text-zinc-400">
            El sistema está funcionando correctamente. Los módulos de gestión se irán habilitando a lo largo del Sprint 1.
          </p>
        </div>

        {/* Estado del sprint */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Infraestructura', desc: 'Supabase + Next.js + Vercel', status: 'listo', color: 'green' },
            { label: 'Base de datos', desc: '12 tablas + seed data', status: 'listo', color: 'green' },
            { label: 'Autenticación', desc: 'Login + roles + RLS', status: 'listo', color: 'green' },
            { label: 'M1 — Autoregistro', desc: 'Portal público proveedores', status: 'en progreso', color: 'yellow' },
            { label: 'M2 — Documentos', desc: 'Carga + vencimientos', status: 'pendiente', color: 'zinc' },
            { label: 'M3 — Evaluación', desc: 'Flujo aprobación humana', status: 'pendiente', color: 'zinc' },
          ].map(item => (
            <div key={item.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.color === 'green'  ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  item.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                  'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                }`}>
                  {item.status}
                </span>
              </div>
              <p className="text-zinc-500 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
