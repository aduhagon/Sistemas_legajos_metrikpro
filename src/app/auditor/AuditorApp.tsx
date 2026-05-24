'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Tipos ────────────────────────────────────────────────────
type Establecimiento = { id: string; nombre: string; lat_centro: number; lng_centro: number; radio_metros: number }
type ProveedorSnap   = { id: string; razon_social: string; cuit: string; estado: string; qr_token: string; habilitacion_estado: string; habilitacion_venc: string; docs_vencidos: number; equipos: any[] }
type ChecklistItem   = { id: string; nombre: string; descripcion: string }
type Snapshot        = { generado_at: string; establecimiento: any; proveedores: ProveedorSnap[]; checklist: ChecklistItem[] }
type VisitaLocal = {
  id: string; establecimiento_id: string; proveedor_id?: string; equipo_id?: string
  qr_token?: string; resultado: 'CONFORME'|'NO_CONFORME'|'URGENTE'|'OBSERVACION'
  observacion: string; foto_url?: string; lat?: number; lng?: number
  offline: boolean; visitado_at: string
  checklist: { checklist_id: string; cumple: boolean; observacion: string }[]
  sincronizado: boolean
}
type EquipoVencido = { dominio: string; icono: string; tipo: string; doc_nombre: string; fecha_venc: string }

const RESULTADO_COLOR: Record<string, string> = {
  CONFORME:    'bg-green-500/10 text-green-400 border-green-500/20',
  NO_CONFORME: 'bg-red-500/10 text-red-400 border-red-500/20',
  URGENTE:     'bg-red-600/15 text-red-300 border-red-600/30',
  OBSERVACION: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}
const RESULTADO_LABEL: Record<string, string> = {
  CONFORME:    '✓ Conforme',
  NO_CONFORME: '✗ No conforme',
  URGENTE:     '⚠ Urgente',
  OBSERVACION: '○ Observación',
}

const ESTADO_HAB_LABEL: Record<string, string> = {
  VIGENTE:       'Vigente',
  DOC_PENDIENTE: 'Doc. pendiente',
  EN_REVISION:   'En revisión',
  VENCIDA:       'Vencida',
  SUSPENDIDA:    'Suspendida',
}
function formatEstadoHab(estado: string): string {
  return ESTADO_HAB_LABEL[estado] ?? estado
}

const DB_KEY = 'auditor_visitas_queue'
const SNAP_KEY = (id: string) => `auditor_snap_${id}`

function getQueue(): VisitaLocal[] { try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') } catch { return [] } }
function saveQueue(q: VisitaLocal[]) { localStorage.setItem(DB_KEY, JSON.stringify(q)) }
function getSnap(id: string): Snapshot | null { try { return JSON.parse(localStorage.getItem(SNAP_KEY(id)) || 'null') } catch { return null } }
function saveSnap(id: string, snap: Snapshot) { localStorage.setItem(SNAP_KEY(id), JSON.stringify(snap)) }

// ── QR Scanner ───────────────────────────────────────────────
function QRScanner({ onScan, onClose }: { onScan: (token: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)
  const [error, setError]   = useState('')
  const [activo, setActivo] = useState(false)

  useEffect(() => { iniciarCamara(); return () => detener() }, [])

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setActivo(true)
        escanear()
      }
    } catch {
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }

  function detener() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function escanear() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(escanear); return }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        const codes = await detector.detect(canvas)
        if (codes.length > 0) { detener(); onScan(codes[0].rawValue); return }
      } catch {}
    } else {
      try {
        const jsQR = (window as any).jsQR
        if (jsQR) {
          const img  = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(img.data, img.width, img.height)
          if (code) { detener(); onScan(code.data); return }
        }
      } catch {}
    }
    rafRef.current = requestAnimationFrame(escanear)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.8)' }}>
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 500, margin: 0 }}>Escanear QR del proveedor</p>
        <button onClick={() => { detener(); onClose() }}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline autoPlay/>
        <canvas ref={canvasRef} style={{ display: 'none' }}/>
        {activo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'relative', width: 256, height: 256 }}>
              {[
                { top: 0, left: 0, borderTop: '2px solid #60a5fa', borderLeft: '2px solid #60a5fa', borderRadius: '8px 0 0 0' },
                { top: 0, right: 0, borderTop: '2px solid #60a5fa', borderRight: '2px solid #60a5fa', borderRadius: '0 8px 0 0' },
                { bottom: 0, left: 0, borderBottom: '2px solid #60a5fa', borderLeft: '2px solid #60a5fa', borderRadius: '0 0 0 8px' },
                { bottom: 0, right: 0, borderBottom: '2px solid #60a5fa', borderRight: '2px solid #60a5fa', borderRadius: '0 0 8px 0' },
              ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }}/>)}
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'rgba(96,165,250,0.7)', animation: 'scan 2s ease-in-out infinite alternate', top: '50%' }}/>
            </div>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
              <p style={{ color: '#fca5a5', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
              <button onClick={() => { setError(''); iniciarCamara() }}
                style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
      <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: '12px 0', background: '#000', margin: 0 }}>
        Apuntá la cámara al código QR del proveedor
      </p>
      <style>{`@keyframes scan { from { transform: translateY(-80px); opacity: 0.4; } to { transform: translateY(80px); opacity: 1; } }`}</style>
    </div>
  )
}

