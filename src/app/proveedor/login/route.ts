import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  // Verificar que es un usuario proveedor
  const { data: miProv } = await supabase.rpc('get_mi_proveedor')
  if (!miProv) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Esta cuenta no está asociada a ningún proveedor' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
