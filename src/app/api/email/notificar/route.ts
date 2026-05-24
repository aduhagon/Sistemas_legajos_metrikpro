import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'

export async function POST(req: Request) {
  try {
    const { tipo, proveedor_id } = await req.json()

    const supabase = createClient()
    const grupoId = await getGrupoId()

    const { data: config } = await supabase
      .from('grupos_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
      .eq('grupo_id', grupoId)
      .single()

    if (!config?.smtp_user) {
      return NextResponse.json({ ok: false, error: 'SMTP no configurado' })
    }

    const { data: smtpPassword, error: pwErr } = await supabase
      .rpc('fn_smtp_get_password', { p_grupo_id: grupoId })

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

    // Para vencimiento_proximo, obtener los docs que vencen en los próximos 30 días
    let docsVencimiento: any[] = []
    if (tipo === 'vencimiento_proximo') {
      const hoyStr = new Date().toISOString().split('T')[0]
      const en30dias = new Date()
      en30dias.setDate(en30dias.getDate() + 30)
      const en30diasStr = en30dias.toISOString().split('T')[0]

      const { data: docs } = await supabase
        .from('documentos_legajo')
        .select('fecha_venc, documentos_requeridos(nombre)')
        .eq('proveedor_id', proveedor_id)
        .not('fecha_venc', 'is', null)
        .lte('fecha_venc', en30diasStr)
        .in('estado', ['CARGADO', 'APROBADO'])
        .order('fecha_venc')

      docsVencimiento = docs ?? []
    }

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
      // UX-P-03: nuevo template para recordatorio manual de vencimiento
      vencimiento_proximo: {
        to: proveedor.email,
        subject: `Documentación por vencer — ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#92400e">Documentación próxima a vencer</h2>
          <p style="color:#374151;margin-bottom:16px">
            Hola, te informamos que los siguientes documentos de <strong>${proveedor.razon_social}</strong> 
            están próximos a vencer:
          </p>
          ${docsVencimiento.length > 0
            ? `<ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f;margin:0 0 16px">
                ${docsVencimiento.map((d: any) => {
                  const dias = Math.ceil(
                    (new Date(d.fecha_venc + 'T12:00:00').getTime() - Date.now()) / 86400000
                  )
                  return `<li style="margin-bottom:6px">
                    <strong>${(d.documentos_requeridos as any)?.nombre}</strong>
                    — vence el ${new Date(d.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')}
                    ${dias <= 0 ? ' <span style="color:#b91c1c">(vencido)</span>' : ` (en ${dias} día${dias !== 1 ? 's' : ''})`}
                  </li>`
                }).join('')}
              </ul>`
            : `<p style="color:#78350f">Tenés documentación próxima a vencer. Ingresá al sistema para renovarla.</p>`
          }
          <p style="color:#666">
            Actualizá tu documentación en el portal para mantener habilitado tu acceso a los establecimientos.
          </p>
          <div style="margin-top:24px">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sistemas-legajos-metrikpro.vercel.app'}/proveedor/portal"
               style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Ir al portal →
            </a>
          </div>
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
