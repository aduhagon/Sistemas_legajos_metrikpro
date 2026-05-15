import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import nodemailer from 'nodemailer'

export async function GET(req: Request) {
  // Seguridad: solo Vercel Cron puede llamar esto
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient()
  const hoy = new Date()
  const en7dias = new Date(hoy)
  en7dias.setDate(hoy.getDate() + 7)
  const hoyStr = hoy.toISOString().split('T')[0]
  const en7diasStr = en7dias.toISOString().split('T')[0]

  const resultados = { vencidos: 0, porVencer: 0, emailsEnviados: 0, errores: [] as string[] }

  // Obtener config SMTP
  const { data: grupo } = await supabase.from('grupos_trabajo').select('id').eq('slug', 'metrikpro').single()
  const { data: config } = await supabase
    .from('grupos_config')
    .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, notif_evaluador_email')
    .eq('grupo_id', grupo?.id)
    .single()

  const smtpOk = config?.smtp_user && config?.smtp_password

  function crearTransporter() {
    return nodemailer.createTransport({
      host: config?.smtp_host || 'smtp.gmail.com',
      port: Number(config?.smtp_port) || 587,
      secure: false,
      auth: { user: config!.smtp_user, pass: config!.smtp_password },
    })
  }

  const from = `"${config?.smtp_from_name || 'Sistema Legajos'}" <${config?.smtp_from_email || config?.smtp_user}>`

  // ─── 1. DOCUMENTOS VENCIDOS ──────────────────────────────────────────────
  const { data: docsVencidos } = await supabase
    .from('documentos_legajo')
    .select(`
      id, fecha_venc,
      documentos_requeridos(nombre),
      proveedores(id, razon_social, email, notif_vencimientos)
    `)
    .lt('fecha_venc', hoyStr)
    .in('estado', ['CARGADO', 'APROBADO'])

  if (docsVencidos?.length) {
    for (const doc of docsVencidos) {
      const prov = doc.proveedores as any
      // Marcar vencido
      await supabase.from('documentos_legajo')
        .update({ estado: 'VENCIDO', updated_at: new Date().toISOString() })
        .eq('id', doc.id)
      // Suspender habilitación
      await supabase.from('habilitaciones')
        .update({ estado: 'DOC_PENDIENTE', updated_at: new Date().toISOString() })
        .eq('proveedor_id', prov?.id).eq('estado', 'VIGENTE')
      // Proveedor vuelve a EN_REVISION
      await supabase.from('proveedores')
        .update({ estado: 'EN_REVISION', updated_at: new Date().toISOString() })
        .eq('id', prov?.id).eq('estado', 'APROBADO')

      resultados.vencidos++
    }

    // Email URGENTE al evaluador interno (siempre)
    if (smtpOk && config?.notif_evaluador_email) {
      try {
        const lista = docsVencidos.map((d: any) =>
          `<li><strong>${d.proveedores?.razon_social}</strong> — ${d.documentos_requeridos?.nombre} (venció el ${new Date(d.fecha_venc).toLocaleDateString('es-AR')})</li>`
        ).join('')

        await crearTransporter().sendMail({
          from, to: config.notif_evaluador_email,
          subject: `🔴 URGENTE: ${docsVencidos.length} documento(s) vencido(s) — Sistema Legajos`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#991b1b">Documentos vencidos hoy</h2>
            <p style="color:#666">Los siguientes proveedores fueron suspendidos automáticamente:</p>
            <ul style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 16px 16px 32px;color:#7f1d1d">${lista}</ul>
            <p style="color:#666;margin-top:20px">Ingresá al sistema para gestionar cada caso.</p>
          </div>`,
        })
        resultados.emailsEnviados++
      } catch (e: any) { resultados.errores.push(`Email vencidos evaluador: ${e.message}`) }
    }

    // Email al proveedor — SOLO si eligió recibir alertas (notif_vencimientos = true)
    if (smtpOk) {
      const proveedoresNotif = [...new Map(
        docsVencidos
          .filter((d: any) => d.proveedores?.notif_vencimientos)
          .map((d: any) => [d.proveedores.id, d.proveedores])
      ).values()]

      for (const prov of proveedoresNotif as any[]) {
        const docsDelProv = docsVencidos.filter((d: any) => d.proveedores?.id === prov.id)
        const lista = docsDelProv.map((d: any) =>
          `<li>${(d.documentos_requeridos as any)?.nombre} (venció el ${new Date(d.fecha_venc).toLocaleDateString('es-AR')})</li>`
        ).join('')
        try {
          await crearTransporter().sendMail({
            from, to: prov.email,
            subject: `URGENTE: Documentación vencida — ${prov.razon_social}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#991b1b">Documentación vencida</h2>
              <p style="color:#666">Los siguientes documentos vencieron y tu acceso fue suspendido:</p>
              <ul style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 16px 16px 32px;color:#7f1d1d">${lista}</ul>
              <p style="color:#666;margin-top:20px">Actualizá tu documentación en el portal para recuperar el acceso.</p>
            </div>`,
          })
          resultados.emailsEnviados++
        } catch (e: any) { resultados.errores.push(`Email vencido proveedor ${prov.email}: ${e.message}`) }
      }
    }
  }

  // ─── 2. DOCUMENTOS POR VENCER EN 7 DÍAS ─────────────────────────────────
  const { data: docsPorVencer } = await supabase
    .from('documentos_legajo')
    .select(`
      id, fecha_venc,
      documentos_requeridos(nombre),
      proveedores(id, razon_social, email, notif_vencimientos)
    `)
    .gte('fecha_venc', hoyStr)
    .lte('fecha_venc', en7diasStr)
    .in('estado', ['CARGADO', 'APROBADO'])

  if (docsPorVencer?.length) {
    // Email resumen al evaluador interno (siempre)
    if (smtpOk && config?.notif_evaluador_email) {
      try {
        const lista = docsPorVencer.map((d: any) => {
          const dias = Math.ceil((new Date(d.fecha_venc).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          return `<li><strong>${(d.proveedores as any)?.razon_social}</strong> — ${(d.documentos_requeridos as any)?.nombre} <span style="color:#d97706">(en ${dias} día${dias !== 1 ? 's' : ''})</span></li>`
        }).join('')

        await crearTransporter().sendMail({
          from, to: config.notif_evaluador_email,
          subject: `⚠️ ${docsPorVencer.length} documento(s) por vencer esta semana — Sistema Legajos`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#92400e">Documentos por vencer</h2>
            <p style="color:#666">Los siguientes documentos vencen en los próximos 7 días:</p>
            <ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f">${lista}</ul>
            <p style="color:#666;margin-top:20px">Contactá a los proveedores para que actualicen su documentación.</p>
          </div>`,
        })
        resultados.emailsEnviados++
      } catch (e: any) { resultados.errores.push(`Email por vencer evaluador: ${e.message}`) }
    }

    // Email al proveedor — SOLO si eligió recibir alertas
    if (smtpOk) {
      const proveedoresNotif = [...new Map(
        docsPorVencer
          .filter((d: any) => (d.proveedores as any)?.notif_vencimientos)
          .map((d: any) => [(d.proveedores as any).id, d.proveedores])
      ).values()]

      for (const prov of proveedoresNotif as any[]) {
        const docsDelProv = docsPorVencer.filter((d: any) => (d.proveedores as any)?.id === prov.id)
        const lista = docsDelProv.map((d: any) => {
          const dias = Math.ceil((new Date(d.fecha_venc).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          return `<li>${(d.documentos_requeridos as any)?.nombre} — vence en ${dias} día${dias !== 1 ? 's' : ''}</li>`
        }).join('')
        try {
          await crearTransporter().sendMail({
            from, to: (prov as any).email,
            subject: `Documentos por vencer — ${(prov as any).razon_social}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#92400e">Documentos por vencer</h2>
              <p style="color:#666">Los siguientes documentos vencen pronto. Actualizalos a tiempo para mantener tu acceso habilitado:</p>
              <ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f">${lista}</ul>
              <p style="color:#666;margin-top:20px">Ingresá al portal con tu CUIT para cargar la documentación actualizada.</p>
            </div>`,
          })
          resultados.emailsEnviados++
        } catch (e: any) { resultados.errores.push(`Email por vencer proveedor ${(prov as any).email}: ${e.message}`) }
      }
    }

    resultados.porVencer = docsPorVencer.length
  }

  // Log en audit
  await supabase.rpc('log_auditoria', {
    p_user_id: null,
    p_entidad: 'sistema',
    p_entidad_id: null,
    p_accion: 'CRON_VENCIMIENTOS',
    p_datos_json: resultados,
  })

  return NextResponse.json({ ok: true, fecha: hoyStr, ...resultados })
}
