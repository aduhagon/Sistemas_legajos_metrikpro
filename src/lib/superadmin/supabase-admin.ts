// ============================================================
// Cliente Supabase con Service Role — solo para /superadmin
// NUNCA importar este módulo desde Client Components
// ============================================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan variables de entorno SUPABASE para el superadmin')
}

/**
 * Cliente con service_role — bypasea RLS completamente.
 * Solo usar en Server Components y API Routes de /superadmin.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ============================================================
// Verificación de superadmin
// ============================================================
export async function verificarSuperadmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('usuarios_metrikpro')
    .select('id')
    .eq('user_id', userId)
    .eq('rol', 'superadmin')
    .eq('activo', true)
    .single()

  return !error && !!data
}

// ============================================================
// Actualizar último login
// ============================================================
export async function actualizarUltimoLogin(userId: string) {
  await supabaseAdmin
    .from('usuarios_metrikpro')
    .update({ ultimo_login: new Date().toISOString() })
    .eq('user_id', userId)
}

// ============================================================
// Registrar acción en el audit log del superadmin
// ============================================================
export async function registrarAccionSuperadmin(
  superadminId: string,
  accion: string,
  grupoId?: string,
  datosJson?: Record<string, unknown>
) {
  await supabaseAdmin.from('superadmin_audit_log').insert({
    superadmin_id: superadminId,
    accion,
    grupo_id: grupoId ?? null,
    datos_json: datosJson ?? null,
  })
}
