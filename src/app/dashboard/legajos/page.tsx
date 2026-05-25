// src/app/dashboard/legajos/page.tsx
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import LegajosClient from './LegajosClient'

export default async function LegajosPage() {
  const supabase      = createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grupoId = await getGrupoId()

  // Datos del usuario logueado — rol y scope
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('rol, supervisor_scope')
    .eq('id', user.id)
    .single()

  const rol   = usuarioData?.rol ?? 'evaluador'
  const scope = usuarioData?.supervisor_scope

  const ROLES_SIN_SCOPE = ['admin', 'operador_acceso', 'auditor', 'operario']
  const tieneScope = !ROLES_SIN_SCOPE.includes(rol) && scope === 'asignados'

  let establecimientosFiltro: string[] | null = null
  if (tieneScope) {
    const { data: estabsAsignados } = await supabase
      .from('usuario_establecimientos')
      .select('establecimiento_id')
      .eq('usuario_id', user.id)

    establecimientosFiltro = (estabsAsignados ?? []).map((r: any) => r.establecimiento_id)
  }

  // ── Query de proveedores con admin client (bypassa RLS) ──────────────────
  // Necesario porque el JWT del evaluador/admin no siempre propaga auth.uid()
  // correctamente en el contexto SSR de Next.js 15, causando que RLS filtre
  // registros válidos. La autorización real está en el check de usuario arriba.
  let query = supabaseAdmin
    .from('proveedores')
    .select(`
      id, razon_social, cuit, email, tipo_proveedor, estado, created_at,
      establecimiento_id,
      rubros(nombre),
      proveedor_rubros(rubros(id, nombre, codigo)),
      documentos_legajo(id, estado, fecha_venc)
    `)
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  if (tieneScope && establecimientosFiltro !== null) {
    if (establecimientosFiltro.length === 0) {
      return (
        <LegajosClient
          proveedores={[]}
          rubros={[]}
          establecimientos={[]}
          grupoId={grupoId}
          scopeRestringido={true}
        />
      )
    }
    query = query.in('establecimiento_id', establecimientosFiltro)
  }

  let qEstabs = supabaseAdmin
    .from('establecimientos')
    .select('id, nombre')
    .eq('grupo_id', grupoId)
    .eq('activo', true)
    .order('nombre')

  if (tieneScope && establecimientosFiltro !== null && establecimientosFiltro.length > 0) {
    qEstabs = qEstabs.in('id', establecimientosFiltro)
  }

  const [
    { data: proveedores },
    { data: rubros },
    { data: establecimientos },
  ] = await Promise.all([
    query,
    supabaseAdmin
      .from('rubros')
      .select('id, nombre')
      .eq('grupo_id', grupoId)
      .eq('activo', true)
      .order('codigo'),
    qEstabs,
  ])

  return (
    <LegajosClient
      proveedores={(proveedores ?? []) as any[]}
      rubros={rubros ?? []}
      establecimientos={establecimientos ?? []}
      grupoId={grupoId}
      scopeRestringido={tieneScope}
    />
  )
}
