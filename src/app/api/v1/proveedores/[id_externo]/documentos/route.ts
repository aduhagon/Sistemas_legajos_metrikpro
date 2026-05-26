import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { params: Promise<{ id_externo: string }> }

type TipoDocumento = {
  nombre: string
  codigo: string | null
  obligatorio: boolean
  aplica_rubros: unknown
}

type DocumentoRow = {
  id: string
  estado: string
  fecha_venc: string | null
  created_at: string
  updated_at: string
  tipos_documento: TipoDocumento | TipoDocumento[] | null
}

function getTipoDoc(tipos: TipoDocumento | TipoDocumento[] | null): TipoDocumento | null {
  if (!tipos) return null
  return Array.isArray(tipos) ? tipos[0] ?? null : tipos
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores/[id_externo]/documentos
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:documentos')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:documentos requerido', status: 403 })
  }

  const { id_externo } = await params

  try {
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

    const { data: documentos, error: docsError } = await supabaseAdmin
      .from('documentos_legajo')
      .select(`
        id, estado, fecha_venc, created_at, updated_at,
        tipos_documento ( nombre, codigo, obligatorio, aplica_rubros )
      `)
      .eq('proveedor_id', proveedor.id)
      .order('created_at')

    if (docsError) throw docsError

    const hoy = new Date()

    const docs = ((documentos ?? []) as DocumentoRow[]).map(d => {
      const tipo = getTipoDoc(d.tipos_documento)
      const fechaVenc = d.fecha_venc ? new Date(d.fecha_venc) : null
      const diasParaVencer = fechaVenc
        ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        tipo:              tipo?.nombre ?? 'Desconocido',
        codigo:            tipo?.codigo ?? null,
        obligatorio:       tipo?.obligatorio ?? false,
        estado:            d.estado,
        fecha_vencimiento: d.fecha_venc ?? null,
        dias_para_vencer:  diasParaVencer,
        vencido:           fechaVenc ? fechaVenc < hoy : false,
        ultima_actualizacion: d.updated_at,
      }
    })

    return Response.json({ ok: true, id_externo, data: docs })
  } catch (err) {
    console.error('[GET /api/v1/proveedores/[id_externo]/documentos]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}
