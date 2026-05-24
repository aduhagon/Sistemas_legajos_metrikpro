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

  // Datos del usuario logueado — rol y scope
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('rol, supervisor_scope')
    .eq('id', user.id)
    .single()

  const rol            = usuarioData?.rol ?? 'evaluador'
  const scope          = usuarioData?.supervisor_scope

  // Roles sin restricción de scope → ven todos los proveedores del grupo
  const ROLES_SIN_SCOPE = ['admin', 'operador_acceso', 'auditor', 'operario']
  const tieneScope = !ROLES_SIN_SCOPE.includes(rol) && scope === 'asignados'

  // Si tiene scope asignado → obtener los IDs de establecimientos permitidos
  let establecimientosFiltro: string[] | null = null
  if (tieneScope) {
    const { data: estabsAsignados } = await supabase
      .from('usuario_establecimientos')
      .select('establecimiento_id')
      .eq('usuario_id', user.id)

    establecimientosFiltro = (estabsAsignados ?? []).map((r: any) => r.establecimiento_id)
  }

  // Query de proveedores — con o sin filtro de establecimiento
  let query = supabase
    .from('proveedores')
    .select(`
      id, razon_social, cuit, tipo_proveedor, estado, created_at,
      establecimiento_id,
      rubros(nombre),
      proveedor_rubros(rubros(id, nombre, codigo)),
      documentos_legajo(id, estado, fecha_venc)
    `)
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  // Aplicar filtro si el usuario tiene scope restringido
  if (tieneScope && establecimientosFiltro !== null) {
    if (establecimientosFiltro.length === 0) {
      // Sin establecimientos asignados → no ve nada
      return (
        <LegajosClient
          proveedores={[]}
          rubros={[]}
          grupoId={grupoId}
          scopeRestringido={true}
        />
      )
    }
    query = query.in('establecimiento_id', establecimientosFiltro)
  }

  const [{ data: proveedores }, { data: rubros }] = await Promise.all([
    query,
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
      scopeRestringido={tieneScope}
    />
  )
}
