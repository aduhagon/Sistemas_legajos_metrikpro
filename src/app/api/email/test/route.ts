// src/app/api/email/test/route.ts
// CF-004: catch ahora devuelve status 500

import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase-server'

interface TestEmailBody {
  smtp_host?: string
  smtp_port?: number | string
  smtp_user?: string
  smtp_from_name?: string
  smtp_from_email?: string
  notif_evaluador_email?: string
  grupo_id?: string
  smtp_password?: string
}

export async function POST(req: Request) {
  try {
    const body: TestEmailBody = await req.json()
    const {
      smtp_host, smtp_port, smtp_user, smtp_from_name,
      smtp_from_email, notif_evaluador_email,
      grupo_id,
      smtp_password: passwordDelForm,
    } = body

    if (!smtp_user || !notif_evaluador_email) {
      return NextResponse.json({ ok: false, error: 'Completá usuario SMTP y email del evaluador' }, { status: 400 })
    }

    // Resolver contraseña: si vino en el form usarla, sino descifrar desde Vault
    let password = passwordDelForm
    if (!password && grupo_id) {
      const supabase = createClient()
      const { data } = await supabase.rpc('fn_smtp_get_password', { p_grupo_id: grupo_id })
      password = data as string | undefined
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: 'No hay contraseña SMTP configurada' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host:   smtp_host || 'smtp.gmail.com',
      port:   Number(smtp_port) || 587,
      secure: false,
      auth:   { user: smtp_user, pass: password },
    })

    await transporter.sendMail({
      from: `"${smtp_from_name || 'Sistema Legajos'}" <${smtp_from_email || smtp_user}>`,
      to:   notif_evaluador_email,
      subject: '✓ Configuración de email correcta — Sistema Legajos',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a2e;margin-bottom:8px">Sistema Legajos</h2>
          <p style="color:#666">Gestión de proveedores y contratistas</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0">
            <p style="color:#166534;font-weight:600;margin:0">✓ Configuración de email correcta</p>
            <p style="color:#166534;margin:8px 0 0">Las notificaciones del sistema se enviarán a esta dirección.</p>
          </div>
          <p style="color:#999;font-size:12px">Email de prueba desde el panel de configuración.</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[email/test] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
