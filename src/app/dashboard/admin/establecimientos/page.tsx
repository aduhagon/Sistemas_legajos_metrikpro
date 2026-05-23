import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import EstablecimientosAdmin from './EstablecimientosAdmin'

export default async function AdminEstablecimientosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const grupoId = await getGrupoId()

  const [
    { data: establecimientos },
    { data: tipos },
    { data: rubros },
  ] = await Promise.all([
    supabase.from('establecimientos')
      .select(`
        id, nombre, descripcion, direccion, modo_acceso, activo,
        lat_centro, lng_centro, radio_metros, qr_token,
        tipos_establecimiento(id, nombre, icono),
        establecimientos_rubros(rubro_id, rubros(id, nombre, codigo))
      `)
      .eq('grupo_id', grupoId)
      .order('nombre'),
    supabase.from('tipos_establecimiento')
      .select('id, nombre, icono')
      .eq('grupo_id', grupoId)
      .eq('activo', true),
    supabase.from('rubros')
      .select('id, codigo, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('codigo'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Establecimientos</h1>
        <p className="text-zinc-500 text-sm">Configurá los establecimientos, sus rubros habilitados y el modo de control de acceso</p>
      </div>
      <EstablecimientosAdmin
        establecimientos={(establecimientos ?? []) as any[]}
        tipos={tipos ?? []}
        rubros={rubros ?? []}
        grupoId={grupoId}
      />
    </div>
  )
}
