import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import crypto from 'crypto'

// POST /api/proveedor/upload-nomina
// Maneja tres tipos: alta_temprana, f931
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const supabaseAdmin = createAdminClient()
    const form = await req.formData()
    const tipo        = form.get('tipo') as string
    const file        = form.get('file') as File | null

    if (!file) return NextResponse.json({ ok: false, error: 'Archivo requerido' }, { status: 422 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Archivo demasiado grande (máx 20MB)' }, { status: 422 })

    const buffer    = Buffer.from(await file.arrayBuffer())
    const hash      = crypto.createHash('sha256').update(buffer).digest('hex')
    const ext       = file.name.split('.').pop() ?? 'pdf'
    const timestamp = Date.now()

    if (tipo === 'alta_temprana') {
      const altaId     = form.get('doc_id') as string
      if (!altaId) return NextResponse.json({ ok: false, error: 'doc_id requerido' }, { status: 422 })

      // Verificar que el alta pertenece a un proveedor del usuario
      const { data: alta } = await supabaseAdmin
        .from('altas_tempranas')
        .select('id, proveedor_id, grupo_id')
        .eq('id', altaId)
        .single()
      if (!alta) return NextResponse.json({ ok: false, error: 'Alta no encontrada' }, { status: 404 })

      const path = `nomina/${alta.proveedor_id}/altas/${altaId}_${timestamp}.${ext}`
      const { error: storageErr } = await supabaseAdmin.storage
        .from('documentos')
        .upload(path, buffer, { upsert: true, contentType: file.type })
      if (storageErr) throw storageErr

      const { data: signed } = await supabaseAdmin.storage
        .from('documentos')
        .createSignedUrl(path, 60 * 60 * 24 * 365)

      await supabaseAdmin.from('altas_tempranas').update({
        archivo_url:        signed?.signedUrl,
        hash_sha256:        hash,
        estado:             'CARGADO',
        fecha_presentacion: new Date().toISOString(),
        observaciones:      null,
      }).eq('id', altaId)

      return NextResponse.json({ ok: true })
    }

    if (tipo === 'f931') {
      const proveedorId  = form.get('proveedor_id') as string
      const periodoAnio  = parseInt(form.get('periodo_anio') as string)
      const periodoMes   = parseInt(form.get('periodo_mes') as string)
      const f931Id       = form.get('f931_id') as string | null

      if (!proveedorId || !periodoAnio || !periodoMes) {
        return NextResponse.json({ ok: false, error: 'proveedor_id, periodo_anio y periodo_mes son requeridos' }, { status: 422 })
      }

      // Obtener grupo_id del proveedor
      const { data: prov } = await supabaseAdmin
        .from('proveedores')
        .select('grupo_id')
        .eq('id', proveedorId)
        .single()
      if (!prov) return NextResponse.json({ ok: false, error: 'Proveedor no encontrado' }, { status: 404 })

      const path = `nomina/${proveedorId}/f931/${periodoAnio}_${String(periodoMes).padStart(2,'0')}_${timestamp}.${ext}`
      const { error: storageErr } = await supabaseAdmin.storage
        .from('documentos')
        .upload(path, buffer, { upsert: true, contentType: file.type })
      if (storageErr) throw storageErr

      const { data: signed } = await supabaseAdmin.storage
        .from('documentos')
        .createSignedUrl(path, 60 * 60 * 24 * 365)

      if (f931Id) {
        // Actualizar existente (re-subida por rechazo)
        await supabaseAdmin.from('presentaciones_f931').update({
          archivo_url:        signed?.signedUrl,
          hash_sha256:        hash,
          estado:             'CARGADO',
          fecha_presentacion: new Date().toISOString(),
          observaciones:      null,
        }).eq('id', f931Id)
      } else {
        // Crear nuevo
        await supabaseAdmin.from('presentaciones_f931').upsert({
          grupo_id:           prov.grupo_id,
          proveedor_id:       proveedorId,
          periodo_anio:       periodoAnio,
          periodo_mes:        periodoMes,
          archivo_url:        signed?.signedUrl,
          hash_sha256:        hash,
          estado:             'CARGADO',
          fecha_presentacion: new Date().toISOString(),
        }, { onConflict: 'proveedor_id,periodo_anio,periodo_mes' })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Tipo inválido' }, { status: 422 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload-nomina]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
