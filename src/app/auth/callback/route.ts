// src/app/auth/callback/route.ts
// Maneja el callback de Supabase Auth para:
//   - recovery (reset de contraseña)
//   - email confirmation
//   - magic link

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const type  = searchParams.get('type')   // 'recovery' | 'signup' | etc
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Según el tipo, redirigir a la pantalla correcta
      if (type === 'recovery') {
        // Reset de contraseña — ir a la página de cambio de clave
        return NextResponse.redirect(`${origin}/cambiar-password`)
      }
      // Confirmación de email u otro tipo — ir al destino o login
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error o token inválido — redirigir al login con mensaje
  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
