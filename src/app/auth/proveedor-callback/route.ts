import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'recovery' para reset de contraseña

  if (!code) {
    return NextResponse.redirect(`${origin}/proveedor/login?error=link_invalido`)
  }

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/proveedor/login?error=link_expirado`)
  }

  // Si es reset de contraseña → ir a cambiar password
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/proveedor/cambiar-password`)
  }

  // Si es registro nuevo → completar el legajo y ir al portal
  await supabase.rpc('completar_registro_proveedor', {
    p_user_id: data.session.user.id
  })

  return NextResponse.redirect(`${origin}/proveedor/portal`)
}
