// src/app/acceso/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import QRScanner from '@/components/QRScanner'
import ExcepcionAcceso from '@/components/ExcepcionAcceso'

type Vista = 'dashboard' | 'scanner' | 'historial' | 'excepciones'

type Resultado = {
  valido: boolean
  razon_social?: string
  cuit?: string
  motivo?: string
  detalle?: string
  dentro_perimetro?: boolean | null
  tipo?: 'PERSONAL'
  nombre?: string
  cuil?: string
  vigencia_hasta?: string
}

type RegistroAcceso = {
  id: string
  tipo: string
  created_at: string
  es_excepcion?: boolean
  excepcion_autorizado_por?: string
  excepcion_justificacion?: string
  habilitaciones?: { proveedores?: { razon_social: string; cuit: string } } | null
}

const motivoLabel: Record<string, string> = {
  RUBRO_NO_HABILITADO:           'Rubro no habilitado',
  HABILITACION_VENCIDA:          'Habilitación vencida',
  VENCIDA:                       'Habilitación vencida',
  SUSPENDIDA:                    'Proveedor suspendido',
  DOC_PENDIENTE:                 'Documentación pendiente',
  EQUIPOS_VENCIDOS:              'Equipos con docs vencidas',
  PERSONA_INACTIVA:              'Persona dada de baja',
  PERMISO_VENCIDO:               'Permiso vencido',
  ESTABLECIMIENTO_NO_HABILITADO: 'No habilitado aquí',
  'QR no reconocido':            'QR no reconocido',
}

