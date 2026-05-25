// ============================================================
// /app/api/superadmin/toggle-modulo/route.ts
// API endpoint para que el dashboard superadmin active/desactive
// módulos por tenant. Valida sesión superadmin antes de aplicar.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  // 1. Validar sesión superadmin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Verificar que es superadmin (con service role)
  const checkUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&rol=eq.superadmin&activo=eq.true&select=id&limit=1`
  const checkRes = await fetch(checkUrl, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })
  const saArr = await checkRes.json()
  if (!Array.isArray(saArr) || saArr.length === 0) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const superadminId = saArr[0].id

  // 3. Validar body
  const body = await req.json().catch(() => null)
  if (!body || typeof body.grupo_id !== 'string' || typeof body.modulo !== 'string' || typeof body.activo !== 'boolean') {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }
  const { grupo_id, modulo, activo } = body

  // 4. Aplicar cambio (UPSERT) via service role
  const upsertRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/grupos_modulos?grupo_id=eq.${grupo_id}&modulo=eq.${encodeURIComponent(modulo)}`,
    {
      method: 'PATCH',
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer:        'return=representation',
      },
      body: JSON.stringify({
        activo,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }),
    }
  )

  if (!upsertRes.ok) {
    const errText = await upsertRes.text()
    return NextResponse.json({ error: 'Error al actualizar: ' + errText }, { status: 500 })
  }

  // 5. Log en superadmin_audit_log
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_audit_log`, {
    method: 'POST',
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      superadmin_id: superadminId,
      accion:        activo ? 'modulo_activado' : 'modulo_desactivado',
      grupo_id,
      datos_json:    { modulo, nuevo_estado: activo },
    }),
  })

  return NextResponse.json({ ok: true })
}