// ── Pantalla de bloqueo por equipos vencidos ─────────────────
function PantallaBloqueoEquipos({
  razonSocial, cuit, equipos, onVolver,
}: {
  razonSocial: string; cuit: string
  equipos: EquipoVencido[]
  onVolver: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onVolver} className="text-zinc-500 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5m7-7-7 7 7 7"/>
          </svg>
        </button>
        <p className="font-medium text-sm">{razonSocial}</p>
      </div>

      {/* Banner de bloqueo */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>
        <h2 className="text-red-300 font-semibold text-lg mb-1">Acceso bloqueado</h2>
        <p className="text-red-400/80 text-sm">
          Este proveedor tiene equipos con documentación vencida.
        </p>
        <p className="text-zinc-500 text-xs mt-1">CUIT {cuit}</p>
      </div>

      {/* Lista de equipos con problema */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-sm font-medium text-white">Equipos con documentación vencida</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {equipos.length} documento{equipos.length !== 1 ? 's' : ''} vencido{equipos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {equipos.map((eq, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{eq.icono}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-mono font-medium">{eq.dominio}</span>
                  <span className="text-zinc-500 text-xs">{eq.tipo}</span>
                </div>
                <p className="text-zinc-400 text-xs mt-0.5">{eq.doc_nombre}</p>
                {eq.fecha_venc && (
                  <p className="text-orange-400 text-xs mt-0.5">
                    Venció: {new Date(eq.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/20 shrink-0">
                Vencido
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Instrucción */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3">
        <p className="text-zinc-400 text-sm">
          El proveedor debe renovar la documentación de sus equipos antes de poder ingresar.
        </p>
      </div>

      <button onClick={onVolver}
        className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 font-medium py-3 rounded-xl transition-colors text-sm">
        ← Volver a escanear
      </button>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function AuditorApp({ establecimientos, auditorId }: { establecimientos: Establecimiento[]; auditorId: string }) {
  const [online, setOnline]                 = useState(true)
  const [scannerAbierto, setScannerAbierto] = useState(false)
  const [vista, setVista]                   = useState<'inicio'|'escanear'|'visita'|'cola'|'bloqueo_equipos'>('inicio')
  const [estSeleccionado, setEst]           = useState<Establecimiento | null>(null)
  const [snapshot, setSnapshot]             = useState<Snapshot | null>(null)
  const [loadingSnap, setLoadingSnap]       = useState(false)
  const [qrInput, setQrInput]               = useState('')
  const [proveedorEncontrado, setProv]      = useState<ProveedorSnap | null>(null)
  const [resultado, setResultado]           = useState<'CONFORME'|'NO_CONFORME'|'URGENTE'|'OBSERVACION'>('CONFORME')
  const [observacion, setObservacion]       = useState('')
  const [checklistResp, setChecklistResp]   = useState<Record<string, { cumple: boolean; obs: string }>>({})
  const [foto, setFoto]                     = useState<string | null>(null)
  const [cola, setCola]                     = useState<VisitaLocal[]>([])
  const [sincronizando, setSincronizando]   = useState(false)
  const [guardando, setGuardando]           = useState(false)
  const [msg, setMsg]                       = useState('')
  const [validando, setValidando]           = useState(false)
  const [equiposVencidos, setEquiposVencidos] = useState<EquipoVencido[]>([])
  const [bloqueadoRazonSocial, setBloqueadoRazonSocial] = useState('')
  const [bloqueadoCuit, setBloqueadoCuit]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const hoyStr = new Date().toISOString().split('T')[0]
  const visitasHoy = cola.filter(v => v.visitado_at.startsWith(hoyStr)).length

  useEffect(() => {
    const on  = () => { setOnline(true); sincronizarCola() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setOnline(navigator.onLine)
    setCola(getQueue())
    if (!('BarcodeDetector' in window) && !(window as any).jsQR) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      document.head.appendChild(s)
    }
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const sincronizarCola = useCallback(async () => {
    const q = getQueue().filter(v => !v.sincronizado)
    if (q.length === 0) return
    setSincronizando(true)
    const nuevaQ = getQueue()
    for (const visita of q) {
      try {
        const { data } = await supabase.rpc('registrar_visita_auditoria', {
          p_establecimiento_id: visita.establecimiento_id,
          p_proveedor_id: visita.proveedor_id ?? null,
          p_qr_token: visita.qr_token ?? null,
          p_resultado: visita.resultado,
          p_observacion: visita.observacion || null,
          p_foto_url: visita.foto_url ?? null,
          p_lat: visita.lat ?? null,
          p_lng: visita.lng ?? null,
          p_offline: true,
          p_visitado_at: visita.visitado_at,
          p_checklist: visita.checklist,
        })
        if (data?.ok) {
          const idx = nuevaQ.findIndex(v => v.id === visita.id)
          if (idx >= 0) nuevaQ[idx].sincronizado = true
        }
      } catch {}
    }
    saveQueue(nuevaQ); setCola(nuevaQ)
    setSincronizando(false)
    const n = nuevaQ.filter(v => v.sincronizado).length
    setMsg(`${n} visita(s) sincronizada(s)`)
    setTimeout(() => setMsg(''), 3000)
  }, [])

  async function descargarSnapshot(est: Establecimiento) {
    setLoadingSnap(true)
    if (online) {
      const { data } = await supabase.rpc('generar_snapshot_auditoria', {
        p_auditor_id: auditorId,
        p_establecimiento_id: est.id,
      })
      if (data) { saveSnap(est.id, data); setSnapshot(data) }
    } else {
      setSnapshot(getSnap(est.id))
    }
    setLoadingSnap(false)
  }

  async function seleccionarEst(est: Establecimiento) {
    setEst(est)
    await descargarSnapshot(est)
    setVista('escanear')
  }

  // ── Validar acceso con equipos ───────────────────────────────
  async function seleccionarProveedor(prov: ProveedorSnap) {
    if (!estSeleccionado) return

    // Sin conexión: no podemos validar equipos → entrar igual con aviso
    if (!online) {
      setProv(prov)
      setVista('visita')
      return
    }

    setValidando(true)
    try {
      const { data } = await supabase.rpc('validar_acceso', {
        p_qr_token_proveedor:  prov.qr_token,
        p_establecimiento_id:  estSeleccionado.id,
      })

      if (data?.motivo === 'EQUIPOS_VENCIDOS') {
        setEquiposVencidos(data.equipos_vencidos ?? [])
        setBloqueadoRazonSocial(data.razon_social ?? prov.razon_social)
        setBloqueadoCuit(data.cuit ?? prov.cuit)
        setVista('bloqueo_equipos')
        setValidando(false)
        return
      }

      // Para cualquier otro resultado (válido o motivo diferente), dejar pasar
      // — los otros bloqueos (habilitacion vencida, rubro) ya se muestran en la pantalla de visita
      setProv(prov)
      setVista('visita')
    } catch {
      // Si la RPC falla, entrar de todas formas
      setProv(prov)
      setVista('visita')
    }
    setValidando(false)
  }

  function buscarPorQR(token: string) {
    if (!snapshot) { setMsg('Snapshot no disponible'); setTimeout(() => setMsg(''), 3000); return }
    const prov = snapshot.proveedores?.find(p => p.qr_token === token)
    if (prov) { seleccionarProveedor(prov) }
    else { setMsg('QR no encontrado en el snapshot.' + (online ? '' : ' Verificá con conexión.')); setTimeout(() => setMsg(''), 3000) }
  }

  function getGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      )
    })
  }

  async function guardarVisita() {
    if (!estSeleccionado || !proveedorEncontrado) return
    setGuardando(true)
    const gps   = await getGPS()
    const ahora = new Date().toISOString()
    const checklistArr = snapshot?.checklist?.map(item => ({
      checklist_id: item.id,
      cumple: checklistResp[item.id]?.cumple ?? true,
      observacion: checklistResp[item.id]?.obs ?? '',
    })) ?? []

    if (online) {
      const { data } = await supabase.rpc('registrar_visita_auditoria', {
        p_establecimiento_id: estSeleccionado.id,
        p_proveedor_id: proveedorEncontrado.id,
        p_qr_token: proveedorEncontrado.qr_token,
        p_resultado: resultado,
        p_observacion: observacion || null,
        p_foto_url: foto ?? null,
        p_lat: gps?.lat ?? null,
        p_lng: gps?.lng ?? null,
        p_offline: false,
        p_visitado_at: ahora,
        p_checklist: checklistArr,
      })
      if (data?.ok) { setMsg('Visita registrada'); resetVisita() }
      else setMsg('Error al guardar')
    } else {
      const visitaLocal: VisitaLocal = {
        id: crypto.randomUUID(),
        establecimiento_id: estSeleccionado.id,
        proveedor_id: proveedorEncontrado.id,
        qr_token: proveedorEncontrado.qr_token,
        resultado, observacion,
        foto_url: foto ?? undefined,
        lat: gps?.lat, lng: gps?.lng,
        offline: true, visitado_at: ahora,
        checklist: checklistArr, sincronizado: false,
      }
      const q = [...getQueue(), visitaLocal]
      saveQueue(q); setCola(q)
      setMsg('Guardado offline — se sincronizará al recuperar señal')
      resetVisita()
    }
    setTimeout(() => setMsg(''), 3000)
    setGuardando(false)
  }

  function resetVisita() {
    setProv(null); setResultado('CONFORME'); setObservacion('')
    setChecklistResp({}); setFoto(null); setQrInput(''); setVista('escanear')
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFoto(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const pendientes = cola.filter(v => !v.sincronizado).length
  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  return (
    <>
      {scannerAbierto && (
        <QRScanner
          onScan={(token) => { setScannerAbierto(false); buscarPorQR(token) }}
          onClose={() => setScannerAbierto(false)}
        />
      )}

      <div className="min-h-screen bg-[#0d0f17] text-white max-w-sm mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Sistema Legajos</p>
            <h1 className="text-lg font-medium">App de auditoría</h1>
          </div>
          <div className="flex items-center gap-2">
            {estSeleccionado && (
              <div className="text-xs bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-full text-zinc-400">
                {visitasHoy} visita{visitasHoy !== 1 ? 's' : ''} hoy
              </div>
            )}
            {pendientes > 0 && (
              <button onClick={() => setVista('cola')}
                className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-full">
                {pendientes} pendiente{pendientes > 1 ? 's' : ''}
              </button>
            )}
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`}/>
          </div>
        </div>

        {/* Flash */}
        {msg && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-blue-300 text-sm">{sincronizando ? '⟳ Sincronizando...' : msg}</p>
          </div>
        )}

        {/* Spinner de validación */}
        {validando && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p className="text-zinc-400 text-sm">Verificando documentación de equipos…</p>
          </div>
        )}

        {/* ── INICIO ── */}
        {vista === 'inicio' && (
          <div className="space-y-3">
            <p className="text-zinc-500 text-sm mb-4">Seleccioná un establecimiento para auditar</p>
            {establecimientos.map(est => (
              <button key={est.id} onClick={() => seleccionarEst(est)} disabled={loadingSnap}
                className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-2xl p-4 text-left transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{est.nombre}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Radio: {est.radio_metros}m</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </button>
            ))}
            {loadingSnap && <p className="text-zinc-500 text-sm text-center py-4">Descargando snapshot...</p>}
          </div>
        )}

        {/* ── ESCANEAR ── */}
        {vista === 'escanear' && estSeleccionado && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setVista('inicio')} className="text-zinc-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
              </button>
              <div>
                <p className="font-medium text-sm">{estSeleccionado.nombre}</p>
                {snapshot && (
                  <p className="text-zinc-600 text-xs">
                    Snapshot: {new Date(snapshot.generado_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{snapshot.proveedores?.length ?? 0} proveedores
                    {!online && <span className="text-yellow-500 ml-1">· offline</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Escanear QR</p>
              <button onClick={() => setScannerAbierto(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-4 rounded-xl transition-colors flex items-center justify-center gap-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect x="7" y="7" width="3" height="3" rx="0.5"/>
                  <rect x="14" y="7" width="3" height="3" rx="0.5"/>
                  <rect x="7" y="14" width="3" height="3" rx="0.5"/>
                  <path d="M14 14h1v1m2-1h1v3h-3v-1"/>
                </svg>
                Abrir cámara y escanear QR
              </button>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/[0.06]"/>
                <span className="text-zinc-600 text-xs">o ingresá el token manualmente</span>
                <div className="flex-1 h-px bg-white/[0.06]"/>
              </div>
              <input value={qrInput} onChange={e => setQrInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && qrInput && buscarPorQR(qrInput)}
                placeholder="Token QR del proveedor" className={inputCls}/>
              {qrInput && (
                <button onClick={() => buscarPorQR(qrInput)}
                  className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-white text-sm py-2 rounded-lg transition-colors">
                  Buscar
                </button>
              )}
            </div>

            {snapshot?.proveedores && snapshot.proveedores.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                <p className="text-zinc-500 text-xs px-4 pt-3 pb-2 font-medium uppercase tracking-wide">
                  Proveedores en el establecimiento
                </p>
                <div className="divide-y divide-white/[0.04]">
                  {snapshot.proveedores.slice(0, 10).map(prov => {
                    const estadoHab = prov.habilitacion_estado ?? prov.estado
                    const esEnRevision = estadoHab === 'EN_REVISION'
                    return (
                      <button key={prov.id} onClick={() => seleccionarProveedor(prov)} disabled={validando}
                        className="w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors disabled:opacity-60">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm">{prov.razon_social}</p>
                            <p className="text-zinc-600 text-xs">{prov.cuit}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {esEnRevision && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              estadoHab === 'VIGENTE'       ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                              estadoHab === 'EN_REVISION'   ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              estadoHab === 'DOC_PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {formatEstadoHab(estadoHab)}
                            </span>
                          </div>
                        </div>
                        {esEnRevision && (
                          <p className="text-yellow-600 text-xs mt-1.5 leading-relaxed">
                            ⚠ Documentación en revisión — consultá con supervisor antes de permitir el ingreso
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BLOQUEO POR EQUIPOS VENCIDOS ── */}
        {vista === 'bloqueo_equipos' && (
          <PantallaBloqueoEquipos
            razonSocial={bloqueadoRazonSocial}
            cuit={bloqueadoCuit}
            equipos={equiposVencidos}
            onVolver={() => setVista('escanear')}
          />
        )}

        {/* ── VISITA ── */}
        {vista === 'visita' && proveedorEncontrado && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setProv(null); setVista('escanear') }} className="text-zinc-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
              </button>
              <p className="font-medium text-sm">{proveedorEncontrado.razon_social}</p>
            </div>

            <div className={`rounded-xl border px-4 py-3 ${
              proveedorEncontrado.habilitacion_estado === 'VIGENTE'       ? 'bg-green-500/10 border-green-500/20' :
              proveedorEncontrado.habilitacion_estado === 'EN_REVISION'   ? 'bg-yellow-500/10 border-yellow-500/20' :
              proveedorEncontrado.habilitacion_estado === 'DOC_PENDIENTE' ? 'bg-yellow-500/10 border-yellow-500/20' :
              'bg-red-500/10 border-red-500/20'
            }`}>
              <p className={`text-sm font-medium ${
                proveedorEncontrado.habilitacion_estado === 'VIGENTE'       ? 'text-green-400' :
                proveedorEncontrado.habilitacion_estado === 'EN_REVISION'   ? 'text-yellow-400' :
                proveedorEncontrado.habilitacion_estado === 'DOC_PENDIENTE' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                Habilitación: {formatEstadoHab(proveedorEncontrado.habilitacion_estado ?? proveedorEncontrado.estado)}
              </p>
              {proveedorEncontrado.docs_vencidos > 0 && (
                <p className="text-red-400 text-xs mt-1">{proveedorEncontrado.docs_vencidos} documento(s) vencido(s)</p>
              )}
              {proveedorEncontrado.habilitacion_estado === 'EN_REVISION' && (
                <p className="text-yellow-300 text-xs mt-1.5 leading-relaxed">
                  ⚠ Documentación en revisión. Consultá con tu supervisor antes de permitir el ingreso.
                </p>
              )}
              {!online && (
                <p className="text-yellow-500 text-xs mt-1.5">
                  ⚠ Sin conexión — no se pudo verificar equipos en tiempo real
                </p>
              )}
            </div>

            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Resultado de la visita</p>
              <div className="grid grid-cols-2 gap-2">
                {(['CONFORME','NO_CONFORME','URGENTE','OBSERVACION'] as const).map(r => (
                  <button key={r} onClick={() => setResultado(r)}
                    className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      resultado === r ? RESULTADO_COLOR[r] : 'bg-white/[0.03] border-white/[0.08] text-zinc-500'
                    }`}>
                    {RESULTADO_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            {snapshot?.checklist && snapshot.checklist.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Checklist de puntos</p>
                {snapshot.checklist.map(item => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm flex-1">{item.nombre}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: true, obs: prev[item.id]?.obs ?? '' } }))}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            checklistResp[item.id]?.cumple === true ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
                          }`}>Sí</button>
                        <button onClick={() => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: false, obs: prev[item.id]?.obs ?? '' } }))}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            checklistResp[item.id]?.cumple === false ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
                          }`}>No</button>
                      </div>
                    </div>
                    {checklistResp[item.id]?.cumple === false && (
                      <input value={checklistResp[item.id]?.obs ?? ''}
                        onChange={e => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: false, obs: e.target.value } }))}
                        placeholder="Observación del punto..." className={inputCls + ' text-xs'}/>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Observación general</p>
              <textarea value={observacion} onChange={e => setObservacion(e.target.value)}
                rows={3} placeholder="Describí lo observado..." className={inputCls + ' resize-none'}/>
            </div>

            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Foto (opcional)</p>
              {foto ? (
                <div className="relative">
                  <img src={foto} alt="foto" className="w-full h-40 object-cover rounded-xl"/>
                  <button onClick={() => setFoto(null)}
                    className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">Cambiar</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full bg-white/[0.03] border border-dashed border-white/[0.15] rounded-xl py-6 text-zinc-500 text-sm hover:border-white/30 transition-colors">
                  Tocar para tomar o seleccionar foto
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden"/>
            </div>

            <button onClick={guardarVisita} disabled={guardando}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors">
              {guardando ? 'Guardando...' : online ? 'Guardar visita' : 'Guardar offline'}
            </button>

            {!online && (
              <p className="text-yellow-500 text-xs text-center">Sin conexión — se sincronizará automáticamente al recuperar señal</p>
            )}
          </div>
        )}

        {/* ── COLA ── */}
        {vista === 'cola' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setVista('inicio')} className="text-zinc-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
              </button>
              <p className="font-medium text-sm">Visitas pendientes de sincronización</p>
            </div>
            {cola.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No hay visitas en cola</p>
            ) : (
              <div className="space-y-3">
                {cola.map(v => (
                  <div key={v.id} className={`bg-white/[0.03] border rounded-xl p-4 ${v.sincronizado ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${RESULTADO_COLOR[v.resultado]}`}>
                        {RESULTADO_LABEL[v.resultado]}
                      </span>
                      <span className={`text-xs ${v.sincronizado ? 'text-green-400' : 'text-yellow-400'}`}>
                        {v.sincronizado ? '✓ Sincronizado' : '⟳ Pendiente'}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">
                      {new Date(v.visitado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {v.observacion && <p className="text-zinc-400 text-xs mt-1">{v.observacion}</p>}
                  </div>
                ))}
              </div>
            )}
            {pendientes > 0 && online && (
              <button onClick={sincronizarCola} disabled={sincronizando}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors">
                {sincronizando ? 'Sincronizando...' : `Sincronizar ${pendientes} visita(s)`}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
