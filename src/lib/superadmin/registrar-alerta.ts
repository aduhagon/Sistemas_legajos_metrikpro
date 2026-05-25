// ============================================================
// /lib/superadmin/registrar-alerta.ts
// Helper para que cualquier API route registre una alerta
// operativa en superadmin_alertas. Usa service_role para
// poder insertar bypassing RLS.
// ============================================================

type Severidad = 'critica' | 'alta' | 'media' | 'info'

interface RegistrarAlertaParams {
  grupoId: string
  tipo: string                              // ej: 'smtp_error', 'cron_missed', 'storage_high'
  severidad: Severidad
  mensaje: string                           // descripción legible para el superadmin
  datos?: Record<string, unknown>           // contexto adicional (error.message, request_id, etc)
}

/**
 * Registra una alerta operativa visible en el panel SuperAdmin.
 * Antes de insertar verifica si ya hay una alerta del mismo tipo
 * para el mismo tenant NO RESUELTA en los últimos 30 minutos —
 * en ese caso NO crea duplicado (evita flooding por errores
 * repetidos del mismo tipo). Si encuentra una existente solo
 * actualiza datos_json y mensaje.
 *
 * No lanza excepciones: si falla, hace console.error y vuelve
 * silenciosamente para no romper el flujo principal del caller.
 */
export async function registrarAlerta(p: RegistrarAlertaParams): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[registrarAlerta] Faltan variables de entorno Supabase')
    return
  }

  try {
    // 1. Buscar alerta existente del mismo tipo no resuelta en últimos 30 min
    const treintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const buscarUrl =
      `${supabaseUrl}/rest/v1/superadmin_alertas` +
      `?grupo_id=eq.${p.grupoId}` +
      `&tipo=eq.${encodeURIComponent(p.tipo)}` +
      `&resuelta=eq.false` +
      `&created_at=gte.${encodeURIComponent(treintaMinAtras)}` +
      `&select=id&limit=1`

    const buscarRes = await fetch(buscarUrl, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    })

    if (buscarRes.ok) {
      const existentes = await buscarRes.json()
      if (Array.isArray(existentes) && existentes.length > 0) {
        // Actualizar mensaje/datos en lugar de duplicar
        const alertaId = existentes[0].id
        await fetch(
          `${supabaseUrl}/rest/v1/superadmin_alertas?id=eq.${alertaId}`,
          {
            method: 'PATCH',
            headers: {
              apikey:        serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mensaje:    p.mensaje,
              datos_json: p.datos ?? null,
            }),
          }
        )
        return
      }
    }

    // 2. Insertar nueva alerta
    await fetch(`${supabaseUrl}/rest/v1/superadmin_alertas`, {
      method: 'POST',
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grupo_id:   p.grupoId,
        tipo:       p.tipo,
        severidad:  p.severidad,
        mensaje:    p.mensaje,
        datos_json: p.datos ?? null,
        resuelta:   false,
      }),
    })
  } catch (err) {
    console.error('[registrarAlerta] Error al registrar alerta:', err)
    // No relanzamos — el caller no debe verse afectado si esto falla
  }
}
