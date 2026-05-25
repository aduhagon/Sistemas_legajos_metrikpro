// ============================================================
// /app/superadmin/layout.tsx
// Layout compartido para todas las rutas /superadmin
// IMPORTANTE: este layout se ejecuta TAMBIÉN para /superadmin/login.
// Para evitar loops, NO hace ninguna verificación de sesión acá.
// La verificación se hace en el middleware (para rutas != login)
// y en cada page.tsx individual.
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import SuperadminNav from './SuperadminNav'

export const metadata = {
  title: 'SuperAdmin — MétrikPro',
}

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Intentamos leer el superadmin pero NO redirigimos si falta.
  // Si no hay sesión (estamos en /superadmin/login), el layout
  // renderiza el shell sin nombre — pero la página de login tiene
  // su PROPIO layout que reemplaza este, así que en la práctica
  // este shell solo se ve para rutas internas autenticadas.
  let superadminNombre = ''
  let superadminRol = ''

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const checkUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&activo=eq.true&select=nombre,rol&limit=1`
      const checkRes = await fetch(checkUrl, {
        headers: {
          apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        cache: 'no-store',
      })
      const arr = await checkRes.json()
      if (Array.isArray(arr) && arr.length > 0) {
        superadminNombre = arr[0].nombre || ''
        superadminRol    = arr[0].rol || ''
      }
    }
  } catch {
    // si falla, simplemente renderizamos sin el nombre
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">SuperAdmin</p>
              <p className="text-[10px] text-gray-500 mt-0.5">MétrikPro</p>
            </div>
          </div>
        </div>

        {/* Nav links — Client Component para manejar active state */}
        <SuperadminNav />

        {/* Footer con usuario */}
        <div className="mt-auto px-4 py-3 border-t border-gray-800">
          <p className="text-xs font-medium text-gray-300 truncate">{superadminNombre}</p>
          <p className="text-[10px] text-gray-600 capitalize">{superadminRol}</p>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
