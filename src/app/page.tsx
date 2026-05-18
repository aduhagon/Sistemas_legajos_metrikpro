import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-2xl tracking-tight">Sistema Legajos</span>
          </div>
          <p className="text-zinc-500 text-sm">Gestión de proveedores y control de acceso</p>
        </div>

        {/* Opciones */}
        <div className="grid grid-cols-1 gap-4">

          {/* Proveedor */}
          <Link href="/proveedor/login"
            className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-blue-500/30 rounded-2xl p-6 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
                  <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-white font-medium text-lg">Soy proveedor</h2>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2"
                    className="group-hover:stroke-blue-400 group-hover:translate-x-0.5 transition-all">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
                <p className="text-zinc-500 text-sm">Accedé a tu legajo, cargá documentación y mostrá tu carnet QR de acceso</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Documentos</span>
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Carnet QR</span>
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Historial de accesos</span>
            </div>
          </Link>

          {/* Colaborador interno */}
          <Link href="/login"
            className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-purple-500/30 rounded-2xl p-6 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-white font-medium text-lg">Soy colaborador</h2>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2"
                    className="group-hover:stroke-purple-400 group-hover:translate-x-0.5 transition-all">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
                <p className="text-zinc-500 text-sm">Evaluadores, operadores y administradores del sistema</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Panel de gestión</span>
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Evaluación</span>
              <span className="text-xs text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full">Control de acceso</span>
            </div>
          </Link>

        </div>

        {/* Registro */}
        <p className="text-center text-zinc-600 text-xs mt-8">
          ¿Primera vez?{' '}
          <Link href="/proveedor/registro" className="text-blue-400 hover:text-blue-300 transition-colors">
            Registrá tu empresa como proveedor
          </Link>
        </p>

      </div>
    </div>
  )
}
