// ============================================================
// /app/api/superadmin/logout/route.ts
// Cierra la sesión del superadmin y redirige al login
// ============================================================

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/superadmin/login', req.url), { status: 303 })
}

export async function GET(req: Request) {
  return POST(req)
}
