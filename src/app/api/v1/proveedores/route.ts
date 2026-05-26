import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores
// Listado filtrable de proveedores del tenant
// Query params: estado, vence_en_dias, establecimiento, page, limit
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:proveedores requerido', status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const estado       = searchParams.get('estado')
  const venceEnDias  = searchParams.get('vence_en_dias')
  const establecimiento = searchParams.get('establecimiento')
  const page         = parseInt(searchParams.get('page') ?? '1')
  const limit        = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset       = (page - 1) * limit

  try {
    // Query base
    let query = supabaseAdmin
      .from('proveedores')
      .select(`
        id,
        id_externo,
        razon_social,
        cuit,
        estado,
        created_at,
        proveedor_rubros ( rubros ( nombre ) ),
        habilitaciones ( estado, fecha_venc )
      `, { count: 'exact' })
      .eq('grupo_id', auth.grupo_id)
      .range(offset, offset + limit - 1)
      .order('razon_social')

    if (estado) query = query.eq('estado', estado)

    const { data, error, count } = await query
    if (error) throw error

    // Filtro por vencimiento de documentos (post-query si se pidió)
    let proveedores = data ?? []

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

      const idsVenciendo = new Set((docsVenciendo ?? []).map((d: { proveedor_id: string }) => d.proveedor_id))
      proveedores = proveedores.filter((p: { id: string }) => idsVenciendo.has(p.id))
    }

    // Filtro por establecimiento (id_externo del establecimiento)
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

        const ids = new Set((provEstab ?? []).map((pe: { proveedor_id: string }) => pe.proveedor_id))
        proveedores = proveedores.filter((p: { id: string }) => ids.has(p.id))
      }
    }

    return Response.json({
      ok: true,
      data: proveedores.map(formatProveedor),
      meta: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit),
      },
    })
  } catch (err) {
    console.error('[GET /api/v1/proveedores]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/proveedores
// Upsert de proveedor desde el ERP (idempotente por id_externo)
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

  // Validaciones mínimas
  const { id_externo, razon_social, cuit, email_contacto } = body as {
    id_externo?: string
    razon_social?: string
    cuit?: string
    email_contacto?: string
    tipo?: string
    telefono?: string
    rubros?: string[]
    establecimientos?: string[]
  }

  if (!id_externo || !razon_social || !cuit) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Campos requeridos: id_externo, razon_social, cuit',
      status: 422,
    })
  }

  try {
    // Verificar si ya existe por id_externo
    const { data: existing } = await supabaseAdmin
      .from('proveedores')
      .select('id, estado')
      .eq('grupo_id', auth.grupo_id)
      .eq('id_externo', id_externo as string)
      .single()

    // Verificar CUIT duplicado con otro id_externo
    if (!existing) {
      const { data: cuitCheck } = await supabaseAdmin
        .from('proveedores')
        .select('id, id_externo')
        .eq('grupo_id', auth.grupo_id)
        .eq('cuit', cuit as string)
        .single()

      if (cuitCheck) {
        return apiError({
          code: 'CUIT_DUPLICADO',
          message: `CUIT ${cuit} ya existe con id_externo ${cuitCheck.id_externo}`,
          status: 409,
        })
      }
    }

    const payload = {
      grupo_id:       auth.grupo_id,
      id_externo:     id_externo as string,
      razon_social:   razon_social as string,
      cuit:           cuit as string,
      email:          email_contacto as string | undefined,
      telefono:       body.telefono as string | undefined,
      estado:         existing ? existing.estado : 'PENDIENTE',
      updated_at:     new Date().toISOString(),
    }

    let proveedorId: string
    let wasCreated: boolean

    if (existing) {
      // Update
      const { error } = await supabaseAdmin
        .from('proveedores')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
      proveedorId = existing.id
      wasCreated = false
    } else {
      // Insert
      const { data: inserted, error } = await supabaseAdmin
        .from('proveedores')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      proveedorId = inserted.id
      wasCreated = true
    }

    // Log en erp_sync_log
    await supabaseAdmin.from('erp_sync_log').insert({
      grupo_id:    auth.grupo_id,
      api_key_id:  auth.key_id,
      operacion:   'upsert_proveedor',
      id_externo:  id_externo as string,
      entidad:     'proveedores',
      entidad_id:  proveedorId,
      resultado:   wasCreated ? 'created' : 'updated',
      payload:     body,
    })

    // URL de portal para que el ERP la comparta con el proveedor
    const portalUrl = wasCreated
      ? `${process.env.NEXT_PUBLIC_APP_URL}/proveedor/registro?cuit=${cuit}`
      : null

    return Response.json(
      {
        ok: true,
        id_externo,
        estado_legajo: payload.estado,
        created: wasCreated,
        ...(portalUrl ? { portal_url: portalUrl } : {}),
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
  const rubros = (p.proveedor_rubros as Array<{ rubros: { nombre: string } }> | null)
    ?.map(r => r.rubros?.nombre)
    .filter(Boolean) ?? []

  const habilitacion = (p.habilitaciones as Array<{ estado: string; fecha_venc: string }> | null)
    ?.find(h => h.estado === 'VIGENTE')

  return {
    id_externo:    p.id_externo,
    razon_social:  p.razon_social,
    cuit:          p.cuit,
    estado_legajo: p.estado,
    habilitado:    habilitacion != null,
    rubros,
    vencimiento_habilitacion: habilitacion?.fecha_venc ?? null,
    created_at:    p.created_at,
  }
}
