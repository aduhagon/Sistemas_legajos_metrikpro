import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasPermission, apiError } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RouteParams = { params: Promise<{ id_externo: string }> }

type RubroJoin          = { rubros: { nombre: string; codigo: string }[] }
type EstablecimientoJoin = { establecimientos: { nombre: string; id_externo: string }[] }
type HabilitacionRow    = { estado: string; fecha_alta: string; fecha_venc: string; qr_token: string }

type ProveedorRow = {
  id: string
  id_externo: string
  razon_social: string
  cuit: string
  estado: string
  created_at: string
  proveedor_rubros: RubroJoin[] | null
  proveedor_establecimientos: EstablecimientoJoin[] | null
  habilitaciones: HabilitacionRow[] | null
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/proveedores/[id_externo]
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await validateApiKey(req)
  if ('error' in auth) return apiError(auth.error)

  if (!hasPermission(auth, 'read:proveedores')) {
    return apiError({ code: 'FORBIDDEN', message: 'Permiso read:proveedores requerido', status: 403 })
  }

  const { id_externo } = await params

  try {
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

    const p = proveedor as unknown as ProveedorRow

    // Documentos
    const { data: documentos } = await supabaseAdmin
      .from('documentos_legajo')
      .select('id, estado, fecha_venc')
      .eq('proveedor_id', p.id)

    const docs = documentos ?? []
    const hoy  = new Date()

    const aprobados  = docs.filter(d => d.estado === 'APROBADO').length
    const pendientes = docs.filter(d => ['PENDIENTE', 'EN_REVISION'].includes(d.estado)).length
    const rechazados = docs.filter(d => d.estado === 'RECHAZADO').length
    const vencidos   = docs.filter(d =>
      d.fecha_venc && new Date(d.fecha_venc) < hoy && d.estado === 'APROBADO'
    ).length

    const proximoVenc = docs
      .filter(d => d.fecha_venc && d.estado === 'APROBADO' && new Date(d.fecha_venc) >= hoy)
      .map(d => d.fecha_venc as string)
      .sort()[0] ?? null

    // Último acceso
    const habIds = (p.habilitaciones ?? []).map(h => h.qr_token)
    const { data: ultimoAcceso } = await supabaseAdmin
      .from('registros_acceso')
      .select('created_at')
      .eq('tipo', 'ingreso')
      .in('habilitacion_id', habIds.length > 0 ? habIds : [''])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const habilitacionVigente = (p.habilitaciones ?? []).find(h => h.estado === 'VIGENTE')

    // Rubros: cada elemento de proveedor_rubros tiene rubros como array
    const rubros = (p.proveedor_rubros ?? []).flatMap(pr =>
      (pr.rubros ?? []).map((r: { nombre: string; codigo: string }) => ({
        nombre: r.nombre,
        codigo: r.codigo,
      }))
    )

    // Establecimientos habilitados
    const establecimientosHabilitados = (p.proveedor_establecimientos ?? []).flatMap(pe =>
      (pe.establecimientos ?? [])
        .map((e: { nombre: string; id_externo: string }) => e.id_externo)
        .filter(Boolean)
    )

    return Response.json({
      ok: true,
      data: {
        id_externo:    p.id_externo,
        razon_social:  p.razon_social,
        cuit:          p.cuit,
        estado_legajo: p.estado,
        habilitado:    habilitacionVigente != null,
        rubros,
        establecimientos_habilitados: establecimientosHabilitados,
        documentos: {
          total: docs.length,
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
