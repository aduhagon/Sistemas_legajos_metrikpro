// src/app/api/proveedor/rubros/route.ts
// Actualiza los rubros de un proveedor usando sincronizar_rubros_proveedor()
// - Admin y evaluador: pueden AGREGAR rubros
// - Solo supervisor (admin con rol supervisor): puede también QUITAR rubros
// - Titular del proveedor: puede agregar rubros propios

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { proveedor_id, rubro_ids } = body as { proveedor_id: string; rubro_ids: string[] }

    if (!proveedor_id || !Array.isArray(rubro_ids) || rubro_ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros: proveedor_id y rubro_ids (al menos 1)' }, { status: 400 })
    }

    // Obtener rol del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    const esSupervisor = usuario?.rol === 'supervisor'
    const esAdminOEvaluador = ['admin', 'evaluador', 'supervisor'].includes(usuario?.rol ?? '')

    // Si no es admin/evaluador/supervisor, verificar que es titular del proveedor
    if (!esAdminOEvaluador) {
      const { data: provUser } = await supabase
        .from('proveedores_usuarios')
        .select('rol')
        .eq('proveedor_id', proveedor_id)
        .eq('user_id', user.id)
        .eq('activo', true)
        .single()

      if (!provUser || provUser.rol !== 'titular') {
        return NextResponse.json({ ok: false, error: 'Sin permisos para modificar este proveedor' }, { status: 403 })
      }
    }

    // Obtener rubros actuales del proveedor
    const { data: rubrosActuales } = await supabase
      .from('proveedor_rubros')
      .select('rubro_id')
      .eq('proveedor_id', proveedor_id)

    const idsActuales = (rubrosActuales ?? []).map((r: any) => r.rubro_id as string)
    const idsNuevos   = rubro_ids

    // Calcular diferencias
    const rubrosAgregar = idsNuevos.filter(id => !idsActuales.includes(id))
    const rubrosQuitar  = idsActuales.filter(id => !idsNuevos.includes(id))

    // Solo supervisor puede quitar rubros
    if (rubrosQuitar.length > 0 && !esSupervisor) {
      return NextResponse.json({
        ok: false,
        error: 'Solo el supervisor puede retirar rubros de un proveedor'
      }, { status: 403 })
    }

    // Si no hay cambios reales, devolver ok sin llamar RPC
    if (rubrosAgregar.length === 0 && rubrosQuitar.length === 0) {
      return NextResponse.json({ ok: true, docs_agregados: 0, docs_quitados: 0 })
    }

    // Llamar RPC
    const { data, error: rpcError } = await supabase.rpc('sincronizar_rubros_proveedor', {
      p_proveedor_id:   proveedor_id,
      p_rubros_agregar: rubrosAgregar,
      p_rubros_quitar:  rubrosQuitar,
    })

    if (rpcError) {
      console.error('[rubros] RPC error:', rpcError.message)
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 })
    }

    const result = data as { ok: boolean; error?: string; docs_agregados?: number; docs_quitados?: number }
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'Error al sincronizar rubros' }, { status: 400 })
    }

    // Actualizar campo legacy rubro_id con el primer rubro de la lista nueva
    await supabase
      .from('proveedores')
      .update({ rubro_id: idsNuevos[0] })
      .eq('id', proveedor_id)

    return NextResponse.json({
      ok: true,
      docs_agregados: result.docs_agregados ?? 0,
      docs_quitados:  result.docs_quitados  ?? 0,
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[rubros] unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
