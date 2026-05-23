import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Rutas públicas — no requieren sesión
  const rutasPublicas = [
    '/login',
    '/registro',
    '/auth',
    '/proveedor/login',
    '/proveedor/registro',
    '/proveedor/cambiar-password',
    '/qr',
    '/entrada',
  ]

  const esPublica = rutasPublicas.some(r => path.startsWith(r))

  // Dashboard — requiere usuario interno
  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // App auditor — requiere usuario interno con rol auditor, admin o evaluador
  if (path.startsWith('/auditor')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    // La verificación de rol se hace en el Server Component
  }

  // Rutas privadas sin sesión
  if (!esPublica && !user && !path.startsWith('/dashboard') && !path.startsWith('/auditor')) {
    if (path.startsWith('/proveedor/portal')) {
      return NextResponse.redirect(new URL('/proveedor/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
