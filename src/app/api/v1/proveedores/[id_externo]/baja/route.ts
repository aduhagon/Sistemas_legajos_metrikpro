import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { params: Promise<{ id_externo: string }> }

// ─────────────────────────────────────────────────────────────
// POST /api/v1/proveedores/[id_externo]/baja
// Finnegans da de baja un proveedor → se suspende en Legajos
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'write:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso write:proveedores requerido', status: 403 })
  }

  const { id_externo } = await params

  // Motivo de baja opcional en el body
  let motivo: string | null = null
  try {
    const body = await req.json()
    motivo = body.motivo ?? null
  } catch {
    // body vacío — no es error
  }

  try {
    // Buscar proveedor
    const { data: proveedor, error: provError } = await supabaseAdmin
      .from('proveedores')
      .select('id, razon_social, estado')
      .eq('grupo_id', auth.grupo_id)
      .eq('id_externo', id_externo)
      .single()

    if (provError || !proveedor) {
      return apiError({
        code: 'PROVEEDOR_NOT_FOUND',
        message: `No existe proveedor con id_externo ${id_externo}`,
        status: 404,
      })
    }

    // Si ya está suspendido o dado de baja, idempotente — no es error
    if (proveedor.estado === 'SUSPENDIDO' || proveedor.estado === 'BAJA') {
      return Response.json({
        ok: true,
        id_externo,
        estado_legajo: proveedor.estado,
        mensaje: 'El proveedor ya estaba inactivo',
        changed: false,
      })
    }

    const estadoAnterior = proveedor.estado

    // 1. Suspender proveedor
    const { error: updateError } = await supabaseAdmin
      .from('proveedores')
      .update({
        estado:     'SUSPENDIDO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proveedor.id)

    if (updateError) throw updateError

    // 2. Revocar habilitación vigente
    await supabaseAdmin
      .from('habilitaciones')
      .update({ estado: 'REVOCADA' })
      .eq('proveedor_id', proveedor.id)
      .eq('estado', 'VIGENTE')

    // 3. Log ERP
    await supabaseAdmin.from('erp_sync_log').insert({
      grupo_id:   auth.grupo_id,
      api_key_id: auth.key_id,
      operacion:  'baja_proveedor',
      id_externo,
      entidad:    'proveedores',
      entidad_id: proveedor.id,
      resultado:  'updated',
      payload:    { estado_anterior: estadoAnterior, motivo },
    })

    // 4. Audit log interno
    await supabaseAdmin.from('audit_log').insert({
      grupo_id:  auth.grupo_id,
      accion:    'BAJA_PROVEEDOR_ERP',
      tabla:     'proveedores',
      registro_id: proveedor.id,
      datos_nuevos: {
        estado:  'SUSPENDIDO',
        origen:  'ERP',
        motivo,
      },
      datos_anteriores: { estado: estadoAnterior },
    })

    return Response.json({
      ok: true,
      id_externo,
      razon_social:  proveedor.razon_social,
      estado_legajo: 'SUSPENDIDO',
      changed:       true,
      ...(motivo ? { motivo } : {}),
    })

  } catch (err) {
    console.error('[POST /api/v1/proveedores/[id_externo]/baja]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}
