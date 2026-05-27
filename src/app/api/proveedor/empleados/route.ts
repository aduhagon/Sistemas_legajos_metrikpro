import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'

// POST /api/proveedor/empleados — agregar empleado individual
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const body = await req.json() as {
      proveedor_id: string
      nombre: string
      cuil: string
      dni?: string
      fecha_ingreso?: string
    }

    if (!body.proveedor_id || !body.nombre || !body.cuil) {
      return NextResponse.json({ ok: false, error: 'proveedor_id, nombre y cuil son requeridos' }, { status: 422 })
    }

    const supabaseAdmin = createAdminClient()

    // Obtener grupo_id del proveedor
    const { data: prov } = await supabaseAdmin
      .from('proveedores')
      .select('grupo_id')
      .eq('id', body.proveedor_id)
      .single()
    if (!prov) return NextResponse.json({ ok: false, error: 'Proveedor no encontrado' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('empleados_contratista')
      .upsert({
        grupo_id:      prov.grupo_id,
        proveedor_id:  body.proveedor_id,
        nombre:        body.nombre.trim(),
        cuil:          body.cuil.trim(),
        dni:           body.dni?.trim() || null,
        fecha_ingreso: body.fecha_ingreso || null,
      }, { onConflict: 'proveedor_id,cuil' })
      .select('id')
      .single()

    if (error) throw error

    // Crear slot de alta temprana
    await supabaseAdmin.from('altas_tempranas').upsert({
      grupo_id:    prov.grupo_id,
      empleado_id: data.id,
      proveedor_id: body.proveedor_id,
    }, { onConflict: 'empleado_id' }).select()

    return NextResponse.json({ ok: true, id: data.id })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/proveedor/empleados]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
