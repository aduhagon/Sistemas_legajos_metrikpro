'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Tipos ────────────────────────────────────────────────────
type Establecimiento = { id: string; nombre: string; lat_centro: number; lng_centro: number; radio_metros: number }
type ProveedorSnap   = { id: string; razon_social: string; cuit: string; estado: string; qr_token: string; habilitacion_estado: string; habilitacion_venc: string; docs_vencidos: number; equipos: any[] }
type ChecklistItem   = { id: string; nombre: string; descripcion: string }
type Snapshot        = { generado_at: string; establecimiento: any; proveedores: ProveedorSnap[]; checklist: ChecklistItem[] }

type VisitaLocal = {
  id:                  string
  establecimiento_id:  string
  proveedor_id?:       string
  equipo_id?:          string
  qr_token?:           string
  resultado:           'CONFORME' | 'NO_CONFORME' | 'URGENTE' | 'OBSERVACION'
  observacion:         string
  foto_url?:           string
  lat?:                number
  lng?:                number
  offline:             boolean
  visitado_at:         string
  checklist:           { checklist_id: string; cumple: boolean; observacion: string }[]
  sincronizado:        boolean
}

const RESULTADO_COLOR: Record<string, string> = {
  CONFORME:     'bg-green-500/10 text-green-400 border-green-500/20',
  NO_CONFORME:  'bg-red-500/10 text-red-400 border-red-500/20',
  URGENTE:      'bg-red-600/15 text-red-300 border-red-600/30',
  OBSERVACION:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}
const RESULTADO_LABEL: Record<string, string> = {
  CONFORME:    '✓ Conforme',
  NO_CONFORME: '✗ No conforme',
  URGENTE:     '⚠ Urgente',
  OBSERVACION: '○ Observación',
}

const DB_KEY = 'auditor_visitas_queue'
const SNAP_KEY = (estId: string) => `auditor_snap_${estId}`

function getQueue(): VisitaLocal[] {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') } catch { return [] }
}
function saveQueue(q: VisitaLocal[]) {
  localStorage.setItem(DB_KEY, JSON.stringify(q))
}
function getSnap(estId: string): Snapshot | null {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY(estId)) || 'null') } catch { return null }
}
function saveSnap(estId: string, snap: Snapshot) {
  localStorage.setItem(SNAP_KEY(estId), JSON.stringify(snap))
}

