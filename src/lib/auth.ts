import { createClient } from './supabase-server'

// Roles del sistema de legajos
export type Rol = 'admin' | 'evaluador' | 'operador_acceso'

export type UsuarioSesion = {
  id: string
  nombre: string
  email: string
  rol: Rol
  grupo_id: string
  grupo_nombre: string
  primer_login: boolean
}

/**
 * Devuelve el usuario autenticado con sus datos de la tabla `usuarios`.
 * Retorna null si no hay sesión o el usuario está inactivo.
 * Usar en Server Components y Route Handlers.
 */
export async function getUsuarioSesion(): Promise<UsuarioSesion | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, grupo_id, primer_login, grupos_trabajo(nombre)')
    .eq('id', user.id)
    .eq('activo', true)
    .single()

  if (!data) return null

  return {
    id: data.id,
    nombre: data.nombre,
    email: data.email,
    rol: data.rol as Rol,
    grupo_id: data.grupo_id,
    grupo_nombre: (data.grupos_trabajo as any)?.nombre ?? '',
    primer_login: data.primer_login,
  }
}

/**
 * Verifica si el usuario tiene uno de los roles requeridos.
 * Usar en Server Components para proteger rutas por rol.
 */
export async function requiereRol(...roles: Rol[]): Promise<UsuarioSesion | null> {
  const usuario = await getUsuarioSesion()
  if (!usuario) return null
  if (!roles.includes(usuario.rol)) return null
  return usuario
}
