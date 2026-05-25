// src/app/superadmin/layout.tsx

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import SuperadminNav from './SuperadminNav'

export const metadata = {
  title: 'SuperAdmin — MétrikPro',
}

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Si es la ruta de login, renderizar sin sidebar ni verificación
  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || headersList.get('x-pathname') || ''
  
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  // Detectar si es la página de login por las cookies (no hay sesión aún)
  // o directamente saltear la verificación y dejar que el middleware maneje la seguridad
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return allCookies },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → solo renderizar children (el middleware ya redirigió si no era /login)
  if (!user) {
    return <>{children}</>
  }

  // Con sesión → verificar que sea superadmin
  const checkUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&rol=eq.superadmin&activo=eq.true&select=id,nombre,rol&limit=1`
  const checkRes = await fetch(checkUrl, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    cache: 'no-store',
  })
  const data = await checkRes.json()

  if (!Array.isArray(data) || data.length === 0) {
    redirect('/superadmin/login')
  }

  const superadmin = data[0]

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-56 flex-shrink-0 border-r border-gray-800 flex flex-col">
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

        <SuperadminNav />

        <div className="mt-auto px-4 py-3 border-t border-gray-800">
          <p className="text-xs font-medium text-gray-300 truncate">{superadmin.nombre}</p>
          <p className="text-[10px] text-gray-600 capitalize">{superadmin.rol}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
