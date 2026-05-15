import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, notif_evaluador_email } = await req.json()

    if (!smtp_user || !smtp_password || !notif_evaluador_email) {
      return NextResponse.json({ ok: false, error: 'Completá usuario, contraseña y email del evaluador' })
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host || 'smtp.gmail.com',
      port: Number(smtp_port) || 587,
      secure: false,
      auth: { user: smtp_user, pass: smtp_password },
    })

    await transporter.sendMail({
      from: `"${smtp_from_name || 'Sistema Legajos'}" <${smtp_from_email || smtp_user}>`,
      to: notif_evaluador_email,
      subject: '✓ Configuración de email correcta — Sistema Legajos',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a2e; margin-bottom: 8px;">Sistema Legajos</h2>
          <p style="color: #666;">Gestión de proveedores y contratistas</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #166534; font-weight: 600; margin: 0;">✓ Configuración de email correcta</p>
            <p style="color: #166534; margin: 8px 0 0;">Las notificaciones del sistema se enviarán a esta dirección.</p>
          </div>
          <p style="color: #999; font-size: 12px;">Email de prueba desde el panel de configuración.</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
