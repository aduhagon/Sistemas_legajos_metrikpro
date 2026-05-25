// ============================================================
// /app/api/superadmin/crear-tenant/route.ts
// v2 — ahora guarda plan + plan_desde + estado_cuenta en grupos_trabajo
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface CrearTenantBody {
  nombre:       string
  slug:         string
  plan:         'basico' | 'pro' | 'enterprise'
  admin_nombre: string
  admin_email:  string
}

function generarPasswordTemporal(): string {
  const letras  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  let pass = ''
  for (let i = 0; i < 4; i++) pass += letras[Math.floor(Math.random() * letras.length)]
  for (let i = 0; i < 4; i++) pass += numeros[Math.floor(Math.random() * numeros.length)]
  return pass
}

function validarSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)
}

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

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

  const body = await req.json().catch(() => null) as CrearTenantBody | null
  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { nombre, slug, plan, admin_nombre, admin_email } = body

  if (!nombre || nombre.trim().length < 3) {
    return NextResponse.json({ error: 'El nombre del tenant debe tener al menos 3 caracteres' }, { status: 400 })
  }
  if (!slug || !validarSlug(slug)) {
    return NextResponse.json({ error: 'Slug inválido. Usá solo letras minúsculas, números y guiones (3-30 caracteres)' }, { status: 400 })
  }
  if (!['basico', 'pro', 'enterprise'].includes(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  if (!admin_nombre || admin_nombre.trim().length < 2) {
    return NextResponse.json({ error: 'El nombre del admin es requerido' }, { status: 400 })
  }
  if (!admin_email || !validarEmail(admin_email)) {
    return NextResponse.json({ error: 'Email del admin inválido' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers = {
    apikey:        serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // Verificar slug único
  const slugCheck = await fetch(
    `${supabaseUrl}/rest/v1/grupos_trabajo?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`,
    { headers }
  )
  const slugArr = await slugCheck.json()
  if (Array.isArray(slugArr) && slugArr.length > 0) {
    return NextResponse.json({ error: `Ya existe un tenant con slug "${slug}"` }, { status: 409 })
  }

  // Verificar email no existente
  const existeAuthRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(admin_email)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (existeAuthRes.ok) {
    const usersData = await existeAuthRes.json()
    const users = Array.isArray(usersData) ? usersData : (usersData.users ?? [])
    const yaExiste = users.find((u: { email?: string }) => u.email?.toLowerCase() === admin_email.toLowerCase())
    if (yaExiste) {
      return NextResponse.json({ error: `Ya existe un usuario con email ${admin_email}` }, { status: 409 })
    }
  }

  let tenantId:   string | null = null
  let authUserId: string | null = null

  try {
    // Crear tenant CON plan explícito
    const hoy = new Date().toISOString().split('T')[0]
    const tenantRes = await fetch(`${supabaseUrl}/rest/v1/grupos_trabajo`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        nombre:        nombre.trim(),
        slug:          slug.toLowerCase().trim(),
        activo:        true,
        plan,
        plan_desde:    hoy,
        estado_cuenta: 'al_dia',
      }),
    })
    if (!tenantRes.ok) throw new Error('Error creando tenant: ' + await tenantRes.text())
    const tenantData = await tenantRes.json()
    tenantId = Array.isArray(tenantData) ? tenantData[0].id : tenantData.id
    if (!tenantId) throw new Error('No se obtuvo el ID del tenant creado')

    // Config default
    const configRes = await fetch(`${supabaseUrl}/rest/v1/grupos_config`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        grupo_id:       tenantId,
        nombre_display: nombre.trim(),
      }),
    })
    if (!configRes.ok) throw new Error('Error creando config: ' + await configRes.text())

    // Módulos según plan
    const catalogoRes = await fetch(
      `${supabaseUrl}/rest/v1/catalogo_modulos?select=modulo,plan`,
      { headers }
    )
    const catalogo = (await catalogoRes.json()) as { modulo: string; plan: string }[]

    const modulosAInsertar = catalogo.map(c => {
      let activo = false
      if (plan === 'basico' && c.plan === 'core') activo = true
      if (plan === 'pro'    && (c.plan === 'core' || c.plan === 'addon')) activo = true
      if (plan === 'enterprise') activo = true
      return {
        grupo_id:   tenantId,
        modulo:     c.modulo,
        activo,
        plan:       c.plan,
        updated_by: user.id,
      }
    })

    const modulosRes = await fetch(`${supabaseUrl}/rest/v1/grupos_modulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify(modulosAInsertar),
    })
    if (!modulosRes.ok) throw new Error('Error insertando módulos: ' + await modulosRes.text())

    // Admin en auth.users
    const passwordTemporal = generarPasswordTemporal()
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:         admin_email.toLowerCase().trim(),
        password:      passwordTemporal,
        email_confirm: true,
        user_metadata: { nombre: admin_nombre.trim() },
      }),
    })
    if (!authRes.ok) throw new Error('Error creando usuario en auth: ' + await authRes.text())
    const authData = await authRes.json()
    authUserId = authData.id ?? authData.user?.id
    if (!authUserId) throw new Error('No se obtuvo el ID del usuario auth')

    // Registro en usuarios
    const usuarioRes = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id:           authUserId,
        grupo_id:     tenantId,
        nombre:       admin_nombre.trim(),
        email:        admin_email.toLowerCase().trim(),
        rol:          'admin',
        primer_login: true,
        activo:       true,
      }),
    })
    if (!usuarioRes.ok) throw new Error('Error creando registro en usuarios: ' + await usuarioRes.text())

    // Audit log
    await fetch(`${supabaseUrl}/rest/v1/superadmin_audit_log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        superadmin_id: superadminId,
        accion:        'tenant_creado',
        grupo_id:      tenantId,
        datos_json: {
          tenant_nombre: nombre,
          tenant_slug:   slug,
          plan,
          admin_email,
          admin_nombre,
          modulos_activados: modulosAInsertar.filter(m => m.activo).length,
        },
      }),
    })

    return NextResponse.json({
      ok: true,
      tenant: { id: tenantId, nombre, slug, plan },
      admin: {
        email:             admin_email.toLowerCase().trim(),
        password_temporal: passwordTemporal,
        nombre:            admin_nombre.trim(),
      },
      url_login: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sistemas-legajos-metrikpro.vercel.app'}/login`,
    })
  } catch (err) {
    console.error('[crear-tenant] error:', err)

    if (authUserId) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }).catch(() => {})
    }
    if (tenantId) {
      await fetch(`${supabaseUrl}/rest/v1/grupos_modulos?grupo_id=eq.${tenantId}`, { method: 'DELETE', headers }).catch(() => {})
      await fetch(`${supabaseUrl}/rest/v1/grupos_config?grupo_id=eq.${tenantId}`, { method: 'DELETE', headers }).catch(() => {})
      await fetch(`${supabaseUrl}/rest/v1/grupos_trabajo?id=eq.${tenantId}`,   { method: 'DELETE', headers }).catch(() => {})
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado al crear tenant' },
      { status: 500 }
    )
  }
}
