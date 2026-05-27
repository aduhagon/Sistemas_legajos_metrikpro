import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { generateApiKey } from '@/lib/api-auth'
import { getGrupoId } from '@/lib/grupo'

async function verificarAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: u } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  return u?.rol === 'admin' ? user : null
}

// POST — crear nueva API key
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { nombre, permisos } = await req.json() as { nombre: string; permisos: string[] }
  if (!nombre || !permisos?.length) {
    return NextResponse.json({ ok: false, error: 'Nombre y permisos requeridos' }, { status: 422 })
  }

  const supabaseAdmin = createAdminClient()
  const grupoId = await getGrupoId()
  const { key, keyHash, keyPrefix } = generateApiKey()

  const { error } = await supabaseAdmin.from('api_keys').insert({
    grupo_id:   grupoId,
    nombre,
    key_prefix: keyPrefix,
    key_hash:   keyHash,
    permisos,
    creada_por: user.id,
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Devolver la key completa UNA SOLA VEZ — nunca se guarda en claro
  return NextResponse.json({ ok: true, key })
}

// PATCH — revocar/activar key
export async function PATCH(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id, activa } = await req.json() as { id: string; activa: boolean }
  const supabaseAdmin = createAdminClient()
  const grupoId = await getGrupoId()

  const { error } = await supabaseAdmin
    .from('api_keys')
    .update({ activa })
    .eq('id', id)
    .eq('grupo_id', grupoId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
