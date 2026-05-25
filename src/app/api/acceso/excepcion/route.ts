// src/app/api/acceso/excepcion/route.ts
// FUNC-001: registra acceso excepcional y notifica al supervisor
// CF-003: tipos explícitos en respuestas de RPCs
// CF-004: manejo de errores consistente

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'
import nodemailer from 'nodemailer'

interface ExcepcionRpcResult {
  ok: boolean
  error?: string
  razon_social?: string
  cuit?: string
}

interface SmtpConfig {
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_from_name: string | null
  smtp_from_email: string | null
  notif_evaluador_email: string | null
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { qr_token, establecimiento_id, autorizado_por, justificacion, lat, lng } = body

    if (!qr_token || !establecimiento_id || !autorizado_por || !justificacion) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros: qr_token, establecimiento_id, autorizado_por y justificacion son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('registrar_acceso_excepcion', {
      p_qr_token:           qr_token,
      p_establecimiento_id: establecimiento_id,
      p_autorizado_por:     autorizado_por,
      p_justificacion:      justificacion,
      p_lat:                lat ?? null,
      p_lng:                lng ?? null,
    })

    if (error) {
      console.error('[excepcion] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const result = data as ExcepcionRpcResult | null
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? 'Error al registrar la excepción' }, { status: 400 })
    }

    // ── Notificar al supervisor por email (falla silenciosa) ──────────────
    try {
      const grupoId = await getGrupoId()

      const { data: config } = await supabase
        .from('grupos_config')
        .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
        .eq('grupo_id', grupoId)
        .single()

      const { data: smtpPassword } = await supabase
        .rpc('fn_smtp_get_password', { p_grupo_id: grupoId })

      const { data: estab } = await supabase
        .from('establecimientos')
        .select('nombre')
        .eq('id', establecimiento_id)
        .single()

      const { data: portero } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .single()

      const cfg = config as SmtpConfig | null
      if (cfg?.smtp_user && smtpPassword && cfg?.notif_evaluador_email) {
        const transporter = nodemailer.createTransport({
          host:   cfg.smtp_host || 'smtp.gmail.com',
          port:   Number(cfg.smtp_port) || 587,
          secure: false,
          auth:   { user: cfg.smtp_user, pass: smtpPassword },
        })

        const from = `"${cfg.smtp_from_name || 'Sistema Legajos'}" <${cfg.smtp_from_email || cfg.smtp_user}>`
        const ahora = new Date().toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })

        await transporter.sendMail({
          from,
          to: cfg.notif_evaluador_email,
          subject: `⚠️ Ingreso de excepción — ${result.razon_social}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
              <h2 style="color:#92400e;margin-bottom:4px">⚠️ Ingreso de excepción registrado</h2>
              <p style="color:#78350f;font-size:14px;margin-top:0">
                Se autorizó un ingreso fuera de los parámetros habituales del sistema.
              </p>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:20px 0">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="color:#78350f;font-weight:600;padding:4px 0;width:40%">Proveedor</td><td style="color:#1a1a2e">${result.razon_social}</td></tr>
                  <tr><td style="color:#78350f;font-weight:600;padding:4px 0">CUIT</td><td style="color:#1a1a2e">${result.cuit}</td></tr>
                  <tr><td style="color:#78350f;font-weight:600;padding:4px 0">Establecimiento</td><td style="color:#1a1a2e">${estab?.nombre ?? establecimiento_id}</td></tr>
                  <tr><td style="color:#78350f;font-weight:600;padding:4px 0">Hora</td><td style="color:#1a1a2e">${ahora}</td></tr>
                  <tr><td style="color:#78350f;font-weight:600;padding:4px 0">Portero</td><td style="color:#1a1a2e">${(portero as any)?.nombre ?? user.email}</td></tr>
                  <tr><td style="color:#92400e;font-weight:700;padding:8px 0 4px">Autorizado por</td><td style="color:#1a1a2e;font-weight:600">${autorizado_por}</td></tr>
                </table>
              </div>
              <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:20px">
                <p style="color:#78350f;font-size:13px;font-weight:600;margin:0 0 6px">Justificación:</p>
                <p style="color:#1a1a2e;font-size:14px;margin:0;font-style:italic">"${justificacion}"</p>
              </div>
              <p style="color:#9ca3af;font-size:12px">
                Este ingreso quedó registrado en el sistema con trazabilidad completa.
              </p>
            </div>
          `,
        })
      }
    } catch (emailErr: unknown) {
      console.error('[excepcion] Email error:', emailErr instanceof Error ? emailErr.message : emailErr)
    }

    return NextResponse.json(result)

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[excepcion] Unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
