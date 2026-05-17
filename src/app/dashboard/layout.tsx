import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener datos del usuario — si falla RLS usamos el email como fallback
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, email, rol')
    .eq('id', user.id)
    .maybeSingle()

  const nombre = usuario?.nombre ?? user.email ?? 'Usuario'
  const rol = usuario?.rol ?? 'admin'

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <Navbar nombre={nombre} rol={rol} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
