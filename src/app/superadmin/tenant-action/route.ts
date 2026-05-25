// ============================================================
// /app/api/superadmin/tenant-action/route.ts
// Endpoint único para acciones del SuperAdmin sobre un tenant:
//
//   - update_datos          → editar razón social, CUIT, contactos, etc.
//   - update_plan           → cambiar plan + activar/desactivar módulos
//   - cambiar_estado_cuenta → al_dia | pendiente_pago | suspendido
//   - toggle_activo         → suspender/reactivar (activo true/false)
//   - reset_password_admin  → genera password temporal para un admin
//   - invitar_admin         → crea nuevo usuario admin del tenant
//   - quitar_admin          → desactiva un admin (no borra)
//   - update_branding       → nombre_display, tagline, colores, logo_url
//   - update_smtp           → smtp_host, port, user, from, evaluador_email
//   - add_nota              → nota interna del superadmin
//
// Todas las acciones se loguean en superadmin_audit_log.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type Accion =
  | 'update_datos'
  | 'update_plan'
  | 'cambiar_estado_cuenta'
  | 'toggle_activo'
  | 'reset_password_admin'
  | 'invitar_admin'
  | 'quitar_admin'
  | 'update_branding'
  | 'update_smtp'
  | 'add_nota'

interface Body {
  accion:    Accion
  grupo_id:  string
  payload?:  Record<string, unknown>
}

function generarPasswordTemporal(): string {
  const letras  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  let pass = ''
  for (let i = 0; i < 4; i++) pass += letras[Math.floor(Math.random() * letras.length)]
  for (let i = 0; i < 4; i++) pass += numeros[Math.floor(Math.random() * numeros.length)]
  return pass
}

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getStr(payload: Record<string, unknown> | undefined, key: string): string | null {
  if (!payload) return null
  const v = payload[key]
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed === '' ? null : trimmed
}

