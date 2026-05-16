import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RubrosAdmin from './RubrosAdmin'

export default async function AdminRubrosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const { data: rubros } = await supabase
    .from('rubros')
    .select(`
      id, codigo, nombre, descripcion, activo,
      documentos_requeridos(
        id, codigo, nombre, tipo_vigencia, obligatorio,
        aplica_persona_fisica, aplica_persona_juridica, activo
      )
    `)
    .order('codigo')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Rubros y documentos</h1>
        <p className="text-zinc-500 text-sm">Configurá los rubros y los documentos requeridos por cada uno</p>
      </div>
      <RubrosAdmin rubros={rubros ?? []} />
    </div>
  )
}
