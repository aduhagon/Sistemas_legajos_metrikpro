import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'
import { registrarAlerta } from '@/lib/superadmin/registrar-alerta'

export async function POST(req: Request) {
  let grupoId: string | null = null
  let tipo: string | undefined

  try {
    const body = await req.json()
    tipo = body.tipo
    const { proveedor_id, doc_nombre, observaciones, destinatario, datos, grupo_id } = body

    // ── Caso especial: email ERP con datos directos (sin proveedor_id) ──
    // Cuando viene del POST /api/v1/proveedores ya tenemos todo en el body
    if (tipo === 'bienvenida_proveedor_erp') {
      // Acepta grupo_id directo en el body (viene del API route con service role)
      const gid = grupo_id as string
      if (!gid || !destinatario || !datos) {
        return NextResponse.json({ ok: false, error: 'Faltan campos: grupo_id, destinatario, datos' })
      }

      // Buscar config SMTP del tenant
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: config } = await adminClient
        .from('grupos_config')
        .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email')
        .eq('grupo_id', gid)
        .single()

      if (!config?.smtp_user) {
        await registrarAlerta({
          grupoId: gid,
          tipo: 'smtp_no_configurado',
          severidad: 'critica',
          mensaje: 'Email de bienvenida ERP no enviado — SMTP no configurado',
          datos: { tipo_email: tipo, destinatario },
        })
        return NextResponse.json({ ok: false, error: 'SMTP no configurado' })
      }

      const { data: smtpPassword, error: pwErr } = await adminClient
        .rpc('fn_smtp_get_password', { p_grupo_id: gid })

      if (pwErr || !smtpPassword) {
        await registrarAlerta({
          grupoId: gid,
          tipo: 'smtp_password_error',
          severidad: 'critica',
          mensaje: 'No se pudo obtener contraseña SMTP para email de bienvenida ERP',
          datos: { error: pwErr?.message },
        })
        return NextResponse.json({ ok: false, error: 'No se pudo obtener la contraseña SMTP' })
      }

      const transporter = nodemailer.createTransport({
        host: config.smtp_host || 'smtp.gmail.com',
        port: Number(config.smtp_port) || 587,
        secure: false,
        auth: { user: config.smtp_user, pass: smtpPassword },
      })

      const from = `"${config.smtp_from_name || 'Sistema Legajos'}" <${config.smtp_from_email || config.smtp_user}>`
      const { razon_social, portal_url, cuit } = datos as {
        razon_social: string
        portal_url: string
        cuit: string
      }

      const html = `
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
      `

      try {
        await transporter.sendMail({
          from,
          to: destinatario as string,
          subject: `Bienvenido — completá tu legajo para operar`,
          html,
        })
      } catch (smtpErr: unknown) {
        const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr)
        await registrarAlerta({
          grupoId: gid,
          tipo: 'smtp_error',
          severidad: 'critica',
          mensaje: `Falló email de bienvenida ERP a ${destinatario}`,
          datos: { destinatario, error: msg },
        })
        return NextResponse.json({ ok: false, error: msg })
      }

      return NextResponse.json({ ok: true })
    }

    // ── Flujo normal (todos los otros tipos) ────────────────────
    const supabase = createClient()
    grupoId = await getGrupoId()

    const { data: config } = await supabase
      .from('grupos_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
      .eq('grupo_id', grupoId)
      .single()

    if (!config?.smtp_user) {
      await registrarAlerta({
        grupoId: grupoId!,
        tipo: 'smtp_no_configurado',
        severidad: 'critica',
        mensaje: 'Intento de envío de email pero SMTP no está configurado',
        datos: { tipo_email: tipo, proveedor_id },
      })
      return NextResponse.json({ ok: false, error: 'SMTP no configurado' })
    }

    const { data: smtpPassword, error: pwErr } = await supabase
      .rpc('fn_smtp_get_password', { p_grupo_id: grupoId })

    if (pwErr || !smtpPassword) {
      await registrarAlerta({
        grupoId: grupoId!,
        tipo: 'smtp_password_error',
        severidad: 'critica',
        mensaje: 'No se pudo descifrar la contraseña SMTP del Vault',
        datos: { tipo_email: tipo, proveedor_id, error: pwErr?.message },
      })
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
    const rubrosData = proveedor.rubros as { nombre: string }[] | null
    const rubro = Array.isArray(rubrosData) ? (rubrosData[0]?.nombre ?? '') : ''

    let docsVencimiento: Array<{
      fecha_venc: string
      estado: string
      documentos_requeridos: { nombre: string }[] | null
    }> = []

    if (tipo === 'vencimiento_proximo') {
      const en30dias = new Date()
      en30dias.setDate(en30dias.getDate() + 30)
      const en30diasStr = en30dias.toISOString().split('T')[0]

      const { data: docs } = await supabase
        .from('documentos_legajo')
        .select('fecha_venc, estado, documentos_requeridos(nombre)')
        .eq('proveedor_id', proveedor_id)
        .not('fecha_venc', 'is', null)
        .or(`estado.eq.VENCIDO,and(fecha_venc.lte.${en30diasStr},estado.in.(CARGADO,APROBADO))`)
        .order('fecha_venc')

      docsVencimiento = (docs ?? []) as typeof docsVencimiento
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
      doc_rechazado: {
        to: proveedor.email,
        subject: `Documento rechazado — ${doc_nombre ?? 'Documento'} — ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#7f1d1d">Documento rechazado</h2>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:16px 0">
            <p style="margin:0;font-weight:600;color:#991b1b">${doc_nombre ?? 'Documento'}</p>
            <p style="margin:6px 0 0;color:#dc2626;font-size:14px">${proveedor.razon_social}</p>
          </div>
          ${observaciones ? `
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:0 0 16px">
            <p style="margin:0 0 4px;font-size:11px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Observación del evaluador</p>
            <p style="margin:0;color:#c2410c;font-size:14px">${observaciones}</p>
          </div>` : ''}
          <p style="color:#666;font-size:14px">Ingresá al portal, corregí el documento y volvelo a subir.</p>
          <div style="margin-top:24px">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sistemas-legajos-metrikpro.vercel.app'}/proveedor/portal"
               style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Ir al portal a corregir →
            </a>
          </div>
        </div>`,
      },
      vencimiento_proximo: {
        to: proveedor.email,
        subject: `Documentación vencida o por vencer — ${proveedor.razon_social}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#92400e">Alerta de documentación</h2>
          <p style="color:#374151;margin-bottom:16px">
            Hola, te informamos que los siguientes documentos de <strong>${proveedor.razon_social}</strong>
            requieren atención:
          </p>
          ${docsVencimiento.length > 0
            ? `<ul style="border-radius:8px;padding:16px 16px 16px 32px;margin:0 0 16px;border:1px solid #fde68a;background:#fffbeb">
                ${docsVencimiento.map(d => {
                  const dias = Math.ceil(
                    (new Date(d.fecha_venc + 'T12:00:00').getTime() - Date.now()) / 86400000
                  )
                  const vencido = dias <= 0
                  return `<li style="margin-bottom:8px;color:${vencido ? '#b91c1c' : '#78350f'}">
                    <strong>${(Array.isArray(d.documentos_requeridos) ? d.documentos_requeridos[0]?.nombre : d.documentos_requeridos?.nombre) ?? 'Documento'}</strong><br/>
                    <span style="font-size:13px">
                      ${vencido
                        ? `⚠ Venció el ${new Date(d.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')} (hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''})`
                        : `Vence el ${new Date(d.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')} (en ${dias} día${dias !== 1 ? 's' : ''})`
                      }
                    </span>
                  </li>`
                }).join('')}
              </ul>`
            : `<p style="color:#78350f">Tenés documentación que requiere renovación.</p>`
          }
          <p style="color:#666;font-size:14px">
            Actualizá tu documentación para mantener habilitado tu acceso.
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

    const template = templates[tipo as string]
    if (!template) return NextResponse.json({ ok: false, error: 'Tipo inválido' })

    try {
      await transporter.sendMail({ from, ...template })
    } catch (smtpErr: unknown) {
      const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr)
      await registrarAlerta({
        grupoId: grupoId!,
        tipo: 'smtp_error',
        severidad: 'critica',
        mensaje: `Falló envío de email tipo "${tipo}" a ${template.to}`,
        datos: {
          tipo_email: tipo,
          destinatario: template.to,
          proveedor_id,
          error: msg,
          smtp_host: config.smtp_host,
          smtp_port: config.smtp_port,
        },
      })
      return NextResponse.json({ ok: false, error: msg })
    }

    return NextResponse.json({ ok: true })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (grupoId) {
      await registrarAlerta({
        grupoId,
        tipo: 'email_notificar_exception',
        severidad: 'alta',
        mensaje: `Excepción en /api/email/notificar (tipo=${tipo ?? 'desconocido'})`,
        datos: { error: msg, tipo_email: tipo },
      })
    }
    return NextResponse.json({ ok: false, error: msg })
  }
}
