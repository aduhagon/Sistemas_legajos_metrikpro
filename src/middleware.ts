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

  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Para el portal del proveedor — si no hay sesión en cookies, 
  // dejar pasar igual y que el portal maneje la redirección al login
  // Esto evita el loop cuando el cliente tiene sesión en localStorage pero no en cookies
  if (path.startsWith('/proveedor/portal') && !user) {
    // Redirigir al login solo si viene sin ningún token
    const hasToken = request.cookies.getAll().some(c => c.name.includes('auth-token') || c.name.includes('sb-'))
    if (!hasToken) {
      return NextResponse.redirect(new URL('/proveedor/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
