import { createClient } from './supabase-server'

/**
 * Slug del grupo activo — configurable por variable de entorno.
 * Por defecto 'metrikpro' para no romper deploys existentes.
 */
export const GRUPO_SLUG = process.env.GRUPO_SLUG ?? 'metrikpro'

/**
 * Devuelve el grupo_id del grupo activo.
 * Usar en todos los Server Components y API routes en lugar de
 * hardcodear .eq('slug', 'metrikpro').
 *
 * @example
 * const grupoId = await getGrupoId()
 * const { data } = await supabase.from('rubros').eq('grupo_id', grupoId)
 */
export async function getGrupoId(): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('grupos_trabajo')
    .select('id')
    .eq('slug', GRUPO_SLUG)
    .single()

  if (error || !data) {
    throw new Error(`Grupo '${GRUPO_SLUG}' no encontrado. Verificar variable GRUPO_SLUG.`)
  }

  return data.id
}

/**
 * Versión que devuelve null en lugar de lanzar excepción.
 * Útil cuando el grupo puede no existir todavía.
 */
export async function getGrupoIdSafe(): Promise<string | null> {
  try {
    return await getGrupoId()
  } catch {
    return null
  }
}
