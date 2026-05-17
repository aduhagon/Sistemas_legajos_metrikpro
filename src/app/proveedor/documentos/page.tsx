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

type Evaluacion = {
  id: string
  tipo: string
  resultado: string
  observaciones: string | null
  created_at: string
}

type RegistroAcceso = {
  id: string
  tipo: string
  created_at: string
  lat: number | null
  lng: number | null
}

type Vista = 'docs' | 'qr' | 'historial' | 'perfil'

export default function PortalDocumentosPage() {
  const [cuit, setCuit] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [proveedor, setProveedor] = useState<any>(null)
  const [docs, setDocs] = useState<DocLegajo[]>([])
  const [habilitacion, setHabilitacion] = useState<Habilitacion | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [accesos, setAccesos] = useState<RegistroAcceso[]>([])
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('docs')
  const [fechas, setFechas] = useState<Record<string, string>>({})

  // Perfil editable
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [perfilForm, setPerfilForm] = useState({ email: '', telefono: '' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  async function buscarProveedor(e: React.FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setError('')
    setProveedor(null)
    setDocs([])
    setHabilitacion(null)
    setEvaluaciones([])
    setAccesos([])

    const cuitLimpio = cuit.replace(/[-\s]/g, '')

    const { data, error: err } = await supabase
      .from('proveedores')
      .select('id, razon_social, cuit, estado, email, telefono, notif_vencimientos, rubros(nombre), created_at')
      .eq('cuit', cuitLimpio)
      .single()

    if (err || !data) {
      setError('No se encontró ningún proveedor con ese CUIT. ¿Ya te registraste?')
      setBuscando(false)
      return
    }

    setProveedor(data)
    setPerfilForm({ email: data.email, telefono: data.telefono ?? '' })

    // Documentos
    const { data: docsData } = await supabase
      .from('documentos_legajo')
      .select('id, estado, fecha_venc, archivo_url, observaciones, documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)')
      .eq('proveedor_id', data.id)
    setDocs((docsData as unknown as DocLegajo[]) ?? [])

    // Habilitación
    const { data: habData } = await supabase
      .from('habilitaciones')
      .select('id, qr_token, estado, fecha_venc')
      .eq('proveedor_id', data.id)
      .eq('estado', 'VIGENTE')
      .single()
    if (habData) setHabilitacion(habData)

    // Evaluaciones
    const { data: evalData } = await supabase
      .from('evaluaciones')
      .select('id, tipo, resultado, observaciones, created_at')
      .eq('proveedor_id', data.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setEvaluaciones((evalData as Evaluacion[]) ?? [])

    // Accesos — buscar por habilitación
    if (habData) {
      const { data: accData } = await supabase
        .from('registros_acceso')
        .select('id, tipo, created_at, lat, lng')
        .eq('habilitacion_id', habData.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setAccesos((accData as RegistroAcceso[]) ?? [])
    }

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
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 60 * 24 * 365)
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

      // Usar función con trazabilidad completa
      const { error: rpcError } = await supabase.rpc('registrar_presentacion_documento', {
        p_doc_id:      docId,
        p_archivo_url: urlData?.signedUrl ?? path,
        p_hash_sha256: hash,
        p_fecha_venc:  fechas[docId] || null,
      })
      if (rpcError) throw new Error(rpcError.message)
      setDocs(prev => prev.map(d => d.id === docId
        ? { ...d, estado: 'CARGADO', archivo_url: urlData?.signedUrl ?? path, fecha_venc: fechas[docId] || null }
        : d))
      setUploadOk(docId)
    } catch (err: any) {
      setError(`Error al subir: ${err.message}`)
    } finally {
      setSubiendo(null)
    }
  }

  async function guardarPerfil() {
    setGuardandoPerfil(true)
    await supabase.from('proveedores').update({
      email: perfilForm.email,
      telefono: perfilForm.telefono || null,
      updated_at: new Date().toISOString(),
    }).eq('id', proveedor.id)
    setProveedor((p: any) => ({ ...p, email: perfilForm.email, telefono: perfilForm.telefono }))
    setGuardandoPerfil(false)
    setEditandoPerfil(false)
  }

  async function toggleNotif() {
    const nuevo = !proveedor.notif_vencimientos
    await supabase.from('proveedores').update({ notif_vencimientos: nuevo }).eq('id', proveedor.id)
    setProveedor((p: any) => ({ ...p, notif_vencimientos: nuevo }))
  }

  const estadoDocCfg: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: 'Pendiente', color: 'zinc'   },
    CARGADO:   { label: 'Cargado',   color: 'blue'   },
    APROBADO:  { label: 'Aprobado',  color: 'green'  },
    RECHAZADO: { label: 'Rechazado', color: 'red'    },
    VENCIDO:   { label: 'Vencido',   color: 'orange' },
  }

  const estadoProvCfg: Record<string, { label: string; color: string }> = {
    PENDIENTE:   { label: 'Pendiente de revisión', color: 'yellow' },
    EN_REVISION: { label: 'En revisión',           color: 'blue'   },
    APROBADO:    { label: 'Aprobado',              color: 'green'  },
    RECHAZADO:   { label: 'Requiere correcciones', color: 'red'    },
    SUSPENDIDO:  { label: 'Suspendido',            color: 'zinc'   },
  }

  const qrUrl = habilitacion
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${habilitacion.qr_token}`
    : ''

  const colorClass = (color: string) =>
    color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
    color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
    'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'

  // Pantalla de búsqueda
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
            <p className="text-zinc-500 text-sm">Portal del proveedor</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
            <h1 className="text-white font-medium text-xl mb-2">Accedé a tu legajo</h1>
            <p className="text-zinc-500 text-sm mb-6">Ingresá tu CUIT para ver tu documentación, carnet QR e historial.</p>
            <form onSubmit={buscarProveedor} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT</label>
                <input value={cuit} onChange={e => setCuit(e.target.value)} required placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
              <button type="submit" disabled={buscando}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                {buscando ? 'Buscando...' : 'Ingresar'}
              </button>
            </form>
            <p className="text-center text-zinc-600 text-xs mt-6">
              ¿Aún no te registraste?{' '}
              <a href="/registro" className="text-blue-400 hover:text-blue-300 transition-colors">Registrá tu empresa</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const cfg = estadoProvCfg[proveedor.estado] ?? estadoProvCfg.PENDIENTE
  const docsCompletos = docs.filter(d => ['CARGADO', 'APROBADO'].includes(d.estado)).length

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* Navbar del proveedor */}
      <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs hidden sm:inline">{proveedor.razon_social}</span>
            <button onClick={() => { setProveedor(null); setCuit(''); setDocs([]) }}
              className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Card resumen */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-white font-medium text-lg">{proveedor.razon_social}</h2>
              <p className="text-zinc-500 text-sm">CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${colorClass(cfg.color)}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-xs">Documentación completada</span>
            <span className="text-zinc-400 text-xs">{docsCompletos}/{docs.length}</span>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${docs.length > 0 ? (docsCompletos / docs.length) * 100 : 0}%` }}/>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {([
            { key: 'docs',     label: 'Documentos' },
            { key: 'qr',       label: 'Carnet QR',  hidden: !habilitacion },
            { key: 'historial',label: 'Historial' },
            { key: 'perfil',   label: 'Mi perfil' },
          ] as { key: Vista; label: string; hidden?: boolean }[])
            .filter(t => !t.hidden)
            .map(tab => (
              <button key={tab.key} onClick={() => setVista(tab.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  vista === tab.key ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {tab.label}
              </button>
            ))
          }
        </div>

        {/* ── VISTA: DOCUMENTOS ── */}
        {vista === 'docs' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-medium">Documentos requeridos</h3>
              <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máx. 10MB · Ingresá la fecha antes de subir</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {docs.map(doc => {
                const dr = doc.documentos_requeridos
                const dcfg = estadoDocCfg[doc.estado] ?? estadoDocCfg.PENDIENTE
                const estaSubiendo = subiendo === doc.id
                const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'
                return (
                  <div key={doc.id} className="px-5 py-4">
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
                            <span className="text-zinc-500 text-xs">Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>
                          )}
                          {doc.observaciones && <span className="text-orange-400 text-xs">⚠ {doc.observaciones}</span>}
                          {uploadOk === doc.id && <span className="text-green-400 text-xs">✓ Subido</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass(dcfg.color)}`}>{dcfg.label}</span>
                        {doc.archivo_url && (
                          <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                    {doc.estado !== 'APROBADO' && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {necesitaFecha && (
                          <div className="flex items-center gap-2">
                            <label className="text-zinc-500 text-xs shrink-0">Fecha venc.:</label>
                            <input type="date" value={fechas[doc.id] || doc.fecha_venc || ''}
                              onChange={e => setFechas(f => ({ ...f, [doc.id]: e.target.value }))}
                              min={new Date().toISOString().split('T')[0]}
                              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-blue-500/60 transition-all"/>
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

        {/* ── VISTA: QR ── */}
        {vista === 'qr' && habilitacion && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
            <h3 className="text-sm font-medium mb-1">Carnet de acceso</h3>
            <p className="text-zinc-500 text-xs mb-6">Presentá este QR en el punto de ingreso</p>
            <div className="bg-white rounded-2xl p-6 inline-block mb-6">
              <QRCodeSVG value={qrUrl} size={200} level="H" includeMargin={false}/>
            </div>
            <div className="space-y-1 mb-5">
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
            <div className="mt-5 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
              <p className="text-zinc-600 text-xs mb-1">Link de verificación</p>
              <p className="text-zinc-500 text-xs font-mono truncate">{qrUrl}</p>
            </div>
          </div>
        )}

        {/* ── VISTA: HISTORIAL ── */}
        {vista === 'historial' && (
          <div className="space-y-4">
            {/* Accesos */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium">Registros de acceso</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Últimos 20 ingresos y egresos</p>
              </div>
              {accesos.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-zinc-600 text-sm">Sin registros de acceso todavía</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {accesos.map(acc => (
                    <div key={acc.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          acc.tipo === 'INGRESO' ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke={acc.tipo === 'INGRESO' ? '#22c55e' : '#ef4444'} strokeWidth="2.5">
                            {acc.tipo === 'INGRESO'
                              ? <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>
                              : <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>
                            }
                          </svg>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${acc.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                            {acc.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                          </p>
                          <p className="text-zinc-600 text-xs">
                            {new Date(acc.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      {acc.lat && acc.lng && (
                        <a href={`https://maps.google.com/?q=${acc.lat},${acc.lng}`} target="_blank" rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          Ver mapa
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evaluaciones */}
            {evaluaciones.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Historial de evaluaciones</h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {evaluaciones.map(ev => (
                    <div key={ev.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            ev.resultado === 'APROBADO' ? colorClass('green') :
                            ev.resultado === 'RECHAZADO' ? colorClass('red') :
                            colorClass('yellow')
                          }`}>{ev.resultado.toLowerCase().replace('_', ' ')}</span>
                          <span className="text-zinc-600 text-xs">{ev.tipo}</span>
                        </div>
                        <span className="text-zinc-600 text-xs">
                          {new Date(ev.created_at).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      {ev.observaciones && (
                        <p className="text-zinc-500 text-xs italic">"{ev.observaciones}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VISTA: PERFIL ── */}
        {vista === 'perfil' && (
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Datos de contacto</h3>
                {!editandoPerfil && (
                  <button onClick={() => setEditandoPerfil(true)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar
                  </button>
                )}
              </div>

              {editandoPerfil ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1.5">Email</label>
                    <input type="email" value={perfilForm.email}
                      onChange={e => setPerfilForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1.5">Teléfono</label>
                    <input value={perfilForm.telefono}
                      onChange={e => setPerfilForm(f => ({ ...f, telefono: e.target.value }))}
                      placeholder="+54 9 11 1234-5678"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={guardarPerfil} disabled={guardandoPerfil}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors">
                      {guardandoPerfil ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => { setEditandoPerfil(false); setPerfilForm({ email: proveedor.email, telefono: proveedor.telefono ?? '' }) }}
                      className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors px-3 py-2">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Email</span>
                    <span className="text-white text-sm">{proveedor.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Teléfono</span>
                    <span className="text-white text-sm">{proveedor.telefono ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">CUIT</span>
                    <span className="text-white text-sm font-mono">{proveedor.cuit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Rubro</span>
                    <span className="text-white text-sm">{(proveedor.rubros as any)?.nombre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Registrado</span>
                    <span className="text-white text-sm">
                      {new Date(proveedor.created_at).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notificaciones */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-sm font-medium mb-4">Notificaciones</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Alertas de vencimiento</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Recibir email 7 días antes de que venza un documento</p>
                </div>
                <button onClick={toggleNotif}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${proveedor.notif_vencimientos ? 'bg-blue-600' : 'bg-white/[0.1]'}`}
                  style={{ height: '22px', width: '40px' }}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${proveedor.notif_vencimientos ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                </button>
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
