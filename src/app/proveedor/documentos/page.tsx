'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { QRCodeSVG } from 'qrcode.react'

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

type Habilitacion = {
  id: string
  qr_token: string
  estado: string
  fecha_venc: string | null
}

export default function PortalDocumentosPage() {
  const [cuit, setCuit] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [proveedor, setProveedor] = useState<any>(null)
  const [docs, setDocs] = useState<DocLegajo[]>([])
  const [habilitacion, setHabilitacion] = useState<Habilitacion | null>(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [vistaActual, setVistaActual] = useState<'docs' | 'qr'>('docs')
  // fecha_venc por doc_id — el proveedor la ingresa antes de subir
  const [fechas, setFechas] = useState<Record<string, string>>({})

  async function buscarProveedor(e: React.FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setError('')
    setProveedor(null)
    setDocs([])
    setHabilitacion(null)

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

    const { data: docsData } = await supabase
      .from('documentos_legajo')
      .select(`id, estado, fecha_venc, archivo_url, observaciones,
        documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)`)
      .eq('proveedor_id', data.id)

    setDocs((docsData as unknown as DocLegajo[]) ?? [])

    const { data: habData } = await supabase
      .from('habilitaciones')
      .select('id, qr_token, estado, fecha_venc')
      .eq('proveedor_id', data.id)
      .eq('estado', 'VIGENTE')
      .single()

    if (habData) setHabilitacion(habData)
    setBuscando(false)
  }

  async function handleUpload(docId: string, file: File) {
    const dr = docs.find(d => d.id === docId)?.documentos_requeridos
    const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'

    if (necesitaFecha && !fechas[docId]) {
      setError(`Ingresá la fecha de vencimiento del documento "${dr?.nombre}" antes de subir.`)
      return
    }

    setSubiendo(docId)
    setUploadOk(null)
    setError('')

    try {
      const ext = file.name.split('.').pop()
      const path = `${proveedor.id}/${docId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, file, { upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = await supabase.storage
        .from('documentos')
        .createSignedUrl(path, 60 * 60 * 24 * 365)

      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('')

      await supabase
        .from('documentos_legajo')
        .update({
          archivo_url: urlData?.signedUrl ?? path,
          hash_sha256: hash,
          estado: 'CARGADO',
          fecha_venc: fechas[docId] || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId)

      setDocs(prev => prev.map(d => d.id === docId
        ? { ...d, estado: 'CARGADO', archivo_url: urlData?.signedUrl ?? path, fecha_venc: fechas[docId] || null }
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
    PENDIENTE: { label: 'Pendiente', color: 'zinc'   },
    CARGADO:   { label: 'Cargado',   color: 'blue'   },
    APROBADO:  { label: 'Aprobado',  color: 'green'  },
    RECHAZADO: { label: 'Rechazado', color: 'red'    },
    VENCIDO:   { label: 'Vencido',   color: 'orange' },
  }

  const estadoProvConfig: Record<string, { label: string; color: string }> = {
    PENDIENTE:   { label: 'Pendiente de revisión', color: 'yellow' },
    EN_REVISION: { label: 'En revisión',           color: 'blue'   },
    APROBADO:    { label: 'Aprobado',              color: 'green'  },
    RECHAZADO:   { label: 'Requiere correcciones', color: 'red'    },
    SUSPENDIDO:  { label: 'Suspendido',            color: 'zinc'   },
  }

  const qrUrl = habilitacion
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${habilitacion.qr_token}`
    : ''

  if (!proveedor) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
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
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
            <h1 className="text-white font-medium text-xl mb-2">Cargá tu documentación</h1>
            <p className="text-zinc-500 text-sm mb-6">Ingresá tu CUIT para acceder a tu legajo.</p>
            <form onSubmit={buscarProveedor} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT</label>
                <input value={cuit} onChange={e => setCuit(e.target.value)} required placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
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
        </div>
      </div>
    )
  }

  const cfg = estadoProvConfig[proveedor.estado] ?? estadoProvConfig.PENDIENTE

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="font-medium text-sm">Sistema Legajos</span>
          </div>
          <button onClick={() => { setProveedor(null); setCuit(''); setDocs([]) }}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Cerrar sesión →</button>
        </div>

        {/* Info proveedor */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-medium">{proveedor.razon_social}</h2>
              <p className="text-zinc-500 text-sm">CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${
              cfg.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
              cfg.color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              cfg.color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              cfg.color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
            }`}>{cfg.label}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500 text-xs">Documentación</span>
            <span className="text-zinc-400 text-xs">{docs.filter(d => ['CARGADO','APROBADO'].includes(d.estado)).length}/{docs.length}</span>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${docs.length > 0 ? (docs.filter(d => ['CARGADO','APROBADO'].includes(d.estado)).length / docs.length) * 100 : 0}%` }}/>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setVistaActual('docs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${vistaActual === 'docs' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            Mis documentos
          </button>
          {habilitacion && (
            <button onClick={() => setVistaActual('qr')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${vistaActual === 'qr' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              Mi carnet QR
            </button>
          )}
        </div>

        {/* Vista documentos */}
        {vistaActual === 'docs' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-medium">Documentos requeridos</h3>
              <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máximo 10MB · Ingresá la fecha de vencimiento antes de subir</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {docs.map(doc => {
                const dr = doc.documentos_requeridos
                const dcfg = estadoConfig[doc.estado] ?? estadoConfig.PENDIENTE
                const estaSubiendo = subiendo === doc.id
                const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'
                const puedeSubir = doc.estado !== 'APROBADO'

                return (
                  <div key={doc.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-zinc-500 text-xs font-mono shrink-0">{dr?.codigo}</span>
                          <span className="text-sm text-white truncate">{dr?.nombre}</span>
                          {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                          {doc.fecha_venc && (
                            <span className="text-zinc-500 text-xs">
                              Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}
                            </span>
                          )}
                          {doc.observaciones && <span className="text-orange-400 text-xs">⚠ {doc.observaciones}</span>}
                          {uploadOk === doc.id && <span className="text-green-400 text-xs">✓ Subido correctamente</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          dcfg.color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          dcfg.color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          dcfg.color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          dcfg.color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                        }`}>{dcfg.label}</span>
                        {doc.archivo_url && (
                          <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Fecha de vencimiento + botón subir */}
                    {puedeSubir && (
                      <div className="flex items-center gap-2 mt-2">
                        {necesitaFecha && (
                          <div className="flex items-center gap-2 flex-1">
                            <label className="text-zinc-500 text-xs shrink-0">Fecha venc.:</label>
                            <input
                              type="date"
                              value={fechas[doc.id] || doc.fecha_venc || ''}
                              onChange={e => setFechas(f => ({ ...f, [doc.id]: e.target.value }))}
                              min={new Date().toISOString().split('T')[0]}
                              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-blue-500/60 transition-all"
                            />
                          </div>
                        )}
                        <label className={`cursor-pointer ${estaSubiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(doc.id, f) }}/>
                          <span className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all inline-block">
                            {estaSubiendo ? 'Subiendo...' : doc.estado === 'RECHAZADO' ? 'Resubir' : 'Subir archivo'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Vista QR */}
        {vistaActual === 'qr' && habilitacion && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
            <h3 className="text-sm font-medium mb-1">Carnet de acceso</h3>
            <p className="text-zinc-500 text-xs mb-6">Presentá este QR en el punto de ingreso</p>
            <div className="bg-white rounded-2xl p-6 inline-block mb-6">
              <QRCodeSVG value={qrUrl} size={200} level="H" includeMargin={false}/>
            </div>
            <div className="space-y-2 mb-6">
              <p className="text-white font-medium">{proveedor.razon_social}</p>
              <p className="text-zinc-500 text-sm">CUIT {proveedor.cuit}</p>
              {habilitacion.fecha_venc && (
                <p className="text-zinc-500 text-sm">
                  Válido hasta <span className="text-zinc-300">
                    {new Date(habilitacion.fecha_venc).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </p>
              )}
            </div>
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-sm px-4 py-1.5 rounded-full">✓ Habilitado</span>
            <div className="mt-6">
              <p className="text-zinc-600 text-xs mb-2">Link de verificación</p>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                <p className="text-zinc-500 text-xs font-mono truncate">{qrUrl}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}