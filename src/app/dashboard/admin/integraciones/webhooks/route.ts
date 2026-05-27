import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { getGrupoId } from '@/lib/grupo'
import crypto from 'crypto'

async function verificarAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: u } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  return u?.rol === 'admin' ? user : null
}

// POST — crear webhook
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { nombre, url, eventos } = await req.json() as {
    nombre: string; url: string; eventos: string[]
  }

  if (!nombre || !url || !eventos?.length) {
    return NextResponse.json({ ok: false, error: 'Nombre, URL y eventos requeridos' }, { status: 422 })
  }

  const supabaseAdmin = createAdminClient()
  const grupoId = await getGrupoId()

  // Generar secret automáticamente
  const secret = crypto.randomBytes(32).toString('hex')

  const { error } = await supabaseAdmin.from('webhooks_config').insert({
    grupo_id:  grupoId,
    nombre,
    url,
    secret,
    eventos,
    creado_por: user.id,
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — activar/pausar webhook
export async function PATCH(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id, activo } = await req.json() as { id: string; activo: boolean }
  const supabaseAdmin = createAdminClient()
  const grupoId = await getGrupoId()

  const { error } = await supabaseAdmin
    .from('webhooks_config')
    .update({ activo })
    .eq('id', id)
    .eq('grupo_id', grupoId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — eliminar webhook
export async function DELETE(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  const supabaseAdmin = createAdminClient()
  const grupoId = await getGrupoId()

  const { error } = await supabaseAdmin
    .from('webhooks_config')
    .delete()
    .eq('id', id)
    .eq('grupo_id', grupoId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
