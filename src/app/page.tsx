import { redirect } from 'next/navigation'
import { getUsuarioSesion } from '@/lib/auth'

export default async function Home() {
  const usuario = await getUsuarioSesion()
  if (usuario) redirect('/dashboard')
  redirect('/login')
}
