// src/app/api/proveedor/upload/route.ts
// DT-002: hash SHA-256 calculado server-side
// FIX: path de equipos empieza con user.id (UUID) para que storage no falle

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { createHash } from 'crypto'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

type UploadTipo = 'legajo' | 'equipo'

export async function POST(req: Request) {
  try {
    const supabase      = createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const form      = await req.formData()
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
    const buffer      = Buffer.from(arrayBuffer)
    const hash        = createHash('sha256').update(buffer).digest('hex')

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'

    // El primer segmento DEBE ser un UUID válido — Supabase lo usa como owner_id
    // Legajo:  {user_id}/{doc_id}.ext
    // Equipo:  {user_id}/equipos/{doc_id}.ext
    const path = tipo === 'equipo'
      ? `${user.id}/equipos/${docId}.${ext}`
      : `${user.id}/${docId}.${ext}`

    // Admin client para storage — evita que las políticas RLS fallen en SSR
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documentos')
      .upload(path, buffer, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('[upload] Storage error:', uploadError.message)
      return NextResponse.json({ ok: false, error: 'Error al subir el archivo al storage' }, { status: 500 })
    }

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('documentos')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    if (urlError || !urlData?.signedUrl) {
      console.error('[upload] SignedUrl error:', urlError?.message)
      return NextResponse.json({ ok: false, error: 'No se pudo generar la URL del archivo' }, { status: 500 })
    }

    // RPC con cliente normal (respeta RLS de negocio)
    const rpcName = tipo === 'equipo'
      ? 'presentar_documento_equipo'
      : 'registrar_presentacion_documento'

    const { error: rpcError } = await supabase.rpc(rpcName, {
      p_doc_id:      docId,
      p_archivo_url: urlData.signedUrl,
      p_hash_sha256: hash,
      p_fecha_venc:  fechaVenc || null,
    })

    if (rpcError) {
      console.error(`[upload] RPC ${rpcName} error:`, rpcError.message)
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, hash })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[upload] Unhandled error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
