// src/app/api/acceso/excepcion/route.ts
// FUNC-001: registra acceso excepcional y notifica al supervisor

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const { qr_token, establecimiento_id, autorizado_por, justificacion, lat, lng } = await req.json()

    if (!qr_token || !establecimiento_id || !autorizado_por || !justificacion) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros' }, { status: 400 })
    }

    // Registrar la excepción en BD
    const { data, error } = await supabase.rpc('registrar_acceso_excepcion', {
      p_qr_token:           qr_token,
      p_establecimiento_id: establecimiento_id,
      p_autorizado_por:     autorizado_por,
      p_justificacion:      justificacion,
      p_lat:                lat ?? null,
      p_lng:                lng ?? null,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    if (!data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error }, { status: 400 })
    }

    // ── Notificar al supervisor por email ──────────────────────────────────
    try {
      const grupoId = await getGrupoId()

      const { data: config } = await supabase
        .from('grupos_config')
        .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
        .eq('grupo_id', grupoId)
        .single()

      const { data: smtpPassword } = await supabase
        .rpc('fn_smtp_get_password', { p_grupo_id: grupoId })

      // Obtener nombre del establecimiento
      const { data: estab } = await supabase
        .from('establecimientos')
        .select('nombre')
        .eq('id', establecimiento_id)
        .single()

      // Obtener nombre del portero
      const { data: portero } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .single()

      if (config?.smtp_user && smtpPassword && config?.notif_evaluador_email) {
        const transporter = nodemailer.createTransport({
          host:   config.smtp_host || 'smtp.gmail.com',
          port:   Number(config.smtp_port) || 587,
          secure: false,
          auth:   { user: config.smtp_user, pass: smtpPassword },
        })

        const from = `"${config.smtp_from_name || 'Sistema Legajos'}" <${config.smtp_from_email || config.smtp_user}>`
        const ahora = new Date().toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })

        await transporter.sendMail({
          from,
          to: config.notif_evaluador_email,
          subject: `⚠️ Ingreso de excepción — ${data.razon_social}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
              <h2 style="color:#92400e;margin-bottom:4px">⚠️ Ingreso de excepción registrado</h2>
              <p style="color:#78350f;font-size:14px;margin-top:0">
                Se autorizó un ingreso fuera de los parámetros habituales del sistema.
              </p>

              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:20px 0">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr>
                    <td style="color:#78350f;font-weight:600;padding:4px 0;width:40%">Proveedor</td>
                    <td style="color:#1a1a2e">${data.razon_social}</td>
                  </tr>
                  <tr>
                    <td style="color:#78350f;font-weight:600;padding:4px 0">CUIT</td>
                    <td style="color:#1a1a2e">${data.cuit}</td>
                  </tr>
                  <tr>
                    <td style="color:#78350f;font-weight:600;padding:4px 0">Establecimiento</td>
                    <td style="color:#1a1a2e">${estab?.nombre ?? establecimiento_id}</td>
                  </tr>
                  <tr>
                    <td style="color:#78350f;font-weight:600;padding:4px 0">Hora</td>
                    <td style="color:#1a1a2e">${ahora}</td>
                  </tr>
                  <tr>
                    <td style="color:#78350f;font-weight:600;padding:4px 0">Portero</td>
                    <td style="color:#1a1a2e">${portero?.nombre ?? user.email}</td>
                  </tr>
                  <tr>
                    <td style="color:#92400e;font-weight:700;padding:8px 0 4px">Autorizado por</td>
                    <td style="color:#1a1a2e;font-weight:600">${autorizado_por}</td>
                  </tr>
                </table>
              </div>

              <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:20px">
                <p style="color:#78350f;font-size:13px;font-weight:600;margin:0 0 6px">Justificación:</p>
                <p style="color:#1a1a2e;font-size:14px;margin:0;font-style:italic">"${justificacion}"</p>
              </div>

              <p style="color:#9ca3af;font-size:12px">
                Este ingreso quedó registrado en el sistema con trazabilidad completa.
                Podés consultarlo en el panel de reportes → Accesos.
              </p>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      // El email falla silenciosamente — la excepción ya fue registrada en BD
      console.error('Error enviando email de excepción:', emailErr)
    }

    return NextResponse.json(data)

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
