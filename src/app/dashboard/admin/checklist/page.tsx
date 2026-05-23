import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import ChecklistAdmin from './ChecklistAdmin'

export default async function AdminChecklistPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const grupoId = await getGrupoId()

  const { data: items } = await supabase
    .from('checklist_auditoria')
    .select('id, nombre, descripcion, activo, orden')
    .eq('grupo_id', grupoId)
    .order('orden', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Checklist de auditoría</h1>
        <p className="text-zinc-500 text-sm">
          Puntos que el auditor evalúa al registrar una visita en campo.
          Solo aparecen los puntos activos, en el orden configurado.
        </p>
      </div>
      <ChecklistAdmin
        items={items ?? []}
        grupoId={grupoId}
      />
    </div>
  )
}