export default function AuditorApp({ establecimientos, auditorId }: { establecimientos: Establecimiento[]; auditorId: string }) {
  const [online, setOnline]                       = useState(true)
  const [vista, setVista]                         = useState<'inicio'|'escanear'|'visita'|'cola'>('inicio')
  const [estSeleccionado, setEst]                 = useState<Establecimiento | null>(null)
  const [snapshot, setSnapshot]                   = useState<Snapshot | null>(null)
  const [loadingSnap, setLoadingSnap]             = useState(false)
  const [qrInput, setQrInput]                     = useState('')
  const [proveedorEncontrado, setProv]            = useState<ProveedorSnap | null>(null)
  const [resultado, setResultado]                 = useState<'CONFORME'|'NO_CONFORME'|'URGENTE'|'OBSERVACION'>('CONFORME')
  const [observacion, setObservacion]             = useState('')
  const [checklistResp, setChecklistResp]         = useState<Record<string, { cumple: boolean; obs: string }>>({})
  const [foto, setFoto]                           = useState<string | null>(null)
  const [cola, setCola]                           = useState<VisitaLocal[]>([])
  const [sincronizando, setSincronizando]         = useState(false)
  const [guardando, setGuardando]                 = useState(false)
  const [msg, setMsg]                             = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Online/offline listener
  useEffect(() => {
    const on  = () => { setOnline(true);  sincronizarCola() }
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    setOnline(navigator.onLine)
    setCola(getQueue())
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Auto-sincronizar al volver online
  const sincronizarCola = useCallback(async () => {
    const q = getQueue().filter(v => !v.sincronizado)
    if (q.length === 0) return
    setSincronizando(true)
    const nuevaQ = getQueue()
    for (const visita of q) {
      try {
        const { data } = await supabase.rpc('registrar_visita_auditoria', {
          p_establecimiento_id: visita.establecimiento_id,
          p_proveedor_id:       visita.proveedor_id ?? null,
          p_equipo_id:          visita.equipo_id ?? null,
          p_qr_token:           visita.qr_token ?? null,
          p_resultado:          visita.resultado,
          p_observacion:        visita.observacion || null,
          p_foto_url:           visita.foto_url ?? null,
          p_lat:                visita.lat ?? null,
          p_lng:                visita.lng ?? null,
          p_offline:            true,
          p_visitado_at:        visita.visitado_at,
          p_checklist:          JSON.stringify(visita.checklist),
        })
        if (data?.ok) {
          const idx = nuevaQ.findIndex(v => v.id === visita.id)
          if (idx >= 0) nuevaQ[idx].sincronizado = true
        }
      } catch {}
    }
    saveQueue(nuevaQ)
    setCola(nuevaQ)
    setSincronizando(false)
    setMsg(`${nuevaQ.filter(v => v.sincronizado).length} visita(s) sincronizada(s)`)
    setTimeout(() => setMsg(''), 3000)
  }, [])

  // Descargar snapshot
  async function descargarSnapshot(est: Establecimiento) {
    setLoadingSnap(true)
    if (online) {
      const { data } = await supabase.rpc('generar_snapshot_auditoria', {
        p_auditor_id:        auditorId,
        p_establecimiento_id: est.id,
      })
      if (data) {
        saveSnap(est.id, data)
        setSnapshot(data)
      }
    } else {
      const snap = getSnap(est.id)
      setSnapshot(snap)
    }
    setLoadingSnap(false)
  }

  async function seleccionarEst(est: Establecimiento) {
    setEst(est)
    await descargarSnapshot(est)
    setVista('escanear')
  }

  // Buscar proveedor por QR token
  function buscarPorQR(token: string) {
    if (!snapshot) return
    const prov = snapshot.proveedores?.find(p => p.qr_token === token)
    if (prov) {
      setProv(prov)
      setVista('visita')
    } else {
      setMsg('QR no encontrado en el snapshot. ' + (online ? '' : 'Verificá con conexión.'))
      setTimeout(() => setMsg(''), 3000)
    }
  }

  // Capturar GPS
  function getGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => resolve(null),
        { timeout: 5000 }
      )
    })
  }

  // Guardar visita
  async function guardarVisita() {
    if (!estSeleccionado || !proveedorEncontrado) return
    setGuardando(true)
    const gps = await getGPS()
    const ahora = new Date().toISOString()

    const checklistArr = snapshot?.checklist?.map(item => ({
      checklist_id: item.id,
      cumple:       checklistResp[item.id]?.cumple ?? true,
      observacion:  checklistResp[item.id]?.obs ?? '',
    })) ?? []

    if (online) {
      const { data } = await supabase.rpc('registrar_visita_auditoria', {
        p_establecimiento_id: estSeleccionado.id,
        p_proveedor_id:       proveedorEncontrado.id,
        p_qr_token:           proveedorEncontrado.qr_token,
        p_resultado:          resultado,
        p_observacion:        observacion || null,
        p_foto_url:           foto ?? null,
        p_lat:                gps?.lat ?? null,
        p_lng:                gps?.lng ?? null,
        p_offline:            false,
        p_visitado_at:        ahora,
        p_checklist:          JSON.stringify(checklistArr),
      })
      if (data?.ok) {
        setMsg('Visita registrada')
        resetVisita()
      } else {
        setMsg('Error al guardar')
      }
    } else {
      // Guardar offline
      const visitaLocal: VisitaLocal = {
        id:                 crypto.randomUUID(),
        establecimiento_id: estSeleccionado.id,
        proveedor_id:       proveedorEncontrado.id,
        qr_token:           proveedorEncontrado.qr_token,
        resultado,
        observacion,
        foto_url:           foto ?? undefined,
        lat:                gps?.lat,
        lng:                gps?.lng,
        offline:            true,
        visitado_at:        ahora,
        checklist:          checklistArr,
        sincronizado:       false,
      }
      const q = [...getQueue(), visitaLocal]
      saveQueue(q)
      setCola(q)
      setMsg('Guardado offline — se sincronizará al recuperar señal')
      resetVisita()
    }
    setTimeout(() => setMsg(''), 3000)
    setGuardando(false)
  }

  function resetVisita() {
    setProv(null); setResultado('CONFORME'); setObservacion('')
    setChecklistResp({}); setFoto(null); setQrInput('')
    setVista('escanear')
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
    <div className="min-h-screen bg-[#0d0f17] text-white max-w-sm mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Sistema Legajos</p>
          <h1 className="text-lg font-medium">App de auditoría</h1>
        </div>
        <div className="flex items-center gap-2">
          {pendientes > 0 && (
            <button onClick={() => setVista('cola')}
              className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-full">
              {pendientes} pendiente{pendientes > 1 ? 's' : ''}
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} title={online ? 'Online' : 'Offline'} />
        </div>
      </div>

      {/* Mensaje flash */}
      {msg && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-blue-300 text-sm">{sincronizando ? '⟳ Sincronizando...' : msg}</p>
        </div>
      )}

      {/* ── VISTA: INICIO ── */}
      {vista === 'inicio' && (
        <div className="space-y-3">
          <p className="text-zinc-500 text-sm mb-4">Seleccioná un establecimiento para auditar</p>
          {establecimientos.map(est => (
            <button key={est.id} onClick={() => seleccionarEst(est)}
              disabled={loadingSnap}
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
          {loadingSnap && (
            <p className="text-zinc-500 text-sm text-center py-4">Descargando snapshot...</p>
          )}
        </div>
      )}

      {/* ── VISTA: ESCANEAR ── */}
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

          {/* Input QR manual */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Escanear QR</p>
            <input
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && qrInput && buscarPorQR(qrInput)}
              placeholder="Ingresá o escaneá el token QR"
              className={inputCls}
            />
            <button
              onClick={() => qrInput && buscarPorQR(qrInput)}
              disabled={!qrInput}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              Buscar proveedor
            </button>
          </div>

          {/* Lista rápida de proveedores del snapshot */}
          {snapshot?.proveedores && snapshot.proveedores.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <p className="text-zinc-500 text-xs px-4 pt-3 pb-2 font-medium uppercase tracking-wide">Proveedores en el establecimiento</p>
              <div className="divide-y divide-white/[0.04]">
                {snapshot.proveedores.slice(0, 10).map(prov => (
                  <button key={prov.id} onClick={() => { setProv(prov); setVista('visita') }}
                    className="w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{prov.razon_social}</p>
                      <p className="text-zinc-600 text-xs">{prov.cuit}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      prov.habilitacion_estado === 'VIGENTE' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      prov.habilitacion_estado === 'DOC_PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {prov.habilitacion_estado ?? prov.estado}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA: REGISTRAR VISITA ── */}
      {vista === 'visita' && proveedorEncontrado && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setProv(null); setVista('escanear') }} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
            </button>
            <p className="font-medium text-sm">{proveedorEncontrado.razon_social}</p>
          </div>

          {/* Estado del proveedor */}
          <div className={`rounded-xl border px-4 py-3 ${
            proveedorEncontrado.habilitacion_estado === 'VIGENTE' ? 'bg-green-500/10 border-green-500/20' :
            proveedorEncontrado.habilitacion_estado === 'DOC_PENDIENTE' ? 'bg-yellow-500/10 border-yellow-500/20' :
            'bg-red-500/10 border-red-500/20'
          }`}>
            <p className={`text-sm font-medium ${
              proveedorEncontrado.habilitacion_estado === 'VIGENTE' ? 'text-green-400' :
              proveedorEncontrado.habilitacion_estado === 'DOC_PENDIENTE' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              Habilitación: {proveedorEncontrado.habilitacion_estado ?? proveedorEncontrado.estado}
            </p>
            {proveedorEncontrado.docs_vencidos > 0 && (
              <p className="text-red-400 text-xs mt-1">{proveedorEncontrado.docs_vencidos} documento(s) vencido(s)</p>
            )}
          </div>

          {/* Resultado */}
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

          {/* Checklist */}
          {snapshot?.checklist && snapshot.checklist.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Checklist de puntos</p>
              {snapshot.checklist.map(item => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm">{item.nombre}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: true, obs: prev[item.id]?.obs ?? '' } }))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          checklistResp[item.id]?.cumple === true ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
                        }`}>Sí</button>
                      <button
                        onClick={() => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: false, obs: prev[item.id]?.obs ?? '' } }))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          checklistResp[item.id]?.cumple === false ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-white/[0.03] text-zinc-500 border-white/[0.08]'
                        }`}>No</button>
                    </div>
                  </div>
                  {checklistResp[item.id]?.cumple === false && (
                    <input
                      value={checklistResp[item.id]?.obs ?? ''}
                      onChange={e => setChecklistResp(prev => ({ ...prev, [item.id]: { cumple: false, obs: e.target.value } }))}
                      placeholder="Observación del punto..."
                      className={inputCls + ' text-xs'}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Observación libre */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Observación general</p>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              rows={3}
              placeholder="Describí lo observado..."
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Foto */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Foto (opcional)</p>
            {foto ? (
              <div className="relative">
                <img src={foto} alt="foto" className="w-full h-40 object-cover rounded-xl"/>
                <button onClick={() => setFoto(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  Cambiar
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full bg-white/[0.03] border border-dashed border-white/[0.15] rounded-xl py-6 text-zinc-500 text-sm hover:border-white/30 transition-colors">
                Tocar para tomar o seleccionar foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden"/>
          </div>

          {/* Guardar */}
          <button onClick={guardarVisita} disabled={guardando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors">
            {guardando ? 'Guardando...' : online ? 'Guardar visita' : 'Guardar offline'}
          </button>

          {!online && (
            <p className="text-yellow-500 text-xs text-center">Sin conexión — se sincronizará automáticamente al recuperar señal</p>
          )}
        </div>
      )}

      {/* ── VISTA: COLA OFFLINE ── */}
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
                    {new Date(v.visitado_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
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
  )
}
