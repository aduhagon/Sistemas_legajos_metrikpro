import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// SEC-005: Rate limiting in-memory por IP
// ============================================================
interface RateLimitEntry { count: number; resetAt: number }
const rlStore = new Map<string, RateLimitEntry>()

const RL_RULES: { pattern: RegExp; limit: number; windowMs: number }[] = [
  { pattern: /^\/api\/validar-qr/, limit: 30, windowMs: 60_000 },
  { pattern: /^\/api\/registro/,   limit: 10, windowMs: 60_000 },
]

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(
  key: string, limit: number, windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rlStore.get(key)
  if (!entry || now > entry.resetAt) {
    rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ============================================================
// Middleware principal
// ============================================================
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ============================================================
  // SUPERADMIN — verificar PRIMERO de todo
  // El login es PÚBLICO y NO debe pasar por ninguna otra verificación
  // ============================================================
  if (path.startsWith('/superadmin/login')) {
    return NextResponse.next()
  }

  if (path.startsWith('/superadmin')) {
    let saResponse = NextResponse.next({ request: { headers: request.headers } })

    const saSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            saResponse = NextResponse.next({ request: { headers: request.headers } })
            saResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            saResponse = NextResponse.next({ request: { headers: request.headers } })
            saResponse.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user: saUser } } = await saSupabase.auth.getUser()

    if (!saUser) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url))
    }

    const checkUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${saUser.id}&rol=eq.superadmin&activo=eq.true&select=id&limit=1`
    const checkRes = await fetch(checkUrl, {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    })
    const saData = await checkRes.json()

    if (!Array.isArray(saData) || saData.length === 0) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url))
    }

    return saResponse
  }

  // --- SEC-005: Rate limiting ---
  if (request.method === 'POST') {
    const rule = RL_RULES.find(r => r.pattern.test(path))
    if (rule) {
      const ip = getIP(request)
      const key = `rl:${path.split('/')[2]}:${ip}`
      const { allowed, remaining, resetAt } = checkRateLimit(key, rule.limit, rule.windowMs)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' },
          {
            status: 429,
            headers: {
              'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit':     String(rule.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
            },
          }
        )
      }
    }
  }

  // --- Supabase auth (resto del sistema) ---
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

  const rutasPublicas = [
    '/',
    '/login',
    '/registro',
    '/auth',
    '/cambiar-password',
    '/proveedor/login',
    '/proveedor/registro',
    '/proveedor/cambiar-password',
    '/qr',
    '/qr-personal',
    '/entrada',
  ]
  const esPublica = rutasPublicas.some(r => path.startsWith(r))

  if (!user && !esPublica) {
    if (path.startsWith('/proveedor/portal')) {
      return NextResponse.redirect(new URL('/proveedor/login', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    const rol = usuarioData?.rol

    if (path === '/login') {
      if (rol === 'operador_acceso') return NextResponse.redirect(new URL('/acceso', request.url))
      if (rol === 'auditor')         return NextResponse.redirect(new URL('/auditor', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (rol === 'operador_acceso' && !path.startsWith('/acceso')) {
      return NextResponse.redirect(new URL('/acceso', request.url))
    }

    if (rol === 'auditor' && !path.startsWith('/auditor')) {
      return NextResponse.redirect(new URL('/auditor', request.url))
    }

    if (path.startsWith('/acceso') && rol && !['operador_acceso', 'admin'].includes(rol)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
