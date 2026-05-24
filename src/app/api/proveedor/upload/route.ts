// src/app/api/proveedor/upload/route.ts
// DT-002: hash SHA-256 calculado server-side, no en el cliente

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createHash } from 'crypto'

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const form = await req.formData()
    const file      = form.get('file') as File | null
    const docId     = form.get('doc_id') as string | null
    const fechaVenc = form.get('fecha_venc') as string | null
    const tipo      = (form.get('tipo') as string) ?? 'legajo' // 'legajo' | 'equipo'

    if (!file || !docId) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros' }, { status: 400 })
    }

    // Validar tipo de archivo
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ ok: false, error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'El archivo supera los 10MB' }, { status: 400 })
    }

    // Convertir a Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // ── DT-002: Hash SHA-256 calculado SERVER-SIDE con Node.js crypto ──
    const hash = createHash('sha256').update(buffer).digest('hex')

    // Path en Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = tipo === 'equipo'
      ? `equipos/${docId}.${ext}`
      : `${user.id}/${docId}.${ext}`

    // Subir a Storage
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 })
    }

    // URL firmada 1 año
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documentos')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    if (urlError || !urlData?.signedUrl) {
      return NextResponse.json({ ok: false, error: 'No se pudo generar la URL' }, { status: 500 })
    }

    // Llamar RPC según tipo
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
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, hash })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
