import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { dispatchWebhook } from '@/lib/webhook-dispatch'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// POST /api/legajos/accion
// Centraliza aprobar/rechazar legajo + email + webhook dispatch
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accion, proveedor_id, evaluador_id, observaciones } = body as {
      accion:       'aprobar' | 'rechazar'
      proveedor_id: string
      evaluador_id: string
      observaciones?: string
    }

    if (!accion || !proveedor_id || !evaluador_id) {
      return NextResponse.json({ ok: false, error: 'Faltan campos requeridos' }, { status: 422 })
    }

    // Verificar sesión del evaluador
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    // Ejecutar RPC
    let rpcResult: { data: { ok: boolean; error?: string } | null; error: unknown }

    if (accion === 'aprobar') {
      rpcResult = await supabaseAdmin.rpc('aprobar_proveedor', {
        p_proveedor_id: proveedor_id,
        p_evaluador_id: evaluador_id,
      })
    } else {
      rpcResult = await supabaseAdmin.rpc('rechazar_proveedor', {
        p_proveedor_id: proveedor_id,
        p_evaluador_id: evaluador_id,
        p_observaciones: observaciones ?? '',
      })
    }

    if (rpcResult.error || rpcResult.data?.ok === false) {
      const msg = (rpcResult.data as { error?: string } | null)?.error
        ?? (rpcResult.error instanceof Error ? rpcResult.error.message : String(rpcResult.error))
        ?? 'Error al ejecutar acción'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    // Obtener datos del proveedor para el webhook
    const { data: proveedor } = await supabaseAdmin
      .from('proveedores')
      .select('id_externo, razon_social, cuit, estado, grupo_id')
      .eq('id', proveedor_id)
      .single()

    // Email al proveedor (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/notificar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo:        accion === 'aprobar' ? 'aprobado' : 'rechazado',
        proveedor_id,
      }),
    }).catch(() => {})

    // Dispatch webhook hacia ERP (si el tenant tiene webhooks configurados)
    if (proveedor?.grupo_id) {
      const eventoWebhook = accion === 'aprobar'
        ? 'proveedor.aprobado'
        : 'proveedor.rechazado'

      // Fire-and-forget — no bloqueamos la respuesta
      dispatchWebhook(proveedor.grupo_id, eventoWebhook, {
        id_externo:    proveedor.id_externo,
        razon_social:  proveedor.razon_social,
        cuit:          proveedor.cuit,
        estado_legajo: proveedor.estado,
        ...(accion === 'rechazar' && observaciones ? { observaciones } : {}),
      }).catch(err => console.error('[legajo-accion] webhook dispatch error:', err))
    }

    return NextResponse.json({ ok: true })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/legajos/accion]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
