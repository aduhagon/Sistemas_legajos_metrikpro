import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { params: Promise<{ id_externo: string }> }

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores/[id_externo]
// Estado completo del legajo para un proveedor específico
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:proveedores requerido', status: 403 })
  }

  const { id_externo } = await params

  try {
    // Buscar proveedor
    const { data: proveedor, error: provError } = await supabaseAdmin
      .from('proveedores')
      .select(`
        id, id_externo, razon_social, cuit, estado, created_at,
        proveedor_rubros ( rubros ( nombre, codigo ) ),
        proveedor_establecimientos ( establecimientos ( nombre, id_externo ) ),
        habilitaciones ( estado, fecha_alta, fecha_venc, qr_token )
      `)
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

    // Documentos del legajo
    const { data: documentos } = await supabaseAdmin
      .from('documentos_legajo')
      .select(`
        id, estado, fecha_venc,
        tipos_documento ( nombre, codigo, obligatorio )
      `)
      .eq('proveedor_id', proveedor.id)
      .order('fecha_venc', { ascending: true, nullsFirst: false })

    const docs = documentos ?? []
    const hoy = new Date()

    // Estadísticas de documentos
    const aprobados  = docs.filter(d => d.estado === 'APROBADO').length
    const pendientes = docs.filter(d => ['PENDIENTE', 'EN_REVISION'].includes(d.estado)).length
    const rechazados = docs.filter(d => d.estado === 'RECHAZADO').length
    const vencidos   = docs.filter(d => {
      if (!d.fecha_venc) return false
      return new Date(d.fecha_venc) < hoy && d.estado === 'APROBADO'
    }).length

    // Próximo vencimiento
    const proximoVenc = docs
      .filter(d => d.fecha_venc && d.estado === 'APROBADO' && new Date(d.fecha_venc) >= hoy)
      .map(d => d.fecha_venc)
      .sort()[0] ?? null

    // Último acceso
    const { data: ultimoAcceso } = await supabaseAdmin
      .from('registros_acceso')
      .select('created_at')
      .eq('grupo_id', auth.grupo_id)
      .eq('tipo', 'ingreso')
      .in(
        'habilitacion_id',
        (proveedor.habilitaciones as Array<{ qr_token: string }> ?? []).map(h => h.qr_token)
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const habilitacionVigente = (proveedor.habilitaciones as Array<{
      estado: string; fecha_venc: string
    }> | null)?.find(h => h.estado === 'VIGENTE')

    return Response.json({
      ok: true,
      data: {
        id_externo:    proveedor.id_externo,
        razon_social:  proveedor.razon_social,
        cuit:          proveedor.cuit,
        estado_legajo: proveedor.estado,
        habilitado:    habilitacionVigente != null,
        rubros: (proveedor.proveedor_rubros as Array<{ rubros: { nombre: string; codigo: string } }> | null)
          ?.map(r => ({ nombre: r.rubros?.nombre, codigo: r.rubros?.codigo })) ?? [],
        establecimientos_habilitados: (proveedor.proveedor_establecimientos as Array<{
          establecimientos: { nombre: string; id_externo: string }
        }> | null)
          ?.map(e => e.establecimientos?.id_externo).filter(Boolean) ?? [],
        documentos: {
          total:     docs.length,
          aprobados,
          pendientes,
          rechazados,
          vencidos,
          proximo_vencimiento: proximoVenc,
        },
        ultimo_acceso: ultimoAcceso?.created_at ?? null,
      },
    })
  } catch (err) {
    console.error('[GET /api/v1/proveedores/[id_externo]]', err)
    return apiError({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor', status: 500 })
  }
}
