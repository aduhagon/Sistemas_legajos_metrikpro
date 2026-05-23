import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// SEC-005: Rate limiting in-memory por IP
// Rutas protegidas (solo POST):
//   /api/registro*   → 10 req / 60s
//   /api/validar-qr* → 30 req / 60s
// Nota: in-memory por instancia. Para multi-instancia distribuida
// migrar a Vercel KV o Upstash Redis.
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

  // --- SEC-005: Rate limiting (antes del check de sesión) ---
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
              'Retry-After':          String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit':    String(rule.limit),
              'X-RateLimit-Remaining':'0',
              'X-RateLimit-Reset':    String(Math.ceil(resetAt / 1000)),
            },
          }
        )
      }
    }
  }

  // --- Supabase auth (lógica original) ---
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

  // App auditor — requiere usuario interno
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
