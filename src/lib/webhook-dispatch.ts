import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type WebhookEvento =
  | 'proveedor.aprobado'
  | 'proveedor.rechazado'
  | 'proveedor.suspendido'
  | 'documento.vencido'
  | 'documento.proximo_vencer'
  | 'ingreso.registrado'
  | 'egreso.registrado'

/**
 * Dispara un webhook a todos los endpoints configurados para ese evento en el tenant.
 * Fire-and-forget con reintentos: 3 intentos con backoff exponencial.
 * Cada intento queda registrado en webhook_logs.
 */
export async function dispatchWebhook(
  grupo_id: string,
  evento: WebhookEvento,
  data: Record<string, unknown>
): Promise<void> {
  // Buscar webhooks activos para este tenant y evento
  const { data: webhooks, error } = await supabaseAdmin
    .from('webhooks_config')
    .select('id, url, secret, headers_extra')
    .eq('grupo_id', grupo_id)
    .eq('activo', true)
    .contains('eventos', [evento])

  if (error || !webhooks || webhooks.length === 0) return

  const timestamp = new Date().toISOString()

  for (const webhook of webhooks) {
    const payload = {
      evento,
      timestamp,
      data,
    }

    const payloadStr = JSON.stringify(payload)

    // Firma HMAC-SHA256
    const firma = 'sha256=' + crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadStr)
      .digest('hex')

    // Headers base + headers extra del webhook
    const headers: Record<string, string> = {
      'Content-Type':    'application/json',
      'X-Webhook-Event': evento,
      'X-Webhook-Firma': firma,
      'X-Webhook-TS':    timestamp,
      ...(webhook.headers_extra as Record<string, string> ?? {}),
    }

    // Reintentos con backoff: 0s, 5s, 15s
    const delays = [0, 5000, 15000]
    let entregado = false
    let ultimoError: string | null = null
    let ultimoStatus: number | null = null

    for (let intento = 1; intento <= 3; intento++) {
      if (intento > 1) {
        await new Promise(r => setTimeout(r, delays[intento - 1]))
      }

      try {
        const res = await fetch(webhook.url, {
          method:  'POST',
          headers,
          body:    payloadStr,
          signal:  AbortSignal.timeout(10000), // 10s timeout por intento
        })

        ultimoStatus = res.status
        const respBody = await res.text().catch(() => '')

        if (res.ok) {
          // Entrega exitosa
          await supabaseAdmin.from('webhook_logs').insert({
            webhook_id:   webhook.id,
            grupo_id,
            evento,
            payload,
            intento,
            status_code:  ultimoStatus,
            respuesta:    respBody.slice(0, 1000),
            entregado:    true,
            entregado_at: new Date().toISOString(),
          })
          entregado = true
          break
        } else {
          ultimoError = `HTTP ${res.status}: ${respBody.slice(0, 200)}`
        }
      } catch (err: unknown) {
        ultimoError = err instanceof Error ? err.message : String(err)
        ultimoStatus = null
      }

      // Log del intento fallido
      await supabaseAdmin.from('webhook_logs').insert({
        webhook_id:  webhook.id,
        grupo_id,
        evento,
        payload,
        intento,
        status_code: ultimoStatus,
        entregado:   false,
        error_msg:   ultimoError,
      })
    }

    if (!entregado) {
      console.error(
        `[webhook-dispatch] Falló entrega de "${evento}" a ${webhook.url} después de 3 intentos. Último error: ${ultimoError}`
      )
    }
  }
}
