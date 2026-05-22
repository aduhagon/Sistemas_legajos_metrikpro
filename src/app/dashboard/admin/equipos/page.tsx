import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EquiposAdmin from './EquiposAdmin'

export default async function AdminEquiposPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const { data: grupo } = await supabase
    .from('grupos_trabajo').select('id').eq('slug', 'metrikpro').single()

  const [{ data: docsGenerales }, { data: tipos }] = await Promise.all([
    supabase
      .from('documentos_requeridos_equipo')
      .select('id, nombre, tipo_vigencia, obligatorio, tipo_equipo_id, activo')
      .eq('grupo_id', grupo?.id)
      .is('tipo_equipo_id', null)
      .order('nombre'),
    supabase
      .from('tipos_equipo')
      .select(`
        id, nombre, descripcion, icono, activo,
        documentos_requeridos_equipo(id, nombre, tipo_vigencia, obligatorio, tipo_equipo_id, activo)
      `)
      .eq('grupo_id', grupo?.id)
      .order('nombre'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Tipos de equipo y documentación</h1>
        <p className="text-zinc-500 text-sm">
          Configurá los tipos de equipo y los documentos requeridos para cada uno.
          Los documentos generales aplican a todos los tipos.
        </p>
      </div>
      <EquiposAdmin
        tipos={(tipos ?? []) as any[]}
        docsGenerales={(docsGenerales ?? []) as any[]}
        grupoId={grupo?.id ?? ''}
      />
    </div>
  )
}
