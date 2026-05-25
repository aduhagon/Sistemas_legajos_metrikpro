// src/app/api/superadmin/toggle-modulo/route.ts
// CF-004: respuestas consistentes { ok, error } en todas las routes
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    // Verificar superadmin
    const checkRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&rol=eq.superadmin&activo=eq.true&select=id&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } }
    )
    const saArr = await checkRes.json()
    if (!Array.isArray(saArr) || saArr.length === 0) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
    }
    const superadminId = saArr[0].id

    const body = await req.json().catch(() => null)
    if (!body || typeof body.grupo_id !== 'string' || typeof body.modulo !== 'string' || typeof body.activo !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'Parámetros inválidos: se requieren grupo_id, modulo y activo' }, { status: 400 })
    }
    const { grupo_id, modulo, activo } = body

    const upsertRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/grupos_modulos?grupo_id=eq.${grupo_id}&modulo=eq.${encodeURIComponent(modulo)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ activo, updated_at: new Date().toISOString(), updated_by: user.id }),
      }
    )

    if (!upsertRes.ok) {
      const errText = await upsertRes.text()
      console.error('[toggle-modulo] PATCH error:', errText)
      return NextResponse.json({ ok: false, error: 'Error al actualizar el módulo' }, { status: 500 })
    }

    // Log en audit
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_audit_log`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[toggle-modulo] Unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
