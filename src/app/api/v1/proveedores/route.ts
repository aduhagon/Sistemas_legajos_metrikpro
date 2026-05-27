import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'
import { enviarBienvenidaERP } from '@/lib/email-erp'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:proveedores requerido', status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const estado          = searchParams.get('estado')
  const venceEnDias     = searchParams.get('vence_en_dias')
  const establecimiento = searchParams.get('establecimiento')
  const page            = parseInt(searchParams.get('page') ?? '1')
  const limit           = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset          = (page - 1) * limit

  try {
    let query = supabaseAdmin
      .from('proveedores')
      .select(`
        id, id_externo, razon_social, cuit, estado, created_at,
        proveedor_rubros ( rubros ( nombre ) ),
        habilitaciones ( estado, fecha_venc )
      `, { count: 'exact' })
      .eq('grupo_id', auth.grupo_id)
      .range(offset, offset + limit - 1)
      .order('razon_social')

    if (estado) query = query.eq('estado', estado)

    const { data, error, count } = await query
    if (error) throw error

    let proveedores = (data ?? []) as Record<string, unknown>[]

    // Filtro por vencimiento próximo
    if (venceEnDias) {
      const dias = parseInt(venceEnDias)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + dias)
      const { data: docsVenciendo } = await supabaseAdmin
        .from('documentos_legajo')
        .select('proveedor_id')
        .eq('grupo_id', auth.grupo_id)
        .eq('estado', 'APROBADO')
        .lte('fecha_venc', fechaLimite.toISOString())
        .gte('fecha_venc', new Date().toISOString())
      const idsVenciendo = new Set((docsVenciendo ?? []).map(d => d.proveedor_id))
      proveedores = proveedores.filter(p => idsVenciendo.has(p.id as string))
    }

    // Filtro por establecimiento (id_externo)
    if (establecimiento) {
      const { data: estab } = await supabaseAdmin
        .from('establecimientos')
        .select('id')
        .eq('grupo_id', auth.grupo_id)
        .eq('id_externo', establecimiento)
        .single()
      if (estab) {
        const { data: provEstab } = await supabaseAdmin
          .from('proveedor_establecimientos')
          .select('proveedor_id')
          .eq('establecimiento_id', estab.id)
        const ids = new Set((provEstab ?? []).map(pe => pe.proveedor_id))
        proveedores = proveedores.filter(p => ids.has(p.id as string))
      }
    }

    return Response.json({
      ok: true,
      data: proveedores.map(formatProveedor),
      meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    console.error('[GET /api/v1/proveedores]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/proveedores
// Upsert desde ERP + email de bienvenida automático al crear
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'write:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso write:proveedores requerido', status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido', status: 422 })
  }

  const { id_externo, razon_social, cuit, email_contacto, telefono, rubros, establecimientos } = body as {
    id_externo?: string
    razon_social?: string
    cuit?: string
    email_contacto?: string
    telefono?: string
    rubros?: string[]
    establecimientos?: string[]
  }

  if (!id_externo || !razon_social || !cuit || !email_contacto) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Campos requeridos: id_externo, razon_social, cuit, email_contacto',
      status: 422,
    })
  }

  try {
    // ¿Ya existe por id_externo?
    const { data: existing } = await supabaseAdmin
      .from('proveedores')
      .select('id, estado, email')
      .eq('grupo_id', auth.grupo_id)
      .eq('id_externo', id_externo)
      .single()

    // Verificar CUIT duplicado con otro id_externo
    if (!existing) {
      const { data: cuitCheck } = await supabaseAdmin
        .from('proveedores')
        .select('id, id_externo')
        .eq('grupo_id', auth.grupo_id)
        .eq('cuit', cuit)
        .maybeSingle()
      if (cuitCheck) {
        return apiError({
          code: 'CUIT_DUPLICADO',
          message: `CUIT ${cuit} ya existe con id_externo ${cuitCheck.id_externo}`,
          status: 409,
        })
      }
    }

    const payload = {
      grupo_id:    auth.grupo_id,
      id_externo,
      razon_social,
      cuit,
      email:       email_contacto,
      telefono:    telefono ?? null,
      estado:      existing ? existing.estado : 'PENDIENTE',
      updated_at:  new Date().toISOString(),
    }

    let proveedorId: string
    let wasCreated: boolean

    if (existing) {
      const { error } = await supabaseAdmin
        .from('proveedores')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
      proveedorId = existing.id
      wasCreated = false
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from('proveedores')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      proveedorId = inserted.id
      wasCreated = true
    }

    // Log ERP
    await supabaseAdmin.from('erp_sync_log').insert({
      grupo_id:   auth.grupo_id,
      api_key_id: auth.key_id,
      operacion:  'upsert_proveedor',
      id_externo,
      entidad:    'proveedores',
      entidad_id: proveedorId,
      resultado:  wasCreated ? 'created' : 'updated',
      payload:    body,
    })

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proveedor/registro?cuit=${cuit}`

    // ── Email automático solo en alta nueva ──────────────────
    let emailEnviado = false
    let emailError: string | null = null

    if (wasCreated) {
      const emailResult = await enviarBienvenidaERP({
        grupo_id:    auth.grupo_id,
        destinatario: email_contacto,
        razon_social,
        cuit,
        portal_url:  portalUrl,
      })
      emailEnviado = emailResult.ok
      if (!emailResult.ok) emailError = emailResult.error ?? 'Error desconocido'
    }

    return Response.json(
      {
        ok: true,
        id_externo,
        estado_legajo: payload.estado,
        created: wasCreated,
        portal_url: wasCreated ? portalUrl : undefined,
        email: wasCreated
          ? { enviado: emailEnviado, ...(emailError ? { error: emailError } : {}) }
          : undefined,
      },
      { status: wasCreated ? 201 : 200 }
    )
  } catch (err) {
    console.error('[POST /api/v1/proveedores]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatProveedor(p: Record<string, unknown>) {
  type RubroJoin = { rubros: { nombre: string }[] }
  type HabilitacionRow = { estado: string; fecha_venc: string }

  const rubros = ((p.proveedor_rubros as RubroJoin[] | null) ?? [])
    .flatMap(r => r.rubros?.map(rb => rb.nombre) ?? [])
    .filter(Boolean)

  const habilitacion = ((p.habilitaciones as HabilitacionRow[] | null) ?? [])
    .find(h => h.estado === 'VIGENTE')

  return {
    id_externo:               p.id_externo,
    razon_social:             p.razon_social,
    cuit:                     p.cuit,
    estado_legajo:            p.estado,
    habilitado:               habilitacion != null,
    rubros,
    vencimiento_habilitacion: habilitacion?.fecha_venc ?? null,
    created_at:               p.created_at,
  }
}
