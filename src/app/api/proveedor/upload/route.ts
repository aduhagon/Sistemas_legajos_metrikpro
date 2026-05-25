// src/app/api/proveedor/upload/route.ts
// DT-002: hash SHA-256 calculado server-side, no en el cliente
// CF-003: tipos explícitos en respuestas de RPCs
// CF-004: manejo de errores consistente

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createHash } from 'crypto'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

type UploadTipo = 'legajo' | 'equipo'

interface RpcResult {
  ok: boolean
  error?: string
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const form = await req.formData()
    const file      = form.get('file') as File | null
    const docId     = form.get('doc_id') as string | null
    const fechaVenc = form.get('fecha_venc') as string | null
    const tipo      = ((form.get('tipo') as string) ?? 'legajo') as UploadTipo

    if (!file || !docId) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros: file y doc_id son requeridos' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: 'Tipo de archivo no permitido. Usá PDF, JPG, PNG o WEBP' }, { status: 422 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: 'El archivo supera los 10MB' }, { status: 422 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = createHash('sha256').update(buffer).digest('hex')

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = tipo === 'equipo'
      ? `equipos/${docId}.${ext}`
      : `${user.id}/${docId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, buffer, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('[upload] Storage error:', uploadError.message)
      return NextResponse.json({ ok: false, error: 'Error al subir el archivo al storage' }, { status: 500 })
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('documentos')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    if (urlError || !urlData?.signedUrl) {
      console.error('[upload] SignedUrl error:', urlError?.message)
      return NextResponse.json({ ok: false, error: 'No se pudo generar la URL del archivo' }, { status: 500 })
    }

    const rpcName = tipo === 'equipo'
      ? 'presentar_documento_equipo'
      : 'registrar_presentacion_documento'

    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
      p_doc_id:      docId,
      p_archivo_url: urlData.signedUrl,
      p_hash_sha256: hash,
      p_fecha_venc:  fechaVenc || null,
    })

    if (rpcError) {
      console.error(`[upload] RPC ${rpcName} error:`, rpcError.message)
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 })
    }

    // Algunas RPCs devuelven { ok, error } — respetar si vienen
    const result = rpcData as RpcResult | null
    if (result && result.ok === false) {
      return NextResponse.json({ ok: false, error: result.error ?? 'Error en RPC' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, hash })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[upload] Unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
