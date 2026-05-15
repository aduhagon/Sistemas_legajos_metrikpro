'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type DocLegajo = {
  id: string
  estado: string
  fecha_venc: string | null
  archivo_url: string | null
  observaciones: string | null
  documentos_requeridos: {
    codigo: string
    nombre: string
    tipo_vigencia: string
    obligatorio: boolean
  }
}

export default function PortalDocumentosPage() {
  const [cuit, setCuit] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [proveedor, setProveedor] = useState<any>(null)
  const [docs, setDocs] = useState<DocLegajo[]>([])
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null) // id del doc que se está subiendo
  const [uploadOk, setUploadOk] = useState<string | null>(null)

  async function buscarProveedor(e: React.FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setError('')
    setProveedor(null)
    setDocs([])

    const cuitLimpio = cuit.replace(/[-\s]/g, '')

    const { data, error: err } = await supabase
      .from('proveedores')
      .select('id, razon_social, cuit, estado, email, rubros(nombre)')
      .eq('cuit', cuitLimpio)
      .single()

    if (err || !data) {
      setError('No se encontró ningún proveedor con ese CUIT. ¿Ya te registraste?')
      setBuscando(false)
      return
    }

    setProveedor(data)

    // Cargar documentos del legajo
    const { data: docsData } = await supabase
      .from('documentos_legajo')
      .select(`
        id, estado, fecha_venc, archivo_url, observaciones,
        documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)
      `)
      .eq('proveedor_id', data.id)
      .order('documentos_requeridos(codigo)')

    setDocs((docsData as unknown as DocLegajo[]) ?? [])
    setBuscando(false)
  }

  async function handleUpload(docId: string, file: File) {
    setSubiendo(docId)
    setUploadOk(null)

    try {
      // 1. Subir archivo a Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `${proveedor.id}/${docId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, file, { upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      // 2. Obtener URL pública firmada
      const { data: urlData } = await supabase.storage
        .from('documentos')
        .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 año

      // 3. Calcular hash SHA-256
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // 4. Actualizar documentos_legajo
      await supabase
        .from('documentos_legajo')
        .update({
          archivo_url: urlData?.signedUrl ?? path,
          hash_sha256: hash,
          estado: 'CARGADO',
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId)

      // 5. Actualizar estado local
      setDocs(prev => prev.map(d =>
        d.id === docId
          ? { ...d, estado: 'CARGADO', archivo_url: urlData?.signedUrl ?? path }
          : d
      ))

      setUploadOk(docId)
    } catch (err: any) {
      setError(`Error al subir: ${err.message}`)
    } finally {
      setSubiendo(null)
    }
  }

  const estadoConfig: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: 'Pendiente',  color: 'zinc'   },
    CARGADO:   { label: 'Cargado',    color: 'blue'   },
    APROBADO:  { label: 'Aprobado',   color: 'green'  },
    RECHAZADO: { label: 'Rechazado',  color: 'red'    },
    VENCIDO:   { label: 'Vencido',    color: 'orange' },
  }

  const estadoProvConfig: Record<string, { label: string; color: string }> = {
    PENDIENTE:   { label: 'Pendiente de revisión', color: 'yellow' },
    EN_REVISION: { label: 'En revisión',           color: 'blue'   },
    APROBADO:    { label: 'Aprobado',              color: 'green'  },
    RECHAZADO:   { label: 'Requiere correcciones', color: 'red'    },
    SUSPENDIDO:  { label: 'Suspendido',            color: 'zinc'   },
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight text-lg">Sistema Legajos</span>
          </div>
          <p className="text-zinc-500 text-sm">Portal de documentación</p>
        </div>

        {/* Búsqueda por CUIT */}
        {!proveedor && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
            <h1 className="text-white font-medium text-xl mb-2">Cargá tu documentación</h1>
            <p className="text-zinc-500 text-sm mb-6">Ingresá tu CUIT para acceder a tu legajo.</p>

            <form onSubmit={buscarProveedor} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT</label>
                <input
                  value={cuit} onChange={e => setCuit(e.target.value)} required
                  placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              <button type="submit" disabled={buscando}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                {buscando ? 'Buscando...' : 'Ver mi legajo'}
              </button>
            </form>

            <p className="text-center text-zinc-600 text-xs mt-6">
              ¿Aún no te registraste?{' '}
              <a href="/registro" className="text-blue-400 hover:text-blue-300 transition-colors">Registrá tu empresa aquí</a>
            </p>
          </div>
        )}

        {/* Panel de documentos */}
        {proveedor && (
          <div>
            {/* Info del proveedor */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white font-medium text-lg">{proveedor.razon_social}</h2>
                  <p className="text-zinc-500 text-sm">CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre}</p>
                </div>
                <div>
                  {(() => {
                    const cfg = estadoProvConfig[proveedor.estado] ?? estadoProvConfig.PENDIENTE
                    return (
                      <span className={`text-xs px-3 py-1.5 rounded-full border ${
                        cfg.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        cfg.color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        cfg.color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        cfg.color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      }`}>
                        {cfg.label}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-zinc-500 text-xs">Documentación completada</span>
                  <span className="text-zinc-400 text-xs">
                    {docs.filter(d => ['CARGADO','APROBADO'].includes(d.estado)).length}/{docs.length}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${docs.length > 0 ? (docs.filter(d => ['CARGADO','APROBADO'].includes(d.estado)).length / docs.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Lista de documentos */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium">Documentos requeridos</h3>
                <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máximo 10MB por archivo</p>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {docs.map(doc => {
                  const dr = doc.documentos_requeridos
                  const cfg = estadoConfig[doc.estado] ?? estadoConfig.PENDIENTE
                  const estaSubiendo = subiendo === doc.id
                  const subioBien = uploadOk === doc.id

                  return (
                    <div key={doc.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-zinc-500 text-xs font-mono shrink-0">{dr?.codigo}</span>
                            <span className="text-sm text-white truncate">{dr?.nombre}</span>
                            {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                            {doc.observaciones && (
                              <span className="text-orange-400 text-xs">⚠ {doc.observaciones}</span>
                            )}
                            {subioBien && (
                              <span className="text-green-400 text-xs">✓ Subido correctamente</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Estado badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            cfg.color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            cfg.color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            cfg.color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            cfg.color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                          }`}>
                            {cfg.label}
                          </span>

                          {/* Ver archivo si ya existe */}
                          {doc.archivo_url && doc.estado !== 'RECHAZADO' && (
                            <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-zinc-300 transition-colors">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          )}

                          {/* Botón subir — solo si no está aprobado */}
                          {doc.estado !== 'APROBADO' && (
                            <label className={`cursor-pointer ${estaSubiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUpload(doc.id, file)
                                }}
                              />
                              <span className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all inline-block">
                                {estaSubiendo ? 'Subiendo...' : doc.estado === 'RECHAZADO' ? 'Resubir' : 'Subir'}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => { setProveedor(null); setCuit(''); setDocs([]) }}
              className="mt-4 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
            >
              ← Buscar otro CUIT
            </button>
          </div>
        )}

      </div>
    </div>
  )
}