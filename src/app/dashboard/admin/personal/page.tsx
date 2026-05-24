// src/app/dashboard/admin/personal/page.tsx
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import PersonalHabilitadoAdmin from './PersonalHabilitadoAdmin'

export default async function AdminPersonalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (!['admin', 'evaluador'].includes(usuario?.rol ?? '')) redirect('/dashboard')

  const grupoId = await getGrupoId()

  const [{ data: personal }, { data: establecimientos }] = await Promise.all([
    supabase
      .from('personal_habilitado')
      .select(`
        id, nombre, cuil, qr_token, activo, notas, vigencia_hasta,
        personal_establecimientos(
          establecimiento_id,
          establecimientos(nombre)
        )
      `)
      .eq('grupo_id', grupoId)
      .order('nombre'),
    supabase
      .from('establecimientos')
      .select('id, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Personal habilitado</h1>
        <p className="text-zinc-500 text-sm">
          Personas con acceso a los establecimientos mediante carnet QR individual.
          Cada persona tiene nombre, CUIL y fecha de vigencia del permiso.
        </p>
      </div>
      <PersonalHabilitadoAdmin
        personal={(personal ?? []) as any[]}
        establecimientos={establecimientos ?? []}
        grupoId={grupoId}
      />
    </div>
  )
}
