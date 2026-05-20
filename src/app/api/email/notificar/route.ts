import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { tipo, proveedor_id } = await req.json()

    const supabase = createClient()

    const { data: grupo } = await supabase
      .from('grupos_trabajo')
      .select('id')
      .eq('slug', 'metrikpro')
      .single()

    // Leer config SMTP — sin smtp_password (está cifrado en la BD)
    const { data: config } = await supabase
      .from('grupos_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
      .eq('grupo_id', grupo?.id)
      .single()

    if (!config?.smtp_user) {
      return NextResponse.json({ ok: false, error: 'SMTP no configurado' })
    }

    // Descifrar contraseña desde Vault vía función de BD (solo service_role puede llamarla)
    const { data: smtpPassword, error: pwErr } = await supabase
      .rpc('fn_smtp_get_password', { p_grupo_id: grupo?.id })

    if (pwErr || !smtpPassword) {
      return NextResponse.json({ ok: false, error: 'No se pudo obtener la contraseña SMTP' })
    }

    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('razon_social, email, rubros(nombre)')
      .eq('id', proveedor_id)
      .single()

    if (!proveedor) return NextResponse.json({ ok: false, error: 'Proveedor no encontrado' })

    const transporter = nodemailer.createTransport({
      host: config.smtp_host || 'smtp.gmail.com',
      port: Number(config.smtp_port) || 587,
      secure: false,
      auth: { user: config.smtp_user, pass: smtpPassword },
    })

    const from = `"${config.smtp_from_name || 'Sistema Legajos'}" <${config.smtp_from_email || config.smtp_user}>`
    const rubro = (proveedor.rubros as any)?.nombre ?? ''

    const templates: Record<string, { to: string; subject: string; html: string }> = {
      nuevo_legajo: {
        to: config.notif_evaluador_email || config.smtp_user,
        subject: `Revisión pendiente: ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a2e">Nuevo legajo para revisar</h2>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0;font-weight:600;color:#1e40af">${proveedor.razon_social}</p>
            <p style="margin:6px 0 0;color:#3b82f6;font-size:14px">Rubro: ${rubro}</p>
          </div>
          <p style="color:#666">Ingresá al sistema para revisar el legajo.</p>
        </div>`,
      },
      aprobado: {
        to: proveedor.email,
        subject: `Tu legajo fue aprobado — ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a2e">¡Legajo aprobado!</h2>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0;font-weight:600;color:#166534">✓ ${proveedor.razon_social}</p>
            <p style="margin:6px 0 0;color:#16a34a;font-size:14px">Tu legajo fue aprobado y está habilitado.</p>
          </div>
          <p style="color:#666">Ya podés acceder al establecimiento con tu carnet QR.</p>
        </div>`,
      },
      rechazado: {
        to: proveedor.email,
        subject: `Correcciones requeridas — ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a2e">Correcciones requeridas</h2>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0;font-weight:600;color:#991b1b">${proveedor.razon_social}</p>
            <p style="margin:6px 0 0;color:#dc2626;font-size:14px">Tu legajo requiere correcciones.</p>
          </div>
          <p style="color:#666">Revisá el sistema para ver las observaciones y subir la documentación corregida.</p>
        </div>`,
      },
    }

    const template = templates[tipo]
    if (!template) return NextResponse.json({ ok: false, error: 'Tipo inválido' })

    await transporter.sendMail({ from, ...template })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
