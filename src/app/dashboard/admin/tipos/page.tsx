import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import TiposAdmin from './TiposAdmin'

export default async function AdminTiposPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const grupoId = await getGrupoId()

  const [{ data: tipos }, { data: rubros }] = await Promise.all([
    supabase.from('tipos_establecimiento')
      .select(`
        id, nombre, descripcion, icono, activo,
        tipos_establecimiento_rubros(rubro_id, rubros(id, codigo, nombre))
      `)
      .eq('grupo_id', grupoId)
      .order('nombre'),
    supabase.from('rubros')
      .select('id, codigo, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('codigo'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Tipos de establecimiento</h1>
        <p className="text-zinc-500 text-sm">
          Definí qué rubros pueden ingresar a cada tipo de establecimiento.
          Esta configuración aplica automáticamente a todos los establecimientos de ese tipo.
        </p>
      </div>
      <TiposAdmin tipos={(tipos ?? []) as any[]} rubros={rubros ?? []} grupoId={grupoId} />
    </div>
  )
}
