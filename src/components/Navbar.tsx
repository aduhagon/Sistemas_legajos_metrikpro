'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type Props = {
  nombre: string
  rol: string
}

export default function Navbar({ nombre, rol }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [adminOpen, setAdminOpen] = useState(false)
  const adminRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard',           label: 'Inicio',   roles: ['admin', 'evaluador', 'operador_acceso'] },
    { href: '/dashboard/legajos',   label: 'Legajos',  roles: ['admin', 'evaluador', 'operario'] },
    { href: '/dashboard/reportes',  label: 'Reportes', roles: ['admin', 'evaluador'] },
  ]

  const adminLinks = [
    { href: '/dashboard/configuracion',          label: 'Configuración',        icono: '⚙️' },
    { href: '/dashboard/admin/rubros',           label: 'Rubros y documentos',  icono: '📄' },
    { href: '/dashboard/admin/tipos',            label: 'Tipos de establecimiento', icono: '🏢' },
    { href: '/dashboard/admin/establecimientos', label: 'Establecimientos',     icono: '📍' },
    { href: '/dashboard/admin/equipos',          label: 'Tipos de equipo',      icono: '🚗' },
    { href: '/dashboard/admin/usuarios',         label: 'Usuarios internos',    icono: '👥' },
  ]

  const esAdmin = rol === 'admin'
  const adminActivo = adminLinks.some(l => pathname.startsWith(l.href))

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo + links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-medium text-sm tracking-tight">Sistema Legajos</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.filter(l => l.roles.includes(rol)).map(link => {
              const activo = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    activo ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                  }`}>
                  {link.label}
                </Link>
              )
            })}

            {/* Dropdown Admin */}
            {esAdmin && (
              <div ref={adminRef} className="relative">
                <button onClick={() => setAdminOpen(!adminOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    adminActivo || adminOpen ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                  }`}>
                  Admin
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${adminOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {adminOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-[#0f1117] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden z-50">
                    {adminLinks.map(link => {
                      const activo = pathname.startsWith(link.href)
                      return (
                        <Link key={link.href} href={link.href}
                          onClick={() => setAdminOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                            activo ? 'bg-white/[0.06] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                          }`}>
                          <span className="text-base">{link.icono}</span>
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
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
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
