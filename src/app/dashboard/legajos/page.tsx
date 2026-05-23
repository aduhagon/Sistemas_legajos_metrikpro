import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LegajosClient from './LegajosClient'

export default async function LegajosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: proveedores }, { data: rubros }] = await Promise.all([
    supabase
      .from('proveedores')
      .select(`
        id, razon_social, cuit, tipo_proveedor, estado, created_at,
        rubros(nombre),
        documentos_legajo(id, estado, fecha_venc)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('rubros')
      .select('id, nombre')
      .eq('activo', true)
      .order('codigo'),
  ])

  return (
    <LegajosClient
      proveedores={(proveedores ?? []) as any[]}
      rubros={rubros ?? []}
    />
  )
}
