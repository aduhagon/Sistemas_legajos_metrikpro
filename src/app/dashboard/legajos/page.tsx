// src/app/dashboard/legajos/page.tsx
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import LegajosClient from './LegajosClient'

export default async function LegajosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grupoId = await getGrupoId()

  const [{ data: proveedores }, { data: rubros }] = await Promise.all([
    supabase
      .from('proveedores')
      .select(`
        id, razon_social, cuit, tipo_proveedor, estado, created_at,
        rubros(nombre),
        proveedor_rubros(rubros(id, nombre, codigo)),
        documentos_legajo(id, estado, fecha_venc)
      `)
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('rubros')
      .select('id, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('codigo'),
  ])

  return (
    <LegajosClient
      proveedores={(proveedores ?? []) as any[]}
      rubros={rubros ?? []}
      grupoId={grupoId}
    />
  )
}
