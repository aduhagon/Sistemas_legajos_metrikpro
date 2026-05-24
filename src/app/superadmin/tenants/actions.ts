'use server'

// ============================================================
// /app/superadmin/tenants/[id]/modulos/actions.ts
// Server Actions del panel de módulos
// ============================================================

import { supabaseAdmin, registrarAccionSuperadmin, verificarSuperadmin } from '@/lib/superadmin/supabase-admin'
import { revalidatePath } from 'next/cache'

interface ToggleModuloInput {
  superadminId: string
  grupoId: string
  modulo: string
  activo: boolean
}

export async function toggleModuloAction(input: ToggleModuloInput): Promise<{ ok: boolean; error?: string }> {
  const { superadminId, grupoId, modulo, activo } = input

  // Doble verificación server-side (el middleware ya lo verificó, pero es crítico)
  const esSuperadmin = await verificarSuperadmin(superadminId)
  if (!esSuperadmin) {
    return { ok: false, error: 'Sin permisos de superadmin' }
  }

  // Los módulos CORE no son toggleables
  const MODULOS_CORE = ['m1_autoregistro', 'm2_documentos', 'm3_evaluacion', 'm4_qr', 'm7_cron', 'm8_portal']
  if (MODULOS_CORE.includes(modulo)) {
    return { ok: false, error: 'Los módulos CORE no son modificables' }
  }

  // UPSERT del módulo
  const { error } = await supabaseAdmin
    .from('grupos_modulos')
    .upsert(
      { grupo_id: grupoId, modulo, activo, updated_at: new Date().toISOString(), updated_by: superadminId },
      { onConflict: 'grupo_id,modulo' }
    )

  if (error) {
    return { ok: false, error: error.message }
  }

  // Log de la acción
  await registrarAccionSuperadmin(
    superadminId,
    'TOGGLE_MODULO',
    grupoId,
    { modulo, activo }
  )

  revalidatePath(`/superadmin/tenants/${grupoId}`)
  revalidatePath('/superadmin/dashboard')

  return { ok: true }
}

export async function resolverAlertaAction(
  superadminId: string,
  alertaId: string
): Promise<{ ok: boolean; error?: string }> {
  const esSuperadmin = await verificarSuperadmin(superadminId)
  if (!esSuperadmin) return { ok: false, error: 'Sin permisos' }

  const { error } = await supabaseAdmin
    .from('superadmin_alertas')
    .update({ resuelta: true })
    .eq('id', alertaId)

  if (error) return { ok: false, error: error.message }

  await registrarAccionSuperadmin(superadminId, 'RESOLVER_ALERTA', undefined, { alerta_id: alertaId })

  revalidatePath('/superadmin/dashboard')
  revalidatePath('/superadmin/alertas')

  return { ok: true }
}

export async function pausarTenantAction(
  superadminId: string,
  grupoId: string
): Promise<{ ok: boolean; error?: string }> {
  const esSuperadmin = await verificarSuperadmin(superadminId)
  if (!esSuperadmin) return { ok: false, error: 'Sin permisos' }

  const { error } = await supabaseAdmin
    .from('grupos_trabajo')
    .update({ activo: false })
    .eq('id', grupoId)

  if (error) return { ok: false, error: error.message }

  await registrarAccionSuperadmin(superadminId, 'PAUSE_TENANT', grupoId)

  revalidatePath('/superadmin/dashboard')
  revalidatePath(`/superadmin/tenants/${grupoId}`)

  return { ok: true }
}

export async function reactivarTenantAction(
  superadminId: string,
  grupoId: string
): Promise<{ ok: boolean; error?: string }> {
  const esSuperadmin = await verificarSuperadmin(superadminId)
  if (!esSuperadmin) return { ok: false, error: 'Sin permisos' }

  const { error } = await supabaseAdmin
    .from('grupos_trabajo')
    .update({ activo: true })
    .eq('id', grupoId)

  if (error) return { ok: false, error: error.message }

  await registrarAccionSuperadmin(superadminId, 'REACTIVATE_TENANT', grupoId)

  revalidatePath('/superadmin/dashboard')
  revalidatePath(`/superadmin/tenants/${grupoId}`)

  return { ok: true }
}

// ============================================================
// Registrar alerta desde otras partes del sistema
// (llamar desde /api/email/notificar cuando falla SMTP)
// ============================================================
export async function registrarAlertaAction(input: {
  grupoId: string | null
  tipo: string
  severidad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'
  mensaje: string
  datosJson?: Record<string, unknown>
}): Promise<{ ok: boolean }> {
  const { error } = await supabaseAdmin.from('superadmin_alertas').insert({
    grupo_id: input.grupoId,
    tipo: input.tipo,
    severidad: input.severidad,
    mensaje: input.mensaje,
    datos_json: input.datosJson ?? null,
  })

  return { ok: !error }
}
