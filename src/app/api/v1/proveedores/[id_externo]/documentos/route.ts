import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { params: Promise<{ id_externo: string }> }

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores/[id_externo]/documentos
// Detalle de cada documento del legajo con estado y vencimiento
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:documentos')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:documentos requerido', status: 403 })
  }

  const { id_externo } = await params

  try {
    // Buscar proveedor
    const { data: proveedor, error: provError } = await supabaseAdmin
      .from('proveedores')
      .select('id')
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

    // Documentos con tipo
    const { data: documentos, error: docsError } = await supabaseAdmin
      .from('documentos_legajo')
      .select(`
        id, estado, fecha_venc, created_at, updated_at,
        tipos_documento ( nombre, codigo, obligatorio, aplica_rubros )
      `)
      .eq('proveedor_id', proveedor.id)
      .order('tipos_documento(nombre)')

    if (docsError) throw docsError

    const hoy = new Date()

    const docs = (documentos ?? []).map(d => {
      const fechaVenc = d.fecha_venc ? new Date(d.fecha_venc) : null
      const diasParaVencer = fechaVenc
        ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        tipo:              (d.tipos_documento as { nombre: string } | null)?.nombre ?? 'Desconocido',
        codigo:            (d.tipos_documento as { codigo: string } | null)?.codigo ?? null,
        obligatorio:       (d.tipos_documento as { obligatorio: boolean } | null)?.obligatorio ?? false,
        estado:            d.estado,
        fecha_vencimiento: d.fecha_venc ?? null,
        dias_para_vencer:  diasParaVencer,
        vencido:           fechaVenc ? fechaVenc < hoy : false,
        ultima_actualizacion: d.updated_at,
      }
    })

    return Response.json({
      ok: true,
      id_externo,
      data: docs,
    })
  } catch (err) {
    console.error('[GET /api/v1/proveedores/[id_externo]/documentos]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}
