// src/app/api/superadmin/resolver-alerta/route.ts
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
    if (!body || typeof body.alerta_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Parámetros inválidos: se requiere alerta_id' }, { status: 400 })
    }

    const accion = body.accion === 'reabrir' ? 'reabrir' : 'resolver'
    const nuevoEstado = accion === 'resolver'

    // Leer alerta para el audit log
    const alertaRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_alertas?id=eq.${body.alerta_id}&select=grupo_id,tipo,severidad&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } }
    )
    const alertaArr = await alertaRes.json()
    if (!Array.isArray(alertaArr) || alertaArr.length === 0) {
      return NextResponse.json({ ok: false, error: 'Alerta no encontrada' }, { status: 404 })
    }
    const alerta = alertaArr[0]

    // Actualizar estado
    const updateRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_alertas?id=eq.${body.alerta_id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resuelta: nuevoEstado }),
      }
    )

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      console.error('[resolver-alerta] PATCH error:', errText)
      return NextResponse.json({ ok: false, error: 'Error al actualizar la alerta' }, { status: 500 })
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
        accion:        accion === 'resolver' ? 'alerta_resuelta' : 'alerta_reabierta',
        grupo_id:      alerta.grupo_id,
        datos_json:    { alerta_id: body.alerta_id, tipo: alerta.tipo, severidad: alerta.severidad },
      }),
    })

    return NextResponse.json({ ok: true })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[resolver-alerta] Unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
