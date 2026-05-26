// src/app/api/proveedor/rubros/route.ts
// Actualiza los rubros de un proveedor (reemplaza la lista completa)
// Permitido a: admin, evaluador, y el titular del propio proveedor

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'

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

    // Verificar que el usuario tiene permiso
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol, grupo_id')
      .eq('id', user.id)
      .single()

    const rolesPermitidos = ['admin', 'evaluador']
    const esAdminOEvaluador = usuario && rolesPermitidos.includes(usuario.rol)

    // Si no es admin/evaluador, verificar que es titular del proveedor
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

    const grupoId = await getGrupoId()

    // Verificar que todos los rubro_ids pertenecen al grupo
    const { data: rubrosValidos } = await supabase
      .from('rubros')
      .select('id')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .in('id', rubro_ids)

    if (!rubrosValidos || rubrosValidos.length !== rubro_ids.length) {
      return NextResponse.json({ ok: false, error: 'Uno o más rubros no son válidos' }, { status: 400 })
    }

    // Reemplazar rubros: borrar los actuales e insertar los nuevos
    const { error: deleteError } = await supabase
      .from('proveedor_rubros')
      .delete()
      .eq('proveedor_id', proveedor_id)

    if (deleteError) {
      console.error('[rubros] delete error:', deleteError.message)
      return NextResponse.json({ ok: false, error: 'Error al actualizar rubros' }, { status: 500 })
    }

    const { error: insertError } = await supabase
      .from('proveedor_rubros')
      .insert(rubro_ids.map(rid => ({
        proveedor_id,
        rubro_id: rid,
        grupo_id: grupoId,
      })))

    if (insertError) {
      console.error('[rubros] insert error:', insertError.message)
      return NextResponse.json({ ok: false, error: 'Error al guardar rubros' }, { status: 500 })
    }

    // Actualizar también el campo legacy rubro_id con el primer rubro
    await supabase
      .from('proveedores')
      .update({ rubro_id: rubro_ids[0] })
      .eq('id', proveedor_id)

    return NextResponse.json({ ok: true })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[rubros] unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
