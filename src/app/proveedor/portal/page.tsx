'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

type Vista = 'qr' | 'docs' | 'operarios' | 'historial' | 'perfil'

export default function ProveedorPortalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [miRol, setMiRol] = useState<'titular' | 'operario' | null>(null)
  const [proveedor, setProveedor] = useState<any>(null)
  const [habilitacion, setHabilitacion] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [operarios, setOperarios] = useState<any[]>([])
  const [accesos, setAccesos] = useState<any[]>([])
  const [vista, setVista] = useState<Vista>('qr')
  const [fechas, setFechas] = useState<Record<string, string>>({})
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Operarios
  const [nuevoOperario, setNuevoOperario] = useState({ email: '', nombre: '' })
  const [agregandoOp, setAgregandoOp] = useState(false)
  const [loadingOp, setLoadingOp] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/proveedor/login'); return }

    // Si viene del callback de confirmación de email, completar el registro
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevo') === '1') {
      try {
        await supabase.rpc('completar_registro_proveedor', { p_user_id: user.id })
      } catch (e) {
        console.error('Error completando registro:', e)
      }
    }

    const { data: miProv } = await supabase.rpc('get_mi_proveedor')
    if (!miProv) { router.push('/proveedor/login'); return }

    setMiRol(miProv.rol)

    const { data: provData } = await supabase
      .from('proveedores')
      .select('id, razon_social, cuit, estado, email, telefono, notif_vencimientos, rubros(nombre), created_at')
      .eq('id', miProv.proveedor_id)
      .single()

    if (!provData) { router.push('/proveedor/login'); return }
    setProveedor(provData)

    // Si es operario solo carga el QR
    if (miProv.rol === 'operario') {
      const { data: habData } = await supabase
        .from('habilitaciones').select('id, qr_token, estado, fecha_venc')
        .eq('proveedor_id', miProv.proveedor_id).eq('estado', 'VIGENTE').single()
      if (habData) setHabilitacion(habData)
      setLoading(false)
      return
    }

    // Titular — carga todo
    const [
      { data: habData },
      { data: docsData },
      { data: opData },
    ] = await Promise.all([
      supabase.from('habilitaciones').select('id, qr_token, estado, fecha_venc')
        .eq('proveedor_id', miProv.proveedor_id).eq('estado', 'VIGENTE').single(),
      supabase.from('documentos_legajo')
        .select('id, estado, fecha_venc, archivo_url, observaciones, documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)')
        .eq('proveedor_id', miProv.proveedor_id),
      supabase.from('proveedores_usuarios')
        .select('id, rol, nombre, activo, user_id')
        .eq('proveedor_id', miProv.proveedor_id),
    ])

    if (habData) {
      setHabilitacion(habData)
      setVista(provData.estado === 'APROBADO' ? 'qr' : 'docs')
      const { data: accData } = await supabase.from('registros_acceso')
        .select('id, tipo, created_at, lat, lng')
        .eq('habilitacion_id', habData.id)
        .order('created_at', { ascending: false }).limit(20)
      setAccesos(accData ?? [])
    } else {
      setVista('docs')
    }

    setDocs(docsData ?? [])
    setOperarios(opData ?? [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/proveedor/login')
  }

  async function handleUpload(docId: string, file: File) {
    const dr = docs.find(d => d.id === docId)?.documentos_requeridos
    const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'
    if (necesitaFecha && !fechas[docId]) {
      setError(`Ingresá la fecha de vencimiento de "${dr?.nombre}" antes de subir.`)
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
      const { error: rpcError } = await supabase.rpc('registrar_presentacion_documento', {
        p_doc_id: docId, p_archivo_url: urlData?.signedUrl ?? path,
        p_hash_sha256: hash, p_fecha_venc: fechas[docId] || null,
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

  async function invitarOperario(e: React.FormEvent) {
    e.preventDefault()
    setLoadingOp(true)
    setError('')

    // Crear cuenta en Supabase Auth para el operario
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoOperario.email,
      password: Math.random().toString(36).slice(-10) + 'Aa1!', // password temporal
      options: { data: { nombre: nuevoOperario.nombre } }
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Error al crear la cuenta del operario')
      setLoadingOp(false)
      return
    }

    // Vincular como operario
    const { error: vinErr } = await supabase.from('proveedores_usuarios').insert({
      proveedor_id: proveedor.id,
      user_id: authData.user.id,
      rol: 'operario',
      nombre: nuevoOperario.nombre,
    })

    if (vinErr) {
      setError('Error al agregar el operario')
      setLoadingOp(false)
      return
    }

    setOperarios(prev => [...prev, { id: authData.user!.id, rol: 'operario', nombre: nuevoOperario.nombre, activo: true }])
    setNuevoOperario({ email: '', nombre: '' })
    setAgregandoOp(false)
    setLoadingOp(false)
  }

  async function toggleOperario(opId: string, activo: boolean) {
    await supabase.from('proveedores_usuarios').update({ activo: !activo }).eq('id', opId)
    setOperarios(prev => prev.map(o => o.id === opId ? { ...o, activo: !activo } : o))
  }

  const qrUrl = habilitacion
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${habilitacion.qr_token}`
    : ''

  const estadoDocCfg: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: 'Pendiente', color: 'zinc'   },
    CARGADO:   { label: 'Cargado',   color: 'blue'   },
    APROBADO:  { label: 'Aprobado',  color: 'green'  },
    RECHAZADO: { label: 'Rechazado', color: 'red'    },
    VENCIDO:   { label: 'Vencido',   color: 'orange' },
  }

  const colorClass = (color: string) =>
    color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
    color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
    'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Cargando...</div>
    </div>
  )

  // ── VISTA OPERARIO — solo QR ──
  if (miRol === 'operario') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
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
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Salir
            </button>
          </div>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {habilitacion ? (
            <>
              <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-sm px-3 py-1 rounded-full mb-6">✓ Habilitado</span>
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-2xl">
                <QRCodeSVG value={qrUrl} size={240} level="H" includeMargin={false}/>
              </div>
              <h2 className="text-white font-semibold text-xl text-center">{proveedor?.razon_social}</h2>
              <p className="text-zinc-500 text-sm mt-1">Mostrá este QR al operador de acceso</p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-zinc-400 text-lg mb-2">Sin habilitación vigente</p>
              <p className="text-zinc-600 text-sm">Contactá al titular de la empresa para más información</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── VISTA TITULAR — completa ──
  const docsConProblemas = docs.filter(d => ['RECHAZADO', 'VENCIDO'].includes(d.estado)).length
  const docsCompletos = docs.filter(d => ['CARGADO', 'APROBADO'].includes(d.estado)).length

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
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
            <span className="text-zinc-500 text-xs hidden sm:inline truncate max-w-32">{proveedor?.razon_social}</span>
            <button onClick={handleLogout}
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

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── QR Principal ── */}
        {vista === 'qr' && habilitacion && (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6">
              <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-sm px-3 py-1 rounded-full">✓ Habilitado</span>
              {habilitacion.fecha_venc && (
                <span className="text-zinc-500 text-xs">hasta {new Date(habilitacion.fecha_venc).toLocaleDateString('es-AR')}</span>
              )}
            </div>
            <div className="bg-white rounded-3xl p-6 mb-6 shadow-2xl">
              <QRCodeSVG value={qrUrl} size={240} level="H" includeMargin={false}/>
            </div>
            <h2 className="text-white font-semibold text-xl">{proveedor?.razon_social}</h2>
            <p className="text-zinc-500 text-sm mt-1">CUIT {proveedor?.cuit} · {(proveedor?.rubros as any)?.nombre}</p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 w-full text-center mt-6 mb-6">
              <p className="text-zinc-400 text-sm">Mostrá este código al operador para registrar tu ingreso o egreso</p>
            </div>
            <div className="flex gap-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              {[
                { key: 'docs',      label: `Documentos${docsConProblemas > 0 ? ' ⚠' : ''}` },
                { key: 'operarios', label: `Equipo (${operarios.length})` },
                { key: 'historial', label: 'Historial' },
                { key: 'perfil',    label: 'Perfil' },
              ].map((t: any) => (
                <button key={t.key} onClick={() => setVista(t.key as Vista)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-all">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Vistas secundarias ── */}
        {vista !== 'qr' && (
          <>
            {/* Card resumen */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-white font-medium">{proveedor?.razon_social}</h2>
                  <p className="text-zinc-500 text-sm">CUIT {proveedor?.cuit}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${
                  proveedor?.estado === 'APROBADO' ? colorClass('green') :
                  proveedor?.estado === 'EN_REVISION' ? colorClass('blue') :
                  proveedor?.estado === 'RECHAZADO' ? colorClass('red') :
                  colorClass('yellow')
                }`}>{proveedor?.estado}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-500 text-xs">Documentación</span>
                <span className="text-zinc-400 text-xs">{docsCompletos}/{docs.length}</span>
              </div>
              <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${docs.length > 0 ? (docsCompletos / docs.length) * 100 : 0}%` }}/>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              {habilitacion && (
                <button onClick={() => setVista('qr')}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 transition-all">
                  ← Mi QR
                </button>
              )}
              {[
                { key: 'docs',      label: 'Documentos' },
                { key: 'operarios', label: 'Equipo' },
                { key: 'historial', label: 'Historial' },
                { key: 'perfil',    label: 'Perfil' },
              ].map((t: any) => (
                <button key={t.key} onClick={() => setVista(t.key as Vista)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${vista === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── DOCUMENTOS ── */}
            {vista === 'docs' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Documentos requeridos</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG · Ingresá la fecha antes de subir</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {docs.map((doc: any) => {
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
                              {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                              {doc.fecha_venc && <span className="text-zinc-500 text-xs">Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>}
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
                                <label className="text-zinc-500 text-xs">Fecha venc.:</label>
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

            {/* ── OPERARIOS ── */}
            {vista === 'operarios' && (
              <div className="space-y-3">
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Equipo con acceso al QR</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">Los operarios solo pueden ver el carnet QR</p>
                    </div>
                    <button onClick={() => setAgregandoOp(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Agregar
                    </button>
                  </div>

                  {/* Form nuevo operario */}
                  {agregandoOp && (
                    <div className="px-5 py-4 border-b border-white/[0.06] bg-blue-500/5">
                      <form onSubmit={invitarOperario} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-zinc-400 text-xs mb-1">Nombre</label>
                            <input value={nuevoOperario.nombre}
                              onChange={e => setNuevoOperario(o => ({ ...o, nombre: e.target.value }))}
                              required placeholder="Juan García"
                              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                          </div>
                          <div>
                            <label className="block text-zinc-400 text-xs mb-1">Email</label>
                            <input type="email" value={nuevoOperario.email}
                              onChange={e => setNuevoOperario(o => ({ ...o, email: e.target.value }))}
                              required placeholder="juan@email.com"
                              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                          </div>
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <div className="flex gap-2">
                          <button type="submit" disabled={loadingOp}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg transition-colors">
                            {loadingOp ? 'Agregando...' : 'Agregar operario'}
                          </button>
                          <button type="button" onClick={() => { setAgregandoOp(false); setError('') }}
                            className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors px-3">
                            Cancelar
                          </button>
                        </div>
                        <p className="text-zinc-600 text-xs">El operario recibirá un email para activar su cuenta y configurar su contraseña</p>
                      </form>
                    </div>
                  )}

                  <div className="divide-y divide-white/[0.04]">
                    {operarios.map((op: any) => (
                      <div key={op.id} className={`px-5 py-3 flex items-center justify-between ${!op.activo ? 'opacity-50' : ''}`}>
                        <div>
                          <p className="text-white text-sm">{op.nombre ?? 'Sin nombre'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${op.rol === 'titular' ? colorClass('blue') : colorClass('zinc')}`}>
                            {op.rol === 'titular' ? 'Titular' : 'Operario'}
                          </span>
                        </div>
                        {op.rol !== 'titular' && (
                          <button onClick={() => toggleOperario(op.id, op.activo)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              op.activo
                                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                            }`}>
                            {op.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        )}
                      </div>
                    ))}
                    {operarios.length === 0 && (
                      <div className="px-5 py-6 text-center">
                        <p className="text-zinc-600 text-sm">Sin operarios agregados todavía</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── HISTORIAL ── */}
            {vista === 'historial' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Registros de acceso</h3>
                </div>
                {accesos.length === 0 ? (
                  <div className="px-5 py-8 text-center"><p className="text-zinc-600 text-sm">Sin registros todavía</p></div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {accesos.map((acc: any) => (
                      <div key={acc.id} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${acc.tipo === 'INGRESO' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
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
                            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PERFIL ── */}
            {vista === 'perfil' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-sm font-medium mb-4">Datos de la empresa</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Razón social', value: proveedor?.razon_social },
                    { label: 'CUIT', value: proveedor?.cuit },
                    { label: 'Email', value: proveedor?.email },
                    { label: 'Teléfono', value: proveedor?.telefono ?? '—' },
                    { label: 'Rubro', value: (proveedor?.rubros as any)?.nombre },
                    { label: 'Registrado', value: proveedor ? new Date(proveedor.created_at).toLocaleDateString('es-AR') : '' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-zinc-500 text-sm">{label}</span>
                      <span className="text-white text-sm">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
