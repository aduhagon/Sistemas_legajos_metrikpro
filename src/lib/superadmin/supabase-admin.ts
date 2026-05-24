import { createClient } from '@supabase/supabase-js'

// No validar en module-level para no romper el build de Next.js
// La validación ocurre en runtime cuando se llaman las funciones

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan variables de entorno SUPABASE para el superadmin')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Exportar como getter lazy — no se instancia en build time
export const supabaseAdmin = new Proxy({} as ReturnType<typeof getAdminClient>, {
  get(_target, prop) {
    return getAdminClient()[prop as keyof ReturnType<typeof getAdminClient>]
  }
})

export async function verificarSuperadmin(userId: string): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from('usuarios_metrikpro')
    .select('id')
    .eq('user_id', userId)
    .eq('rol', 'superadmin')
    .eq('activo', true)
    .single()

  return !error && !!data
}

export async function actualizarUltimoLogin(userId: string) {
  await getAdminClient()
    .from('usuarios_metrikpro')
    .update({ ultimo_login: new Date().toISOString() })
    .eq('user_id', userId)
}

export async function registrarAccionSuperadmin(
  superadminId: string,
  accion: string,
  grupoId?: string,
  datosJson?: Record<string, unknown>
) {
  await getAdminClient().from('superadmin_audit_log').insert({
    superadmin_id: superadminId,
    accion,
    grupo_id: grupoId ?? null,
    datos_json: datosJson ?? null,
  })
}
