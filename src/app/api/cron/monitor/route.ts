// ============================================================
// /app/api/cron/monitor/route.ts
// Cron de monitoreo del cron principal de vencimientos.
// Corre a las 8:30 UTC (después del cron principal a las 8:00).
// Verifica que el cron principal haya ejecutado HOY.
// Si no encuentra registro, genera alerta cron_missed crítica
// para cada tenant activo.
// ============================================================

import { NextResponse } from 'next/server'
import { registrarAlerta } from '@/lib/superadmin/registrar-alerta'

export async function GET(req: Request) {
  // 1. Validar Bearer token de cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
  }

  // 2. Calcular el inicio del día en UTC (cuando corre el cron)
  // Como ambos crons corren en UTC, comparamos contra el inicio del día UTC
  const hoy = new Date()
  const inicioHoyUTC = new Date(Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate(),
    0, 0, 0
  )).toISOString()

  // 3. Verificar si hay registro CRON_VENCIMIENTOS hoy
  // El cron principal hace UN solo log (no por tenant), así que basta
  // con verificar que exista AL MENOS UNO de hoy.
  const checkUrl =
    `${supabaseUrl}/rest/v1/audit_log` +
    `?accion=eq.CRON_VENCIMIENTOS` +
    `&created_at=gte.${encodeURIComponent(inicioHoyUTC)}` +
    `&select=id,created_at,datos_json&order=created_at.desc&limit=1`

  const checkRes = await fetch(checkUrl, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
  })

  if (!checkRes.ok) {
    return NextResponse.json(
      { error: 'Error consultando audit_log: ' + checkRes.status },
      { status: 500 }
    )
  }

  const registros = await checkRes.json()
  const cronEjecutado = Array.isArray(registros) && registros.length > 0

  // 4. Si el cron NO ejecutó, registrar alerta para cada tenant activo
  if (!cronEjecutado) {
    const tenantsRes = await fetch(
      `${supabaseUrl}/rest/v1/grupos_trabajo?activo=eq.true&select=id,nombre`,
      {
        headers: {
          apikey:        serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      }
    )

    const tenants = await tenantsRes.json()
    if (!Array.isArray(tenants)) {
      return NextResponse.json({ error: 'Error consultando tenants' }, { status: 500 })
    }

    const fechaHoy = hoy.toISOString().split('T')[0]
    for (const t of tenants) {
      await registrarAlerta({
        grupoId:   t.id,
        tipo:      'cron_missed',
        severidad: 'critica',
        mensaje:   `El cron de vencimientos NO ejecutó hoy (${fechaHoy}). Los proveedores con docs vencidos no fueron procesados.`,
        datos: {
          fecha:        fechaHoy,
          tenant:       t.nombre,
          verificacion: 'no se encontró registro CRON_VENCIMIENTOS en audit_log para hoy',
          accion_recomendada: 'verificar Vercel cron en dashboard + ejecutar manualmente /api/cron/vencimientos si es necesario',
        },
      })
    }

    return NextResponse.json({
      ok: false,
      cron_ejecutado: false,
      fecha: fechaHoy,
      tenants_alertados: tenants.length,
      mensaje: 'Cron principal NO ejecutó hoy. Alertas registradas.',
    })
  }

  // 5. Cron ejecutó OK — devolver info del último run
  return NextResponse.json({
    ok: true,
    cron_ejecutado: true,
    ultimo_run: registros[0].created_at,
    resultados: registros[0].datos_json,
  })
}
