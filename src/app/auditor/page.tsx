import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import AuditorApp from './AuditorApp'

export default async function AuditorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol, grupo_id').eq('id', user.id).single()

  if (!usuario || !['admin', 'evaluador', 'auditor'].includes(usuario.rol)) {
    redirect('/dashboard')
  }

  const grupoId = await getGrupoId()

  const { data: establecimientos } = await supabase
    .from('establecimientos')
    .select('id, nombre, lat_centro, lng_centro, radio_metros')
    .eq('grupo_id', grupoId)
    .order('nombre')

  return (
    <AuditorApp
      establecimientos={establecimientos ?? []}
      auditorId={user.id}
    />
  )
}
