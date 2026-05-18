import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const rutasPublicas = [
    '/login',
    '/registro',
    '/qr',
    '/acceso',
    '/entrada',
    '/auth',
    '/proveedor/login',
    '/proveedor/registro',
    '/proveedor/cambiar-password',
    '/cambiar-password',
  ]

  const esPublica = rutasPublicas.some(r => path.startsWith(r))

  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (path.startsWith('/proveedor/portal') && !user) {
    return NextResponse.redirect(new URL('/proveedor/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