export default function AccesoOperadorPage() {
  const [vista, setVista]               = useState<Vista>('dashboard')
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [estabSeleccionado, setEstabSeleccionado] = useState('')
  const [qrInput, setQrInput]           = useState('')
  const [qrToken, setQrToken]           = useState('')
  const [resultado, setResultado]       = useState<Resultado | null>(null)
  const [loading, setLoading]           = useState(false)
  const [tipoAccion, setTipoAccion]     = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const [modoEntrada, setModoEntrada]   = useState<'camara' | 'manual'>('camara')
  const [mostrarExcepcion, setMostrarExcepcion] = useState(false)
  const [excepcionOk, setExcepcionOk]   = useState<{ razon_social: string; autorizado_por: string } | null>(null)

  const [ingresosHoy, setIngresosHoy]     = useState(0)
  const [egresosHoy, setEgresosHoy]       = useState(0)
  const [excepcionesHoy, setExcepcionesHoy] = useState(0)
  const [historial, setHistorial]         = useState<RegistroAcceso[]>([])
  const [excepciones, setExcepciones]     = useState<RegistroAcceso[]>([])
  const [loadingData, setLoadingData]     = useState(true)

  const hoyStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    // Cargar establecimientos
    ;(async () => {
      try {
        const { data } = await supabase
          .from('establecimientos')
          .select('id, nombre, modo_acceso, tipos_establecimiento(icono, nombre)')
          .eq('activo', true)
          .in('modo_acceso', ['OPERADOR', 'AMBOS'])
        if (data) {
          setEstablecimientos(data)
          if (data.length === 1) setEstabSeleccionado(data[0].id)
        }
      } catch {}
    })()

    cargarStats()
  }, [])

  async function cargarStats() {
    setLoadingData(true)
    try {
      const hoyStart = `${hoyStr}T00:00:00`
      const hoyEnd   = `${hoyStr}T23:59:59`

      const { data: accesos } = await supabase
        .from('registros_acceso')
        .select('id, tipo, created_at, es_excepcion, excepcion_autorizado_por, excepcion_justificacion, habilitaciones(proveedores(razon_social, cuit))')
        .gte('created_at', hoyStart)
        .lte('created_at', hoyEnd)
        .order('created_at', { ascending: false })
        .limit(100)

      const lista = (accesos ?? []) as RegistroAcceso[]
      setIngresosHoy(lista.filter(a => a.tipo === 'INGRESO' && !a.es_excepcion).length)
      setEgresosHoy(lista.filter(a => a.tipo === 'EGRESO').length)
      const excs = lista.filter(a => a.es_excepcion)
      setExcepcionesHoy(excs.length)
      setHistorial(lista)
      setExcepciones(excs)
    } catch {
      // silencioso — no romper la página si falla
    }
    setLoadingData(false)
  }

  // Auto-cerrar resultado después de 5s
  useEffect(() => {
    if (resultado && !mostrarExcepcion) {
      const t = setTimeout(() => {
        setResultado(null)
        setQrInput('')
        setQrToken('')
        setExcepcionOk(null)
        cargarStats()
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [resultado, mostrarExcepcion])

  async function obtenerGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), { timeout: 3000 }
      )
    })
  }

  async function procesarQR(qr: string) {
    if (!estabSeleccionado || !qr.trim()) return
    setLoading(true)
    setResultado(null)
    setMostrarExcepcion(false)
    setExcepcionOk(null)

    const token = qr.includes('/qr-personal/') ? qr.split('/qr-personal/').pop()!
                : qr.includes('/qr/') ? qr.split('/qr/').pop()!
                : qr.trim()
    setQrToken(token)

    try {
      // Paso 1: intentar personal habilitado
      const { data: resPersonal } = await supabase.rpc('validar_qr_personal', {
        p_qr_token:           token,
        p_establecimiento_id: estabSeleccionado,
      })
      if (resPersonal && resPersonal.nombre !== undefined) {
        setResultado(resPersonal as Resultado)
        setLoading(false)
        return
      }

      // Paso 2: proveedor
      const gps = await obtenerGPS()
      if (tipoAccion === 'INGRESO') {
        const { data } = await supabase.rpc('validar_acceso', {
          p_qr_token_proveedor: token,
          p_establecimiento_id: estabSeleccionado,
          p_lat:  gps?.lat ?? null,
          p_lng:  gps?.lng ?? null,
        })
        setResultado(data)
      } else {
        const { data } = await supabase.rpc('registrar_egreso', {
          p_qr_token_proveedor: token,
          p_establecimiento_id: estabSeleccionado,
          p_lat:  gps?.lat ?? null,
          p_lng:  gps?.lng ?? null,
        })
        setResultado(data?.ok
          ? { valido: true, razon_social: 'Egreso registrado' }
          : { valido: false, motivo: data?.error }
        )
      }
    } catch {
      setResultado({ valido: false, motivo: 'Error al validar QR' })
    }
    setLoading(false)
  }

  function resetearScanner() {
    setResultado(null)
    setQrInput('')
    setQrToken('')
    setExcepcionOk(null)
    setMostrarExcepcion(false)
    cargarStats()
  }

  function volverDashboard() {
    resetearScanner()
    setVista('dashboard')
  }

  const esPersonal = resultado?.tipo === 'PERSONAL'
  const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  if (vista === 'dashboard') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="font-medium text-sm">Control de acceso</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs">{horaActual}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors flex items-center gap-1"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Salir
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 py-5 gap-4">

          {/* Establecimiento */}
          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Establecimiento</label>
            <select value={estabSeleccionado} onChange={e => setEstabSeleccionado(e.target.value)}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
              <option value="">Seleccioná un establecimiento</option>
              {establecimientos.map(e => (
                <option key={e.id} value={e.id}>{e.tipos_establecimiento?.icono} {e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Stats del día */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{loadingData ? '–' : ingresosHoy}</p>
              <p className="text-green-400/70 text-xs mt-1">Ingresos</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{loadingData ? '–' : egresosHoy}</p>
              <p className="text-red-400/70 text-xs mt-1">Egresos</p>
            </div>
            <div className={`border rounded-2xl p-4 text-center ${excepcionesHoy > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/[0.03] border-white/[0.08]'}`}>
              <p className={`text-3xl font-bold ${excepcionesHoy > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {loadingData ? '–' : excepcionesHoy}
              </p>
              <p className={`text-xs mt-1 ${excepcionesHoy > 0 ? 'text-amber-400/70' : 'text-zinc-600'}`}>Excepciones</p>
            </div>
          </div>

          {/* Botón principal */}
          <button
            onClick={() => { if (estabSeleccionado) setVista('scanner') }}
            disabled={!estabSeleccionado}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-2xl py-5 text-lg transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
              <rect x="7" y="7" width="3" height="3" rx="0.5"/>
              <rect x="14" y="7" width="3" height="3" rx="0.5"/>
              <rect x="7" y="14" width="3" height="3" rx="0.5"/>
              <path d="M14 14h1v1m2-1h1v3h-3v-1"/>
            </svg>
            Escanear QR
          </button>

          {/* Botones secundarios */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setVista('historial')}
              className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-2xl py-4 text-sm font-medium text-zinc-300 transition-all active:scale-95 flex flex-col items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
              </svg>
              Historial
              {historial.length > 0 && <span className="text-xs text-zinc-500">{historial.length} hoy</span>}
            </button>

            <button onClick={() => setVista('excepciones')}
              className={`rounded-2xl py-4 text-sm font-medium transition-all active:scale-95 flex flex-col items-center gap-2 border ${
                excepcionesHoy > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:bg-white/[0.08]'
              }`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Excepciones
              {excepcionesHoy > 0 && <span className="text-xs text-amber-400/70">{excepcionesHoy} hoy</span>}
            </button>
          </div>

          {/* Últimos 3 registros */}
          {historial.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">Últimos registros</p>
                <button onClick={() => setVista('historial')} className="text-xs text-blue-400 hover:text-blue-300">Ver todos →</button>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {historial.slice(0, 3).map(r => {
                  const prov = (r.habilitaciones as any)?.proveedores
                  return (
                    <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${r.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {r.tipo === 'INGRESO' ? '↓' : '↑'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{prov?.razon_social ?? '—'}</p>
                        <p className="text-zinc-600 text-xs">{r.tipo}</p>
                      </div>
                      <span className="text-zinc-600 text-xs shrink-0">
                        {new Date(r.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!estabSeleccionado && (
            <p className="text-zinc-600 text-xs text-center">Seleccioná un establecimiento para escanear</p>
          )}
        </div>
      </div>
    )
  }

  // ── SCANNER ───────────────────────────────────────────────────────────────
  if (vista === 'scanner') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <button onClick={volverDashboard} className="text-zinc-400 hover:text-white p-1 -ml-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="font-medium text-sm">Escanear QR</span>
          <span className="text-zinc-500 text-xs ml-auto truncate max-w-[140px]">
            {establecimientos.find(e => e.id === estabSeleccionado)?.nombre}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center max-w-sm mx-auto w-full px-4 pt-4 gap-4">
          {/* Toggle Ingreso/Egreso */}
          <div className="flex gap-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <button onClick={() => setTipoAccion('INGRESO')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'INGRESO' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              ↓ Ingreso
            </button>
            <button onClick={() => setTipoAccion('EGRESO')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'EGRESO' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              ↑ Egreso
            </button>
          </div>

          {/* Toggle cámara/manual */}
          <div className="flex gap-2 w-full">
            {(['camara', 'manual'] as const).map(modo => (
              <button key={modo} onClick={() => setModoEntrada(modo)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  modoEntrada === modo ? 'bg-white/[0.08] text-white border-white/[0.15]' : 'text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                }`}>
                {modo === 'camara' ? '📷' : '⌨️'} {modo === 'camara' ? 'Cámara' : 'Manual'}
              </button>
            ))}
          </div>

          {/* Scanner o resultado */}
          {!resultado ? (
            <>
              {modoEntrada === 'camara' && (
                <div className="w-full">
                  <QRScanner activo={!resultado} onScan={procesarQR} />
                  {loading && <p className="text-zinc-500 text-xs text-center mt-2">Validando...</p>}
                </div>
              )}
              {modoEntrada === 'manual' && (
                <form onSubmit={e => { e.preventDefault(); procesarQR(qrInput) }} className="w-full space-y-2">
                  <input value={qrInput} onChange={e => setQrInput(e.target.value)}
                    placeholder="Pegá o escribí el token del QR..." autoFocus
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60"/>
                  <button type="submit" disabled={loading || !qrInput}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                    {loading ? 'Validando...' : 'Validar QR'}
                  </button>
                </form>
              )}
            </>
          ) : esPersonal ? (
            /* Resultado personal */
            <div className={`w-full rounded-2xl p-6 text-center border ${resultado.valido ? 'bg-blue-500/5 border-blue-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${resultado.valido ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                <span className="text-3xl">{resultado.valido ? '👤' : '✗'}</span>
              </div>
              <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full mb-3">
                🪪 Personal habilitado
              </span>
              <h2 className={`text-xl font-semibold mb-1 ${resultado.valido ? 'text-blue-300' : 'text-red-400'}`}>
                {resultado.valido ? 'Acceso habilitado' : 'Acceso denegado'}
              </h2>
              {resultado.nombre && <p className="text-white font-bold text-2xl mt-2">{resultado.nombre}</p>}
              {resultado.cuil  && <p className="text-zinc-400 font-mono mt-1">CUIL {resultado.cuil}</p>}
              {resultado.valido && resultado.vigencia_hasta && (
                <p className="text-blue-400/70 text-xs mt-2">
                  Vigente hasta {new Date(resultado.vigencia_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
                </p>
              )}
              {!resultado.valido && resultado.motivo && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  <p className="text-red-300 text-sm">{motivoLabel[resultado.motivo] ?? resultado.motivo}</p>
                </div>
              )}
              {resultado.valido
                ? <p className="text-zinc-700 text-xs mt-4">Se cierra en 5 segundos...</p>
                : <button onClick={resetearScanner} className="mt-3 text-zinc-600 hover:text-zinc-400 text-xs">Escanear otro</button>
              }
            </div>
          ) : (
            /* Resultado proveedor */
            <div className={`w-full rounded-2xl p-6 text-center border ${resultado.valido ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl ${resultado.valido ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {resultado.valido ? '✓' : '✗'}
              </div>
              <h2 className={`text-xl font-semibold mb-2 ${resultado.valido ? 'text-green-400' : 'text-red-400'}`}>
                {resultado.valido
                  ? (tipoAccion === 'INGRESO' ? 'Ingreso autorizado' : 'Egreso registrado')
                  : 'Acceso denegado'}
              </h2>
              {resultado.razon_social && resultado.razon_social !== 'Egreso registrado' && (
                <p className="text-white font-medium text-lg">{resultado.razon_social}</p>
              )}
              {resultado.cuit && <p className="text-zinc-400 text-sm">CUIT {resultado.cuit}</p>}
              {!resultado.valido && resultado.motivo && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  <p className="text-red-300 text-sm font-medium">{motivoLabel[resultado.motivo] ?? resultado.motivo}</p>
                </div>
              )}
              {!resultado.valido && tipoAccion === 'INGRESO' && (
                <button onClick={() => setMostrarExcepcion(true)}
                  className="mt-4 w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium py-3 rounded-xl transition-colors">
                  ⚠ Registrar excepción
                </button>
              )}
              {excepcionOk && (
                <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-amber-300 text-sm font-medium">Excepción registrada</p>
                  <p className="text-zinc-400 text-xs mt-1">Autorizado: {excepcionOk.autorizado_por}</p>
                </div>
              )}
              {resultado.valido
                ? <p className="text-zinc-700 text-xs mt-4">Se cierra en 5 segundos...</p>
                : <button onClick={resetearScanner} className="mt-3 text-zinc-600 hover:text-zinc-400 text-xs">Escanear otro</button>
              }
            </div>
          )}
        </div>

        {mostrarExcepcion && resultado && (
          <ExcepcionAcceso
            qrToken={qrToken}
            establecimientoId={estabSeleccionado}
            motivoBloqueo={resultado.motivo ?? 'DESCONOCIDO'}
            razonSocial={resultado.razon_social}
            onExcepcionRegistrada={(data) => {
              setMostrarExcepcion(false)
              setExcepcionOk(data)
              setResultado(null)
            }}
            onCancelar={() => setMostrarExcepcion(false)}
          />
        )}
      </div>
    )
  }

  // ── HISTORIAL ─────────────────────────────────────────────────────────────
  if (vista === 'historial') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <button onClick={volverDashboard} className="text-zinc-400 hover:text-white p-1 -ml-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="font-medium text-sm">Historial de hoy</span>
          <span className="ml-auto text-zinc-500 text-xs">{historial.length} registros</span>
        </div>
        <div className="max-w-sm mx-auto w-full px-4 py-4">
          {historial.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-12">Sin registros por el momento</p>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {historial.map(r => {
                  const prov = (r.habilitaciones as any)?.proveedores
                  return (
                    <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold ${r.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {r.tipo === 'INGRESO' ? '↓' : '↑'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{prov?.razon_social ?? '—'}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-zinc-600 text-xs">{r.tipo}</p>
                          {r.es_excepcion && <span className="text-amber-400 text-xs">⚠ excepción</span>}
                        </div>
                      </div>
                      <span className="text-zinc-500 text-xs shrink-0">
                        {new Date(r.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── EXCEPCIONES ───────────────────────────────────────────────────────────
  if (vista === 'excepciones') {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <button onClick={volverDashboard} className="text-zinc-400 hover:text-white p-1 -ml-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="font-medium text-sm">Excepciones de hoy</span>
          <span className="ml-auto text-zinc-500 text-xs">{excepciones.length} registros</span>
        </div>
        <div className="max-w-sm mx-auto w-full px-4 py-4">
          {excepciones.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-zinc-500 text-sm">Sin excepciones hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {excepciones.map(exc => {
                const prov = (exc.habilitaciones as any)?.proveedores
                return (
                  <div key={exc.id} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-white font-medium text-sm">{prov?.razon_social ?? '—'}</p>
                      <span className="text-amber-400/70 text-xs shrink-0 ml-2">
                        {new Date(exc.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {exc.excepcion_autorizado_por && (
                      <p className="text-zinc-400 text-xs mb-1">
                        Autorizado: <span className="text-amber-300">{exc.excepcion_autorizado_por}</span>
                      </p>
                    )}
                    {exc.excepcion_justificacion && (
                      <p className="text-zinc-500 text-xs italic">"{exc.excepcion_justificacion}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
