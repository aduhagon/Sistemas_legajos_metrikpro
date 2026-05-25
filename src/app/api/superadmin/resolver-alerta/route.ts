// ============================================================
// /app/api/superadmin/resolver-alerta/route.ts
// Marca una alerta como resuelta + registra en audit log
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  // 1. Validar sesión
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

  // 2. Verificar superadmin
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
  if (!body || typeof body.alerta_id !== 'string') {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }
  const accion = body.accion === 'reabrir' ? 'reabrir' : 'resolver'
  const nuevoEstado = accion === 'resolver'

  // 4. Leer la alerta para guardar contexto en el audit log
  const alertaRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_alertas?id=eq.${body.alerta_id}&select=grupo_id,tipo,severidad&limit=1`,
    {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    }
  )
  const alertaArr = await alertaRes.json()
  if (!Array.isArray(alertaArr) || alertaArr.length === 0) {
    return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  }
  const alerta = alertaArr[0]

  // 5. Actualizar estado
  const updateRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_alertas?id=eq.${body.alerta_id}`,
    {
      method: 'PATCH',
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resuelta: nuevoEstado }),
    }
  )

  if (!updateRes.ok) {
    const errText = await updateRes.text()
    return NextResponse.json({ error: 'Error al actualizar: ' + errText }, { status: 500 })
  }

  // 6. Log en audit
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/superadmin_audit_log`, {
    method: 'POST',
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      superadmin_id: superadminId,
      accion:        accion === 'resolver' ? 'alerta_resuelta' : 'alerta_reabierta',
      grupo_id:      alerta.grupo_id,
      datos_json: {
        alerta_id: body.alerta_id,
        tipo:      alerta.tipo,
        severidad: alerta.severidad,
      },
    }),
  })

  return NextResponse.json({ ok: true })
}
