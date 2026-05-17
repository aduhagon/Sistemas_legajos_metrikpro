'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

type Props = {
  nombre: string
  rol: string
}

export default function Navbar({ nombre, rol }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard',                label: 'Inicio',        roles: ['admin', 'evaluador', 'operador_acceso'] },
    { href: '/dashboard/legajos',        label: 'Legajos',       roles: ['admin', 'evaluador'] },
    { href: '/dashboard/configuracion',  label: 'Configuración', roles: ['admin'] },
    { href: '/dashboard/admin/rubros',          label: 'Rubros y docs',    roles: ['admin'] },
    { href: '/dashboard/admin/establecimientos', label: 'Establecimientos', roles: ['admin'] },
    { href: '/dashboard/admin/tipos',           label: 'Tipos estab.',     roles: ['admin'] },
    { href: '/dashboard/reportes',       label: 'Reportes',       roles: ['admin', 'evaluador'] },
  ]

  const linksVisibles = links.filter(l => l.roles.includes(rol))

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-medium text-sm tracking-tight">Sistema Legajos</span>
          </Link>

          {/* Links de navegación */}
          <div className="hidden md:flex items-center gap-1">
            {linksVisibles.map(link => {
              const activo = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    activo
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                  }`}>
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Usuario + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-zinc-400 text-sm">{nombre}</span>
            <span className="bg-white/[0.06] border border-white/[0.08] text-zinc-400 text-xs px-2 py-0.5 rounded-full capitalize">
              {rol.replace('_', ' ')}
            </span>
          </div>
          <button onClick={handleLogout}
            className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>

      </div>
    </nav>
  )
}
