import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getGrupoId } from '@/lib/grupo'
import nodemailer from 'nodemailer'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient()
  const hoy = new Date()
  const en7dias = new Date(hoy)
  en7dias.setDate(hoy.getDate() + 7)
  const hoyStr     = hoy.toISOString().split('T')[0]
  const en7diasStr = en7dias.toISOString().split('T')[0]

  const resultados = {
    vencidos: 0, provs_en_revision: 0, habs_doc_pendiente: 0,
    porVencer: 0, emailsEnviados: 0, errores: [] as string[],
    equipos: { vencidos: 0, porVencer: 0 },
  }

  // ── Config SMTP ──────────────────────────────────────────────
  const grupoId = await getGrupoId()
  const { data: config } = await supabase
    .from('grupos_config')
    .select('smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, notif_evaluador_email')
    .eq('grupo_id', grupoId)
    .single()
  const { data: smtpPassword } = await supabase.rpc('fn_smtp_get_password', { p_grupo_id: grupoId })
  const smtpOk = config?.smtp_user && smtpPassword

  function crearTransporter() {
    return nodemailer.createTransport({
      host: config?.smtp_host || 'smtp.gmail.com',
      port: Number(config?.smtp_port) || 587,
      secure: false,
      auth: { user: config!.smtp_user, pass: smtpPassword },
    })
  }

  const from = `"${config?.smtp_from_name || 'Sistema Legajos'}" <${config?.smtp_from_email || config?.smtp_user}>`

  // ── 1. VENCIMIENTOS — BATCH (ESC-001) ───────────────────────
  // Reemplaza el loop N+1 anterior por 3 UPDATEs en una sola función SQL.
  // Con 4.000 proveedores pasa de ~24.000 queries a 3 — sin riesgo de timeout.
  const { data: batchResult } = await supabase
    .rpc('fn_procesar_vencimientos_legajo')

  if (batchResult) {
    resultados.vencidos           = batchResult.docs_vencidos      ?? 0
    resultados.provs_en_revision  = batchResult.provs_en_revision  ?? 0
    resultados.habs_doc_pendiente = batchResult.habs_doc_pendiente ?? 0
  }

  // ── 2. EMAIL al evaluador si hay docs vencidos ───────────────
  if (smtpOk && config?.notif_evaluador_email && resultados.vencidos > 0) {
    // Traer los docs recién vencidos para el email (solo lectura)
    const { data: docsVencidos } = await supabase
      .from('documentos_legajo')
      .select('id, fecha_venc, documentos_requeridos(nombre), proveedores(id, razon_social, email, notif_vencimientos)')
      .eq('estado', 'VENCIDO')
      .gte('updated_at', hoyStr)  // solo los procesados hoy
      .order('fecha_venc')

    if (docsVencidos?.length) {
      try {
        const lista = docsVencidos.map((d: any) =>
          `<li><strong>${d.proveedores?.razon_social}</strong> — ${d.documentos_requeridos?.nombre} (venció el ${new Date(d.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')})</li>`
        ).join('')
        await crearTransporter().sendMail({
          from, to: config.notif_evaluador_email,
          subject: `🔴 URGENTE: ${docsVencidos.length} documento(s) vencido(s) — Sistema Legajos`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#991b1b">Documentos vencidos hoy</h2>
            <ul style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 16px 16px 32px;color:#7f1d1d">${lista}</ul>
          </div>`,
        })
        resultados.emailsEnviados++
      } catch (e: any) { resultados.errores.push(`Email vencidos evaluador: ${e.message}`) }

      // Emails a proveedores con notif activada
      if (smtpOk) {
        const provsNotif = Array.from(new Map(
          docsVencidos
            .filter((d: any) => d.proveedores?.notif_vencimientos)
            .map((d: any) => [d.proveedores.id, d.proveedores])
        ).values())

        for (const prov of provsNotif as any[]) {
          const docsDelProv = docsVencidos.filter((d: any) => d.proveedores?.id === prov.id)
          const lista = docsDelProv.map((d: any) =>
            `<li>${(d.documentos_requeridos as any)?.nombre} (venció el ${new Date(d.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')})</li>`
          ).join('')
          try {
            await crearTransporter().sendMail({
              from, to: prov.email,
              subject: `URGENTE: Documentación vencida — ${prov.razon_social}`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <h2 style="color:#991b1b">Documentación vencida</h2>
                <ul style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 16px 16px 32px;color:#7f1d1d">${lista}</ul>
                <p style="color:#666">Actualizá tu documentación en el portal para recuperar el acceso.</p>
              </div>`,
            })
            resultados.emailsEnviados++
          } catch (e: any) { resultados.errores.push(`Email vencido proveedor ${prov.email}: ${e.message}`) }
        }
      }
    }
  }

  // ── 3. DOCS POR VENCER (notificación preventiva) ─────────────
  const { data: docsPorVencer } = await supabase
    .from('documentos_legajo')
    .select('id, fecha_venc, documentos_requeridos(nombre), proveedores(id, razon_social, email, notif_vencimientos)')
    .gte('fecha_venc', hoyStr)
    .lte('fecha_venc', en7diasStr)
    .in('estado', ['CARGADO', 'APROBADO'])

  if (docsPorVencer?.length) {
    resultados.porVencer = docsPorVencer.length

    if (smtpOk && config?.notif_evaluador_email) {
      try {
        const lista = docsPorVencer.map((d: any) => {
          const dias = Math.ceil((new Date(d.fecha_venc + 'T12:00:00').getTime() - hoy.getTime()) / 86400000)
          return `<li><strong>${(d.proveedores as any)?.razon_social}</strong> — ${(d.documentos_requeridos as any)?.nombre} <span style="color:#d97706">(en ${dias} día${dias !== 1 ? 's' : ''})</span></li>`
        }).join('')
        await crearTransporter().sendMail({
          from, to: config.notif_evaluador_email,
          subject: `⚠️ ${docsPorVencer.length} documento(s) por vencer esta semana — Sistema Legajos`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
            <h2 style="color:#92400e">Documentos por vencer</h2>
            <ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f">${lista}</ul>
          </div>`,
        })
        resultados.emailsEnviados++
      } catch (e: any) { resultados.errores.push(`Email por vencer evaluador: ${e.message}`) }
    }

    if (smtpOk) {
      const provsNotif = Array.from(new Map(
        docsPorVencer
          .filter((d: any) => (d.proveedores as any)?.notif_vencimientos)
          .map((d: any) => [(d.proveedores as any).id, d.proveedores])
      ).values())

      for (const prov of provsNotif as any[]) {
        const docsDelProv = docsPorVencer.filter((d: any) => (d.proveedores as any)?.id === prov.id)
        const lista = docsDelProv.map((d: any) => {
          const dias = Math.ceil((new Date(d.fecha_venc + 'T12:00:00').getTime() - hoy.getTime()) / 86400000)
          return `<li>${(d.documentos_requeridos as any)?.nombre} — vence en ${dias} día${dias !== 1 ? 's' : ''}</li>`
        }).join('')
        try {
          await crearTransporter().sendMail({
            from, to: (prov as any).email,
            subject: `Documentos por vencer — ${(prov as any).razon_social}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#92400e">Documentos por vencer</h2>
              <ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f">${lista}</ul>
              <p style="color:#666">Ingresá al portal para cargar la documentación actualizada.</p>
            </div>`,
          })
          resultados.emailsEnviados++
        } catch (e: any) { resultados.errores.push(`Email por vencer proveedor ${(prov as any).email}: ${e.message}`) }
      }
    }
  }

  // ── 4. VENCIMIENTOS DE EQUIPOS ───────────────────────────────
  const { data: equiposResult } = await supabase.rpc('fn_procesar_vencimientos_equipos')
  if (equiposResult) {
    resultados.equipos.vencidos  = equiposResult.vencidos   ?? 0
    resultados.equipos.porVencer = equiposResult.por_vencer ?? 0
  }

  if (smtpOk && config?.notif_evaluador_email && (resultados.equipos.vencidos > 0 || resultados.equipos.porVencer > 0)) {
    try {
      const { data: docsEquipoAlert } = await supabase
        .from('documentos_equipo')
        .select(`
          id, estado, fecha_venc,
          documentos_requeridos_equipo(nombre),
          equipos_contratista(dominio, proveedores(razon_social))
        `)
        .or(`estado.eq.VENCIDO,and(fecha_venc.gte.${hoyStr},fecha_venc.lte.${en7diasStr})`)
        .in('estado', ['VENCIDO', 'CARGADO', 'APROBADO'])

      if (docsEquipoAlert?.length) {
        const vencidos  = docsEquipoAlert.filter((d: any) => d.estado === 'VENCIDO')
        const porVencer = docsEquipoAlert.filter((d: any) => d.estado !== 'VENCIDO')

        let html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">`
        html += `<h2 style="color:#1a1a2e">Alerta de equipos — Sistema Legajos</h2>`

        if (vencidos.length > 0) {
          const lista = vencidos.map((d: any) => {
            const equipo = d.equipos_contratista as any
            return `<li><strong>${equipo?.proveedores?.razon_social}</strong> · ${equipo?.dominio} — ${(d.documentos_requeridos_equipo as any)?.nombre}</li>`
          }).join('')
          html += `<h3 style="color:#991b1b">🔴 Vencidos hoy (${vencidos.length})</h3>
            <ul style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 16px 16px 32px;color:#7f1d1d">${lista}</ul>`
        }

        if (porVencer.length > 0) {
          const lista = porVencer.map((d: any) => {
            const equipo = d.equipos_contratista as any
            const dias = Math.ceil((new Date(d.fecha_venc + 'T12:00:00').getTime() - hoy.getTime()) / 86400000)
            return `<li><strong>${equipo?.proveedores?.razon_social}</strong> · ${equipo?.dominio} — ${(d.documentos_requeridos_equipo as any)?.nombre} <span style="color:#d97706">(en ${dias} día${dias !== 1 ? 's' : ''})</span></li>`
          }).join('')
          html += `<h3 style="color:#92400e">⚠️ Por vencer en 7 días (${porVencer.length})</h3>
            <ul style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 16px 16px 32px;color:#78350f">${lista}</ul>`
        }

        html += `</div>`

        await crearTransporter().sendMail({
          from, to: config.notif_evaluador_email,
          subject: `🚗 Alerta de equipos: ${resultados.equipos.vencidos} vencido(s), ${resultados.equipos.porVencer} por vencer — Sistema Legajos`,
          html,
        })
        resultados.emailsEnviados++
      }
    } catch (e: any) { resultados.errores.push(`Email equipos: ${e.message}`) }
  }

  // ── 5. LIMPIEZA ──────────────────────────────────────────────
  await supabase.rpc('fn_limpiar_registros_pendientes')
  await supabase.rpc('fn_limpiar_auditor_snapshots')

  // Log auditoría
  await supabase.rpc('log_auditoria', {
    p_user_id: null, p_entidad: 'sistema', p_entidad_id: null,
    p_accion: 'CRON_VENCIMIENTOS', p_datos_json: resultados,
  })

  return NextResponse.json({ ok: true, fecha: hoyStr, ...resultados })
}
