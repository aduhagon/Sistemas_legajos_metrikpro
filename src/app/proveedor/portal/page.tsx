'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { QRCodeSVG } from 'qrcode.react'

type Vista = 'qr' | 'docs' | 'operarios' | 'historial' | 'perfil'

// Leer user_id directamente del token JWT en la cookie
function getUserIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  try {
    const cookies = document.cookie.split('; ')
    const sbCookie = cookies.find(c => c.startsWith('sb-') && c.includes('auth-token'))
    if (!sbCookie) return null
    
    const value = sbCookie.split('=')[1]
    if (!value) return null
    
    // El valor puede ser "base64-xxxx" — extraer la parte base64
    let tokenData = value
    if (value.startsWith('base64-')) {
      tokenData = value.slice(7)
    }
    
    // Decodificar base64
    const decoded = atob(decodeURIComponent(tokenData))
    const session = JSON.parse(decoded)
    
    // El access_token es un JWT — decodificar el payload
    const accessToken = session.access_token
    if (!accessToken) return null
    
    const payload = JSON.parse(atob(accessToken.split('.')[1]))
    return payload.sub || null
  } catch (e) {
    console.error('Error leyendo cookie:', e)
    return null
  }
}

export default function ProveedorPortalPage() {
  const [loading, setLoading] = useState(true)
  const [debugMsg, setDebugMsg] = useState('Iniciando...')
  const [miRol, setMiRol] = useState<'titular' | 'operario' | null>(null)
  const [proveedor, setProveedor] = useState<any>(null)
  const [habilitacion, setHabilitacion] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [vista, setVista] = useState<Vista>('docs')
  const [fechas, setFechas] = useState<Record<string, string>>({})
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [])

  async function cargarTodo() {
    try {
      setDebugMsg('Leyendo sesión...')
      
      const userId = getUserIdFromCookie()
      
      if (!userId) {
        setDebugMsg('Sin sesión — redirigiendo...')
        setTimeout(() => window.location.href = '/proveedor/login', 1500)
        return
      }

      setDebugMsg('Verificando proveedor...')

      const { data: provVerif, error: rpcErr } = await supabase
        .rpc('verificar_proveedor_usuario', { p_user_id: userId })

      if (rpcErr) {
        setDebugMsg(`Error: ${rpcErr.message}`)
        return
      }

      if (!provVerif) {
        setDebugMsg('No es proveedor — redirigiendo...')
        document.cookie.split(';').forEach(c => {
          if (c.trim().startsWith('sb-')) {
            document.cookie = c.split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
          }
        })
        setTimeout(() => window.location.href = '/proveedor/login', 1500)
        return
      }

      setMiRol(provVerif.rol)
      setDebugMsg('Cargando datos...')

      const { data: provData } = await supabase
        .from('proveedores')
        .select('id, razon_social, cuit, estado, email, telefono, notif_vencimientos, rubros(nombre), created_at')
        .eq('id', provVerif.proveedor_id)
        .single()

      if (!provData) {
        setDebugMsg('Sin datos de proveedor')
        return
      }

      setProveedor(provData)

      const { data: docsData } = await supabase
        .from('documentos_legajo')
        .select('id, estado, fecha_venc, archivo_url, observaciones, documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)')
        .eq('proveedor_id', provVerif.proveedor_id)

      const { data: habData } = await supabase
        .from('habilitaciones').select('id, qr_token, estado, fecha_venc')
        .eq('proveedor_id', provVerif.proveedor_id).eq('estado', 'VIGENTE')
        .maybeSingle()

      if (habData) {
        setHabilitacion(habData)
        setVista(provData.estado === 'APROBADO' ? 'qr' : 'docs')
      }

      setDocs(docsData ?? [])
      setLoading(false)
    } catch (e: any) {
      setDebugMsg(`Excepción: ${e.message}`)
    }
  }

  async function handleLogout() {
    // Limpiar cookies manualmente
    document.cookie.split(';').forEach(c => {
      if (c.trim().startsWith('sb-')) {
        document.cookie = c.split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      }
    })
    try { await supabase.auth.signOut() } catch {}
    window.location.href = '/proveedor/login'
  }

  async function handleUpload(docId: string, file: File) {
    const dr = docs.find(d => d.id === docId)?.documentos_requeridos
    const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'
    if (necesitaFecha && !fechas[docId]) {
      setError(`Ingresá la fecha de vencimiento antes de subir.`)
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
      setError(`Error: ${err.message}`)
    } finally {
      setSubiendo(null)
    }
  }

  const qrUrl = habilitacion
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${habilitacion.qr_token}`
    : ''

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

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-zinc-500 text-sm">Cargando tu portal...</p>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mt-4">
          <p className="text-yellow-400 text-xs font-mono">DEBUG: {debugMsg}</p>
        </div>
      </div>
    </div>
  )

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
          <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-300 text-xs">Salir</button>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">
        {habilitacion && vista === 'qr' && (
          <div className="flex flex-col items-center">
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-sm px-3 py-1 rounded-full mb-6">✓ Habilitado</span>
            <div className="bg-white rounded-3xl p-6 mb-6 shadow-2xl">
              <QRCodeSVG value={qrUrl} size={240} level="H" includeMargin={false}/>
            </div>
            <h2 className="text-white font-semibold text-xl">{proveedor?.razon_social}</h2>
            <p className="text-zinc-500 text-sm mt-1">CUIT {proveedor?.cuit}</p>
            <button onClick={() => setVista('docs')} className="mt-6 text-blue-400 text-sm">Ver documentos →</button>
          </div>
        )}

        {vista === 'docs' && (
          <>
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

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium">Documentos requeridos</h3>
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
                            <span className="text-zinc-500 text-xs font-mono">{dr?.codigo}</span>
                            <span className="text-sm text-white truncate">{dr?.nombre}</span>
                            {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                            {doc.fecha_venc && <span className="text-zinc-500 text-xs">Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>}
                            {uploadOk === doc.id && <span className="text-green-400 text-xs">✓ Subido</span>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${colorClass(dcfg.color)}`}>{dcfg.label}</span>
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
