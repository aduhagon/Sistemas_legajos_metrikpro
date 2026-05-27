import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { registrarAlerta } from '@/lib/superadmin/registrar-alerta'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Envía el email de bienvenida al proveedor dado de alta desde el ERP.
 * Llama directamente a Nodemailer — no hace fetch a sí mismo.
 */
export async function enviarBienvenidaERP({
  grupo_id,
  destinatario,
  razon_social,
  cuit,
  portal_url,
}: {
  grupo_id: string
  destinatario: string
  razon_social: string
  cuit: string
  portal_url: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: config } = await supabaseAdmin
      .from('grupos_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email')
      .eq('grupo_id', grupo_id)
      .single()

    if (!config?.smtp_user) {
      await registrarAlerta({
        grupoId: grupo_id,
        tipo: 'smtp_no_configurado',
        severidad: 'critica',
        mensaje: 'Email de bienvenida ERP no enviado — SMTP no configurado',
        datos: { destinatario },
      })
      return { ok: false, error: 'SMTP no configurado' }
    }

    const { data: smtpPassword, error: pwErr } = await supabaseAdmin
      .rpc('fn_smtp_get_password', { p_grupo_id: grupo_id })

    if (pwErr || !smtpPassword) {
      await registrarAlerta({
        grupoId: grupo_id,
        tipo: 'smtp_password_error',
        severidad: 'critica',
        mensaje: 'No se pudo obtener contraseña SMTP para email de bienvenida ERP',
        datos: { error: pwErr?.message },
      })
      return { ok: false, error: 'No se pudo obtener la contraseña SMTP' }
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host || 'smtp.gmail.com',
      port: Number(config.smtp_port) || 587,
      secure: false,
      auth: { user: config.smtp_user, pass: smtpPassword },
    })

    const from = `"${config.smtp_from_name || 'Sistema Legajos'}" <${config.smtp_from_email || config.smtp_user}>`

    await transporter.sendMail({
      from,
      to: destinatario,
      subject: `Bienvenido — completá tu legajo para operar`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a2e">Bienvenido al sistema de legajos</h2>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0;font-weight:600;color:#1e40af">${razon_social}</p>
            <p style="margin:6px 0 0;color:#3b82f6;font-size:14px">CUIT: ${cuit}</p>
          </div>
          <p style="color:#374151">
            Tu empresa fue registrada en nuestro sistema de gestión de legajos.
            Para completar tu habilitación, ingresá al portal y cargá la documentación requerida:
          </p>
          <div style="margin:28px 0">
            <a href="${portal_url}"
               style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">
              Completar mi legajo →
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px">
            Si tenés inconvenientes para acceder, respondé este email y te ayudamos.
          </p>
        </div>
      `,
    })

    return { ok: true }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await registrarAlerta({
      grupoId: grupo_id,
      tipo: 'smtp_error',
      severidad: 'critica',
      mensaje: `Falló email de bienvenida ERP a ${destinatario}`,
      datos: { destinatario, error: msg },
    })
    return { ok: false, error: msg }
  }
}
