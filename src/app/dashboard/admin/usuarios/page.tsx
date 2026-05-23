import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import UsuariosAdmin from './UsuariosAdmin'

export default async function AdminUsuariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const grupoId = await getGrupoId()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo, created_at')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Usuarios internos</h1>
        <p className="text-zinc-500 text-sm">
          Gestioná los usuarios del sistema — evaluadores, operarios y porteros.
        </p>
      </div>
      <UsuariosAdmin
        usuarios={usuarios ?? []}
        grupoId={grupoId}
        miId={user.id}
      />
    </div>
  )
}
