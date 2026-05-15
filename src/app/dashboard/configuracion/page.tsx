import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ConfigForm from './ConfigForm'

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const { data: config } = await supabase
    .from('grupos_config')
    .select('*')
    .eq('grupo_id', (await supabase.from('grupos_trabajo').select('id').eq('slug','metrikpro').single()).data?.id)
    .single()

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-medium">Configuración</h1>
            <p className="text-zinc-500 text-sm">Ajustes del sistema y notificaciones</p>
          </div>
        </div>
        <ConfigForm config={config} />
      </div>
    </div>
  )
}
