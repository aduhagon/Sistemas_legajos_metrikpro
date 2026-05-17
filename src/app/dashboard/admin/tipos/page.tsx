import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TiposAdmin from './TiposAdmin'

export default async function AdminTiposPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const { data: grupo } = await supabase
    .from('grupos_trabajo').select('id').eq('slug', 'metrikpro').single()

  const [{ data: tipos }, { data: rubros }] = await Promise.all([
    supabase.from('tipos_establecimiento')
      .select(`
        id, nombre, descripcion, icono, activo,
        tipos_establecimiento_rubros(rubro_id, rubros(id, codigo, nombre))
      `)
      .eq('grupo_id', grupo?.id)
      .order('nombre'),
    supabase.from('rubros')
      .select('id, codigo, nombre')
      .eq('grupo_id', grupo?.id)
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
      <TiposAdmin tipos={(tipos ?? []) as any[]} rubros={rubros ?? []} grupoId={grupo?.id ?? ''} />
    </div>
  )
}
