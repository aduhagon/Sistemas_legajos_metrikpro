'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'
import { QRCodeSVG } from 'qrcode.react'

// 'historial' = historial de documentos (aprobaciones, rechazos, cargas)
// 'accesos'   = registros de ingreso/egreso GPS
type Vista = 'qr' | 'docs' | 'equipos' | 'operarios' | 'historial' | 'accesos' | 'perfil'

type Props = {
  proveedor: any
  docs: any[]
  habilitacion: any
  operarios: any[]
  accesos: any[]
  historialPorDoc: Record<string, any[]>
  miRol: 'titular' | 'operario'
  equiposSlot?: React.ReactNode
}

const TAB_ICONS: Record<string, string> = {
  docs:      '📄',
  equipos:   '🚗',
  historial: '🕐',
  operarios: '👥',
  accesos:   '📍',
  perfil:    '👤',
}

export default function PortalClient({
  proveedor: provInit,
  docs: docsInit,
  habilitacion,
  operarios: opsInit,
  accesos,
  historialPorDoc,
  miRol,
  equiposSlot,
}: Props) {
  const [proveedor] = useState(provInit)
  const [docs, setDocs] = useState(docsInit)
  const [operarios, setOperarios] = useState(opsInit)
  const [vista, setVista] = useState<Vista>(
    habilitacion && proveedor?.estado === 'APROBADO' ? 'qr' : 'docs'
  )
  const [fechas, setFechas] = useState<Record<string, string>>({})
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [nuevoOperario, setNuevoOperario] = useState({ nombre: '', cuil: '', email: '' })
  const [agregandoOp, setAgregandoOp] = useState(false)
  const [loadingOp, setLoadingOp] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/proveedor/login'
  }

  async function handleUpload(docId: string, file: File) {
    const dr = docs.find((d: any) => d.id === docId)?.documentos_requeridos
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
      setDocs(prev => prev.map((d: any) => d.id === docId
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
    const { data: result, error: rpcErr } = await supabase.rpc('invitar_operario', {
      p_proveedor_id: proveedor.id,
      p_email: nuevoOperario.email,
      p_nombre: nuevoOperario.nombre,
      p_cuil: nuevoOperario.cuil || null,
    })
    if (rpcErr || result?.error) {
      setError(result?.error ?? rpcErr?.message ?? 'Error al agregar operario')
      setLoadingOp(false)
      return
    }
    await supabase.auth.resetPasswordForEmail(nuevoOperario.email, {
      redirectTo: `${window.location.origin}/auth/proveedor-callback?type=recovery`,
    })
    setOperarios(prev => [...prev, {
      id: result.user_id, rol: 'operario',
      nombre: nuevoOperario.nombre, cuil: nuevoOperario.cuil,
      activo: true, user_id: result.user_id,
    }])
    setNuevoOperario({ nombre: '', cuil: '', email: '' })
    setAgregandoOp(false)
    setLoadingOp(false)
  }

  async function toggleOperario(opId: string, activo: boolean) {
    await supabase.from('proveedores_usuarios').update({ activo: !activo }).eq('id', opId)
    setOperarios(prev => prev.map((o: any) => o.id === opId ? { ...o, activo: !activo } : o))
  }

  async function eliminarOperario(opId: string, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre}? Esto borra la cuenta y libera el email para volver a usar.`)) return
    const { data: result, error: rpcErr } = await supabase.rpc('eliminar_operario', {
      p_proveedor_id: proveedor.id,
      p_operario_id: opId,
    })
    if (rpcErr || result?.error) {
      setError(result?.error ?? rpcErr?.message ?? 'Error al eliminar')
      return
    }
    setOperarios(prev => prev.filter((o: any) => o.id !== opId))
  }

  async function handleImportar(file: File) {
    setImportando(true)
    setError('')
    setResultadoImport(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const normalizar = (s: string) => s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const operariosData = rows.map((row: any) => {
        const keys = Object.keys(row)
        const findKey = (variants: string[]) => keys.find(k => variants.includes(normalizar(k))) ?? ''
        return {
          nombre: (row[findKey(['nombre', 'name'])] || '').toString().trim(),
          cuil: (row[findKey(['cuil'])] || '').toString().trim(),
          email: (row[findKey(['email', 'mail', 'correo'])] || '').toString().trim(),
        }
      }).filter(op => op.email && op.nombre)
      if (operariosData.length === 0) {
        setError('No se encontraron filas con Nombre y Email.')
        setImportando(false)
        return
      }
      const { data: result, error: rpcErr } = await supabase.rpc('importar_operarios_masivo', {
        p_proveedor_id: proveedor.id,
        p_operarios: operariosData,
      })
      if (rpcErr || result?.error) {
        setError(result?.error ?? rpcErr?.message ?? 'Error al importar')
        setImportando(false)
        return
      }
      for (const op of operariosData) {
        await supabase.auth.resetPasswordForEmail(op.email, {
          redirectTo: `${window.location.origin}/auth/proveedor-callback?type=recovery`,
        }).catch(() => {})
      }
      const { data: opsActuales } = await supabase
        .from('proveedores_usuarios')
        .select('id, rol, nombre, cuil, activo, user_id')
        .eq('proveedor_id', proveedor.id)
      setOperarios(opsActuales ?? [])
      setResultadoImport(result)
    } catch (err: any) {
      setError(`Error al leer archivo: ${err.message}`)
    } finally {
      setImportando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function descargarPlantilla() {
    const csv = 'Nombre,CUIL,Email\nJuan Pérez,20-12345678-9,juan@example.com\nMaría López,27-87654321-3,maria@example.com'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_operarios.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    if (habilitacion) {
      setQrUrl(`${window.location.origin}/qr/${habilitacion.qr_token}`)
    }
  }, [habilitacion])

  const estadoDocCfg: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: 'Pendiente', color: 'zinc' },
    CARGADO:   { label: 'Cargado',   color: 'blue' },
    APROBADO:  { label: 'Aprobado',  color: 'green' },
    RECHAZADO: { label: 'Rechazado', color: 'red' },
    VENCIDO:   { label: 'Vencido',   color: 'orange' },
  }

  const colorClass = (color: string) =>
    color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
    'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'

  // Aplanar y ordenar todo el historial cronológico inverso para la tab "Historial"
  const historialCompleto = Object.entries(historialPorDoc)
    .flatMap(([docId, eventos]) => {
      const doc = docs.find((d: any) => d.id === docId)
      const nombreDoc = doc?.documentos_requeridos?.nombre ?? 'Documento'
      const codigoDoc = doc?.documentos_requeridos?.codigo ?? ''
      return eventos.map(ev => ({ ...ev, nombreDoc, codigoDoc }))
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const actorLabel: Record<string, string> = {
    proveedor: 'Vos',
    evaluador: 'Evaluador',
    sistema:   'Sistema',
  }

  const estadoLabel: Record<string, { text: string; color: string }> = {
    PENDIENTE: { text: 'pendiente',   color: 'text-zinc-400' },
    CARGADO:   { text: 'cargado',     color: 'text-blue-400' },
    APROBADO:  { text: 'aprobado ✓',  color: 'text-green-400' },
    RECHAZADO: { text: 'rechazado',   color: 'text-red-400' },
    VENCIDO:   { text: 'vencido',     color: 'text-orange-400' },
  }

  // Tabs que se muestran (sin QR — ese es el botón "← Mi QR")
  const tabs = [
    { key: 'docs',      label: 'Docs' },
    { key: 'equipos',   label: 'Equipos' },
    { key: 'historial', label: 'Historial' },
    { key: 'operarios', label: 'Personal' },
    { key: 'accesos',   label: 'Accesos' },
    { key: 'perfil',    label: 'Perfil' },
  ]

  const docsConProblemas = docs.filter((d: any) => ['RECHAZADO', 'VENCIDO'].includes(d.estado)).length
  const docsCompletos    = docs.filter((d: any) => ['CARGADO', 'APROBADO'].includes(d.estado)).length


  // ── OPERARIO: solo muestra QR ──
  if (miRol === 'operario') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <nav className="border-b border-white/[0.06] bg-[#0a0c12]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <span className="font-medium text-sm">Sistema Legajos</span>
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-300 text-xs">Salir</button>
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
            <p className="text-zinc-400">Sin habilitación vigente</p>
          )}
        </div>
      </div>
    )
  }

  // ── TITULAR ──
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
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-300 text-xs">Salir</button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── VISTA QR ── */}
        {vista === 'qr' && habilitacion && (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6">
              <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-sm px-3 py-1 rounded-full">✓ Habilitado</span>
              {habilitacion.fecha_venc && (
                <span className="text-zinc-500 text-xs" suppressHydrationWarning>hasta {new Date(habilitacion.fecha_venc).toLocaleDateString('es-AR')}</span>
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
            {/* Tabs secundarias desde QR */}
            <div className="flex gap-0.5 w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setVista(t.key as Vista)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                    vista === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                  <span className="text-base leading-none">{TAB_ICONS[t.key]}</span>
                  <span className="text-[9px] font-medium leading-none">
                    {t.key === 'docs' && docsConProblemas > 0 ? 'Docs ⚠' : t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── VISTAS SECUNDARIAS ── */}
        {vista !== 'qr' && (
          <>
            {/* Header resumen */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-white font-medium">{proveedor?.razon_social}</h2>
                  <p className="text-zinc-500 text-sm">CUIT {proveedor?.cuit}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${colorClass(
                  proveedor?.estado === 'APROBADO' ? 'green' :
                  proveedor?.estado === 'EN_REVISION' ? 'blue' :
                  proveedor?.estado === 'RECHAZADO' ? 'red' : 'zinc'
                )}`}>{proveedor?.estado}</span>
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
            <div className="flex gap-0.5 mb-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              {habilitacion && (
                <button onClick={() => setVista('qr')}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-green-600/20 text-green-400 transition-all">
                  <span className="text-base leading-none">▣</span>
                  <span className="text-[9px] font-medium leading-none">Mi QR</span>
                </button>
              )}
              {tabs.map(t => (
                <button key={t.key} onClick={() => setVista(t.key as Vista)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                    vista === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'
                  }`}>
                  <span className="text-base leading-none">{TAB_ICONS[t.key]}</span>
                  <span className="text-[9px] font-medium leading-none">
                    {t.key === 'docs' && docsConProblemas > 0 ? 'Docs ⚠' : t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* ── DOCUMENTOS ── */}
            {vista === 'docs' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Documentos requeridos</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máx. 10MB · Ingresá la fecha antes de subir</p>
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
                              {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                              {doc.fecha_venc && (
                                <span className="text-zinc-500 text-xs" suppressHydrationWarning>Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>
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
                              <input type="date" value={fechas[doc.id] || doc.fecha_venc || ''}
                                onChange={e => setFechas(f => ({ ...f, [doc.id]: e.target.value }))}
                                min={new Date().toISOString().split('T')[0]}
                                className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 text-white text-xs"/>
                            )}
                            <label className={`cursor-pointer ${estaSubiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(doc.id, f) }}/>
                              <span className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg inline-block">
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

            {/* ── HISTORIAL DE DOCUMENTOS ── */}
            {vista === 'historial' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Historial de documentos</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Todas las acciones sobre tu documentación, del más reciente al más antiguo</p>
                </div>
                {historialCompleto.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-zinc-600 text-sm">Sin actividad registrada todavía</p>
                    <p className="text-zinc-700 text-xs mt-1">El historial se genera al subir o revisar documentos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {historialCompleto.map((ev: any) => {
                      const cfg = estadoLabel[ev.estado_nuevo] ?? { text: ev.estado_nuevo, color: 'text-zinc-400' }
                      const esRechazo = ev.estado_nuevo === 'RECHAZADO'
                      return (
                        <div key={ev.id} className="px-5 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Documento */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-zinc-600 text-xs font-mono shrink-0">{ev.codigoDoc}</span>
                                <span className="text-zinc-300 text-sm truncate">{ev.nombreDoc}</span>
                              </div>
                              {/* Evento */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  ev.actor_tipo === 'proveedor' ? 'bg-blue-500/10 text-blue-400' :
                                  ev.actor_tipo === 'evaluador' ? 'bg-purple-500/10 text-purple-400' :
                                  'bg-zinc-500/10 text-zinc-500'
                                }`}>
                                  {actorLabel[ev.actor_tipo] ?? ev.actor_tipo}
                                </span>
                                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.text}</span>
                                {ev.observaciones && (
                                  <span className="text-orange-300 text-xs italic">— "{ev.observaciones}"</span>
                                )}
                              </div>
                              {/* Alerta si fue rechazado */}
                              {esRechazo && ev.observaciones && (
                                <div className="mt-1.5 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                                  <p className="text-red-300 text-xs">Motivo: {ev.observaciones}</p>
                                </div>
                              )}
                            </div>
                            {/* Fecha */}
                            <div className="text-right shrink-0">
                              <p className="text-zinc-500 text-xs">
                                <span suppressHydrationWarning>{new Date(ev.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                              </p>
                              <p className="text-zinc-700 text-xs">
                                <span suppressHydrationWarning>{new Date(ev.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}


            {/* ── EQUIPOS ── */}
            {vista === 'equipos' && (
              <div>
                {equiposSlot ?? (
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
                    <p className="text-zinc-500 text-sm">Sin equipos disponibles</p>
                  </div>
                )}
              </div>
            )}

            {/* ── EQUIPO / OPERARIOS ── */}
            {vista === 'operarios' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium">Personal con acceso al QR</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">Cada operario recibe un email para definir su contraseña</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => fileInputRef.current?.click()} disabled={importando}
                        className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {importando ? 'Importando...' : '↑ Importar Excel'}
                      </button>
                      <button onClick={() => setAgregandoOp(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
                        + Agregar
                      </button>
                    </div>
                  </div>
                  <button onClick={descargarPlantilla} className="text-blue-400 hover:text-blue-300 text-xs">
                    Descargar plantilla CSV
                  </button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportar(f) }}/>
                </div>

                {resultadoImport && (
                  <div className="px-5 py-3 border-b border-white/[0.06] bg-blue-500/5">
                    <p className="text-blue-300 text-sm">
                      ✓ {resultadoImport.creados} operarios agregados
                      {resultadoImport.omitidos > 0 && ` · ${resultadoImport.omitidos} omitidos`}
                    </p>
                  </div>
                )}

                {agregandoOp && (
                  <div className="px-5 py-4 border-b border-white/[0.06] bg-blue-500/5">
                    <form onSubmit={invitarOperario} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input value={nuevoOperario.nombre}
                          onChange={e => setNuevoOperario(o => ({ ...o, nombre: e.target.value }))}
                          required placeholder="Nombre completo"
                          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"/>
                        <input value={nuevoOperario.cuil}
                          onChange={e => setNuevoOperario(o => ({ ...o, cuil: e.target.value }))}
                          placeholder="CUIL"
                          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"/>
                      </div>
                      <input type="email" value={nuevoOperario.email}
                        onChange={e => setNuevoOperario(o => ({ ...o, email: e.target.value }))}
                        required placeholder="Email"
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"/>
                      {error && <p className="text-red-400 text-xs">{error}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={loadingOp}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg">
                          {loadingOp ? 'Agregando...' : 'Agregar'}
                        </button>
                        <button type="button" onClick={() => { setAgregandoOp(false); setError(''); setNuevoOperario({ nombre: '', cuil: '', email: '' }) }}
                          className="text-zinc-500 hover:text-zinc-300 text-xs px-3">Cancelar</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="divide-y divide-white/[0.04]">
                  {operarios.map((op: any) => (
                    <div key={op.id} className={`px-5 py-3 flex items-center justify-between ${!op.activo ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{op.nombre ?? 'Sin nombre'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${op.rol === 'titular' ? colorClass('blue') : colorClass('zinc')}`}>
                            {op.rol === 'titular' ? 'Titular' : 'Operario'}
                          </span>
                          {op.cuil && <span className="text-zinc-600 text-xs">CUIL {op.cuil}</span>}
                        </div>
                      </div>
                      {op.rol !== 'titular' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => toggleOperario(op.id, op.activo)}
                            className={`text-xs px-2.5 py-1 rounded-full border ${
                              op.activo
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                            }`}>
                            {op.activo ? 'Activo' : 'Inactivo'}
                          </button>
                          <button onClick={() => eliminarOperario(op.id, op.nombre)}
                            className="text-zinc-600 hover:text-red-400 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {operarios.filter((o: any) => o.rol === 'operario').length === 0 && (
                    <div className="px-5 py-6 text-center"><p className="text-zinc-600 text-sm">Sin operarios todavía</p></div>
                  )}
                </div>
              </div>
            )}

            {/* ── ACCESOS GPS ── */}
            {vista === 'accesos' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium">Registros de acceso</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Ingresos y egresos registrados en los establecimientos</p>
                </div>
                {accesos.length === 0 ? (
                  <div className="px-5 py-8 text-center"><p className="text-zinc-600 text-sm">Sin registros todavía</p></div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {accesos.map((acc: any) => (
                      <div key={acc.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${acc.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                            {acc.tipo === 'INGRESO' ? '→ Ingreso' : '← Egreso'}
                          </p>
                          <p className="text-zinc-600 text-xs">
                            <span suppressHydrationWarning>{new Date(acc.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </p>
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
            )}

            {/* ── PERFIL ── */}
            {vista === 'perfil' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-sm font-medium mb-4">Datos de la empresa</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Razón social', value: proveedor?.razon_social },
                    { label: 'CUIT',         value: proveedor?.cuit },
                    { label: 'Email',        value: proveedor?.email },
                    { label: 'Teléfono',     value: proveedor?.telefono ?? '—' },
                    { label: 'Rubro',        value: (proveedor?.rubros as any)?.nombre },
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