export async function POST(req: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers = {
    apikey:        serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // Validar rol superadmin
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/usuarios_metrikpro?user_id=eq.${user.id}&rol=eq.superadmin&activo=eq.true&select=id&limit=1`,
    { headers }
  )
  const saArr = await checkRes.json()
  if (!Array.isArray(saArr) || saArr.length === 0) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const superadminId = saArr[0].id

  const body = await req.json().catch(() => null) as Body | null
  if (!body || !body.accion || !body.grupo_id) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { accion, grupo_id, payload } = body

  // Verificar que el tenant exista
  const tRes = await fetch(
    `${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${grupo_id}&select=id,nombre&limit=1`,
    { headers }
  )
  const tArr = await tRes.json()
  if (!Array.isArray(tArr) || tArr.length === 0) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
  }

  async function audit(datos: Record<string, unknown> = {}) {
    await fetch(`${supabaseUrl}/rest/v1/superadmin_audit_log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        superadmin_id: superadminId,
        accion,
        grupo_id,
        datos_json: datos,
      }),
    })
  }

  try {
    // ─────────────────────────────────────────────────────────
    // UPDATE_DATOS — campos de contacto/identidad
    // ─────────────────────────────────────────────────────────
    if (accion === 'update_datos') {
      const updateFields: Record<string, unknown> = {}
      const camposPermitidos = [
        'razon_social', 'cuit', 'direccion', 'telefono',
        'contacto_facturacion_nombre', 'contacto_facturacion_email',
        'contacto_tecnico_nombre', 'contacto_tecnico_email',
        'importe_mensual', 'moneda', 'plan_hasta',
      ]
      for (const f of camposPermitidos) {
        if (payload && f in payload) updateFields[f] = payload[f] ?? null
      }
      if (Object.keys(updateFields).length === 0) {
        return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
      }

      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify(updateFields) }
      )
      if (!upd.ok) throw new Error(await upd.text())

      await audit({ campos_actualizados: Object.keys(updateFields) })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE_PLAN — cambiar plan + reactivar módulos del nuevo plan
    // (no desactiva módulos manualmente prendidos; solo enciende los del nuevo plan)
    // ─────────────────────────────────────────────────────────
    if (accion === 'update_plan') {
      const nuevoPlan = getStr(payload, 'plan')
      if (!nuevoPlan || !['basico', 'pro', 'enterprise'].includes(nuevoPlan)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
      }

      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ plan: nuevoPlan, plan_desde: new Date().toISOString().split('T')[0] }) }
      )
      if (!upd.ok) throw new Error(await upd.text())

      // Activar módulos correspondientes (sin tocar los ya activos)
      const catalogoRes = await fetch(
        `${supabaseUrl}/rest/v1/catalogo_modulos?select=modulo,plan`,
        { headers }
      )
      const catalogo = (await catalogoRes.json()) as { modulo: string; plan: string }[]
      const aActivar = catalogo.filter(c => {
        if (nuevoPlan === 'basico')     return c.plan === 'core'
        if (nuevoPlan === 'pro')        return c.plan === 'core' || c.plan === 'addon'
        if (nuevoPlan === 'enterprise') return true
        return false
      }).map(c => c.modulo)

      // UPDATE bulk: activar todos los módulos que correspondan al plan
      if (aActivar.length > 0) {
        const inList = aActivar.map(m => `"${m}"`).join(',')
        await fetch(
          `${supabaseUrl}/rest/v1/grupos_modulos?grupo_id=eq.${grupo_id}&modulo=in.(${encodeURIComponent(inList)})`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              activo:     true,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            }),
          }
        )
      }

      await audit({ plan_nuevo: nuevoPlan, modulos_activados_por_plan: aActivar.length })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // CAMBIAR_ESTADO_CUENTA
    // ─────────────────────────────────────────────────────────
    if (accion === 'cambiar_estado_cuenta') {
      const nuevo = getStr(payload, 'estado_cuenta')
      if (!nuevo || !['al_dia', 'pendiente_pago', 'suspendido'].includes(nuevo)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      }
      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ estado_cuenta: nuevo }) }
      )
      if (!upd.ok) throw new Error(await upd.text())
      await audit({ estado_nuevo: nuevo })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // TOGGLE_ACTIVO — suspender/reactivar
    // ─────────────────────────────────────────────────────────
    if (accion === 'toggle_activo') {
      const activo = payload?.activo
      if (typeof activo !== 'boolean') {
        return NextResponse.json({ error: 'Parámetro activo (boolean) requerido' }, { status: 400 })
      }
      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ activo }) }
      )
      if (!upd.ok) throw new Error(await upd.text())
      await audit({ activo })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // RESET_PASSWORD_ADMIN — genera password temporal nueva
    // ─────────────────────────────────────────────────────────
    if (accion === 'reset_password_admin') {
      const targetUserId = getStr(payload, 'user_id')
      if (!targetUserId) {
        return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
      }
      // Verificar que es admin del tenant
      const verifRes = await fetch(
        `${supabaseUrl}/rest/v1/usuarios?id=eq.${targetUserId}&grupo_id=eq.${grupo_id}&rol=eq.admin&select=id,email,nombre&limit=1`,
        { headers }
      )
      const verifArr = await verifRes.json()
      if (!Array.isArray(verifArr) || verifArr.length === 0) {
        return NextResponse.json({ error: 'Usuario no encontrado o no es admin del tenant' }, { status: 404 })
      }
      const adminUser = verifArr[0]

      const nuevaPassword = generarPasswordTemporal()
      const updRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
        method: 'PUT',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nuevaPassword }),
      })
      if (!updRes.ok) throw new Error('Error actualizando password: ' + await updRes.text())

      // Marcar primer_login=true para forzar cambio
      await fetch(
        `${supabaseUrl}/rest/v1/usuarios?id=eq.${targetUserId}`,
        { method: 'PATCH', headers, body: JSON.stringify({ primer_login: true }) }
      )

      await audit({ admin_email: adminUser.email, admin_id: targetUserId })
      return NextResponse.json({
        ok: true,
        password_temporal: nuevaPassword,
        email:             adminUser.email,
        nombre:            adminUser.nombre,
      })
    }

    // ─────────────────────────────────────────────────────────
    // INVITAR_ADMIN — crear nuevo admin del tenant
    // ─────────────────────────────────────────────────────────
    if (accion === 'invitar_admin') {
      const nombre = getStr(payload, 'nombre')
      const email  = getStr(payload, 'email')
      if (!nombre || nombre.length < 2) {
        return NextResponse.json({ error: 'Nombre requerido (mínimo 2 caracteres)' }, { status: 400 })
      }
      if (!email || !validarEmail(email)) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
      }

      // Verificar que no exista ya
      const yaExisteRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      )
      if (yaExisteRes.ok) {
        const ud = await yaExisteRes.json()
        const users = Array.isArray(ud) ? ud : (ud.users ?? [])
        if (users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase())) {
          return NextResponse.json({ error: `Ya existe un usuario con email ${email}` }, { status: 409 })
        }
      }

      const password = generarPasswordTemporal()
      const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:         email.toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: { nombre },
        }),
      })
      if (!authRes.ok) throw new Error('Error creando usuario en auth: ' + await authRes.text())
      const authData = await authRes.json()
      const newUserId = authData.id ?? authData.user?.id

      const usrRes = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id:           newUserId,
          grupo_id,
          nombre,
          email:        email.toLowerCase(),
          rol:          'admin',
          primer_login: true,
          activo:       true,
        }),
      })
      if (!usrRes.ok) {
        // Rollback auth
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, {
          method: 'DELETE',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        })
        throw new Error('Error creando registro en usuarios: ' + await usrRes.text())
      }

      await audit({ admin_email: email, admin_nombre: nombre })
      return NextResponse.json({
        ok: true,
        password_temporal: password,
        email,
        nombre,
      })
    }

    // ─────────────────────────────────────────────────────────
    // QUITAR_ADMIN — desactiva (no borra) un admin
    // ─────────────────────────────────────────────────────────
    if (accion === 'quitar_admin') {
      const targetUserId = getStr(payload, 'user_id')
      if (!targetUserId) {
        return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
      }

      // Validar que NO es el último admin activo del tenant
      const otrosAdminsRes = await fetch(
        `${supabaseUrl}/rest/v1/usuarios?grupo_id=eq.${grupo_id}&rol=eq.admin&activo=eq.true&id=neq.${targetUserId}&select=id&limit=1`,
        { headers }
      )
      const otros = await otrosAdminsRes.json()
      if (!Array.isArray(otros) || otros.length === 0) {
        return NextResponse.json({ error: 'No se puede quitar el último admin activo del tenant' }, { status: 409 })
      }

      const upd = await fetch(
        `${supabaseUrl}/rest/v1/usuarios?id=eq.${targetUserId}&grupo_id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ activo: false }) }
      )
      if (!upd.ok) throw new Error(await upd.text())

      await audit({ admin_id: targetUserId })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE_BRANDING
    // ─────────────────────────────────────────────────────────
    if (accion === 'update_branding') {
      const updateFields: Record<string, unknown> = {}
      const camposPermitidos = ['nombre_display', 'tagline', 'color_primario', 'color_acento', 'color_fondo', 'tipografia', 'logo_url', 'fondo_login_url']
      for (const f of camposPermitidos) {
        if (payload && f in payload) updateFields[f] = payload[f] ?? null
      }
      updateFields.updated_at = new Date().toISOString()

      if (Object.keys(updateFields).length === 1) {
        return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
      }
      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_config?grupo_id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify(updateFields) }
      )
      if (!upd.ok) throw new Error(await upd.text())
      await audit({ campos_actualizados: Object.keys(updateFields).filter(k => k !== 'updated_at') })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE_SMTP
    // ─────────────────────────────────────────────────────────
    if (accion === 'update_smtp') {
      const updateFields: Record<string, unknown> = {}
      const camposPermitidos = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from_name', 'smtp_from_email', 'notif_evaluador_email']
      for (const f of camposPermitidos) {
        if (payload && f in payload) updateFields[f] = payload[f] ?? null
      }
      updateFields.updated_at = new Date().toISOString()

      if (Object.keys(updateFields).length === 1) {
        return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
      }
      const upd = await fetch(
        `${supabaseUrl}/rest/v1/grupos_config?grupo_id=eq.${grupo_id}`,
        { method: 'PATCH', headers, body: JSON.stringify(updateFields) }
      )
      if (!upd.ok) throw new Error(await upd.text())
      await audit({ campos_actualizados: Object.keys(updateFields).filter(k => k !== 'updated_at') })
      return NextResponse.json({ ok: true })
    }

    // ─────────────────────────────────────────────────────────
    // ADD_NOTA
    // ─────────────────────────────────────────────────────────
    if (accion === 'add_nota') {
      const nota = getStr(payload, 'nota')
      if (!nota || nota.length < 1) {
        return NextResponse.json({ error: 'Nota vacía' }, { status: 400 })
      }
      const ins = await fetch(`${supabaseUrl}/rest/v1/tenant_notas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          grupo_id,
          superadmin_id: superadminId,
          nota,
        }),
      })
      if (!ins.ok) throw new Error(await ins.text())
      await audit({ nota_resumen: nota.slice(0, 80) })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  } catch (err) {
    console.error('[tenant-action]', accion, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}
