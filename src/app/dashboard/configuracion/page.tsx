import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ConfigForm from './ConfigForm'

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const { data: grupo } = await supabase
    .from('grupos_trabajo').select('id').eq('slug', 'metrikpro').single()

  const { data: config } = await supabase
    .from('grupos_config').select('*').eq('grupo_id', grupo?.id).single()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Configuración</h1>
        <p className="text-zinc-500 text-sm">Ajustes del sistema y notificaciones</p>
      </div>
      <div className="max-w-2xl">
        <ConfigForm config={config} />
      </div>
    </div>
  )
}
