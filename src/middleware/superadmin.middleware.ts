// ============================================================
// middleware.ts — agregar este bloque al middleware existente
// Protege /superadmin con sesión independiente del tenant
//
// INSTRUCCIÓN DE INTEGRACIÓN:
// En el middleware actual del proyecto, agregar el bloque
// superadmin ANTES del bloque de /dashboard.
// El matcher ya debe incluir '/superadmin/:path*'
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware específico para rutas /superadmin.
 * Verifica que el usuario autenticado tenga rol superadmin
 * en la tabla usuarios_metrikpro (no en usuarios del tenant).
 *
 * Flujo:
 * 1. Si no hay sesión → redirigir a /superadmin/login
 * 2. Si hay sesión pero no es superadmin → redirigir a /superadmin/login
 * 3. Si es superadmin → dejar pasar
 */
export async function middlewareSuperadmin(request: NextRequest) {
  const { pathname } = request.nextUrl

  // La ruta de login siempre es pública
  if (pathname === '/superadmin/login') {
    return NextResponse.next()
  }

  // Verificar sesión de Supabase Auth
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/superadmin/login', request.url))
  }

  // Verificar rol superadmin con service_role (bypass RLS)
  // Usamos fetch directo para evitar importar supabase-admin en middleware
  const checkUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&rol=eq.superadmin&activo=eq.true&select=id&limit=1`
  const checkRes = await fetch(checkUrl, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })

  const data = await checkRes.json()
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.redirect(new URL('/superadmin/login', request.url))
  }

  return response
}

// ============================================================
// Exportación del matcher — agregar al matcher existente
// ============================================================
// En el middleware.ts existente, en la config de matcher, agregar:
// '/superadmin/:path*'
//
// Ejemplo de config completa:
// export const config = {
//   matcher: [
//     '/dashboard/:path*',
//     '/superadmin/:path*',   // ← agregar esto
//     '/proveedor/portal/:path*',
//     '/auditor/:path*',
//   ]
// }
