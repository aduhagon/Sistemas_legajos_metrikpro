// src/app/acceso/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import QRScanner from '@/components/QRScanner'
import ExcepcionAcceso from '@/components/ExcepcionAcceso'

type Resultado = {
  valido: boolean
  razon_social?: string
  cuit?: string
  motivo?: string
  detalle?: string
  dentro_perimetro?: boolean | null
  fecha_venc?: string
  // Personal habilitado
  tipo?: 'PERSONAL'
  nombre?: string
  cuil?: string
  vigencia_hasta?: string
  establecimientos?: { id: string; nombre: string }[]
}

export default function AccesoOperadorPage() {
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [estabSeleccionado, setEstabSeleccionado] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [tipoAccion, setTipoAccion] = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const [modoEntrada, setModoEntrada] = useState<'camara' | 'manual'>('camara')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [mostrarExcepcion, setMostrarExcepcion] = useState(false)
  const [excepcionOk, setExcepcionOk] = useState<{ razon_social: string; autorizado_por: string } | null>(null)

  useEffect(() => {
    supabase.from('establecimientos')
      .select('id, nombre, modo_acceso, tipos_establecimiento(icono, nombre)')
      .eq('activo', true)
      .in('modo_acceso', ['OPERADOR', 'AMBOS'])
      .then(({ data }) => {
        if (data) setEstablecimientos(data)
        if (data?.length === 1) setEstabSeleccionado(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (resultado && !mostrarExcepcion) {
      const t = setTimeout(() => {
        setResultado(null)
        setQrInput('')
        setQrToken('')
        setExcepcionOk(null)
        setCamaraActiva(modoEntrada === 'camara')
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [resultado, mostrarExcepcion, modoEntrada])

  useEffect(() => {
    setCamaraActiva(modoEntrada === 'camara' && !!estabSeleccionado && !resultado)
  }, [modoEntrada, estabSeleccionado, resultado])

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
    setCamaraActiva(false)
    setMostrarExcepcion(false)
    setExcepcionOk(null)

    const token = qr.includes('/qr/') ? qr.split('/qr/').pop()!
                : qr.includes('/qr-personal/') ? qr.split('/qr-personal/').pop()!
                : qr.trim()
    setQrToken(token)

    // ── Paso 1: intentar como personal habilitado ──────────────────────────
    const { data: resPersonal } = await supabase.rpc('validar_qr_personal', {
      p_qr_token:           token,
      p_establecimiento_id: estabSeleccionado,
    })

    // Si el token pertenece a personal (encontrado en la tabla personal_habilitado)
    // la función devuelve nombre y cuil — lo usamos para distinguirlo
    if (resPersonal && (resPersonal.nombre !== undefined)) {
      setResultado(resPersonal as Resultado)
      setLoading(false)
      return
    }

    // ── Paso 2: tratar como QR de proveedor ───────────────────────────────
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
    setLoading(false)
  }

  function resetear() {
    setResultado(null)
    setQrInput('')
    setQrToken('')
    setExcepcionOk(null)
    setMostrarExcepcion(false)
    setCamaraActiva(modoEntrada === 'camara')
  }

  const motivoLabel: Record<string, string> = {
    RUBRO_NO_HABILITADO:              'Rubro no habilitado para este establecimiento',
    HABILITACION_VENCIDA:             'Habilitación vencida',
    VENCIDA:                          'Habilitación vencida',
    SUSPENDIDA:                       'Proveedor suspendido',
    DOC_PENDIENTE:                    'Documentación pendiente',
    EQUIPOS_VENCIDOS:                 'Equipos con documentación vencida',
    PERSONA_INACTIVA:                 'Persona dada de baja',
    PERMISO_VENCIDO:                  'Permiso de acceso vencido',
    ESTABLECIMIENTO_NO_HABILITADO:    'No habilitado para este establecimiento',
    'QR no reconocido':               'QR no reconocido',
  }

  const esPersonal = resultado?.tipo === 'PERSONAL'

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Header */}
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
        <a href="/dashboard" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Panel →</a>
      </div>

      <div className="flex-1 flex flex-col items-center p-4 max-w-sm mx-auto w-full pt-6 space-y-4">

        {/* Establecimiento */}
        <div className="w-full">
          <label className="block text-zinc-400 text-xs mb-1.5">Establecimiento</label>
          <select value={estabSeleccionado} onChange={e => setEstabSeleccionado(e.target.value)}
            className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
            <option value="">Seleccioná un establecimiento</option>
            {establecimientos.map(e => (
              <option key={e.id} value={e.id}>
                {e.tipos_establecimiento?.icono} {e.nombre}
              </option>
            ))}
          </select>
        </div>

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

        {estabSeleccionado && !resultado && (
          <>
            {/* Toggle cámara/manual */}
            <div className="flex gap-2 w-full">
              <button onClick={() => setModoEntrada('camara')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  modoEntrada === 'camara' ? 'bg-white/[0.08] text-white border-white/[0.15]' : 'text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Cámara
              </button>
              <button onClick={() => setModoEntrada('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  modoEntrada === 'manual' ? 'bg-white/[0.08] text-white border-white/[0.15]' : 'text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/>
                  <line x1="14" y1="18" x2="21" y2="18"/><line x1="14" y1="21" x2="21" y2="21"/>
                </svg>
                Manual
              </button>
            </div>

            {modoEntrada === 'camara' && (
              <div className="w-full">
                <QRScanner activo={camaraActiva} onScan={procesarQR} />
                {loading && <p className="text-zinc-500 text-xs text-center mt-2">Validando...</p>}
              </div>
            )}

            {modoEntrada === 'manual' && (
              <form onSubmit={e => { e.preventDefault(); procesarQR(qrInput) }} className="w-full space-y-2">
                <input value={qrInput} onChange={e => setQrInput(e.target.value)}
                  placeholder="Pegá o escribí el token del QR..." autoFocus
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                <button type="submit" disabled={loading || !qrInput}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                  {loading ? 'Validando...' : 'Validar QR'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ── RESULTADO PERSONAL HABILITADO ── */}
        {resultado && esPersonal && !excepcionOk && (
          <div className={`w-full rounded-2xl p-6 text-center border ${
            resultado.valido
              ? 'bg-blue-500/5 border-blue-500/30'
              : 'bg-red-500/5 border-red-500/30'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              resultado.valido ? 'bg-blue-500/10' : 'bg-red-500/10'
            }`}>
              {resultado.valido ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>

            {/* Badge tipo */}
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full mb-3">
              🪪 Personal habilitado
            </div>

            <h2 className={`text-xl font-semibold mb-1 ${resultado.valido ? 'text-blue-300' : 'text-red-400'}`}>
              {resultado.valido ? 'Acceso habilitado' : 'Acceso denegado'}
            </h2>

            {/* Nombre grande para verificación visual */}
            {resultado.nombre && (
              <p className="text-white font-bold text-2xl mt-2">{resultado.nombre}</p>
            )}
            {resultado.cuil && (
              <p className="text-zinc-400 text-base font-mono mt-1">CUIL {resultado.cuil}</p>
            )}

            {resultado.valido && resultado.vigencia_hasta && (
              <p className="text-blue-400/70 text-xs mt-2">
                Permiso vigente hasta{' '}
                {new Date(resultado.vigencia_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
              </p>
            )}

            {!resultado.valido && resultado.motivo && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                <p className="text-red-300 text-sm font-medium">
                  {motivoLabel[resultado.motivo] ?? resultado.motivo}
                </p>
                {resultado.motivo === 'PERMISO_VENCIDO' && resultado.vigencia_hasta && (
                  <p className="text-red-400/70 text-xs mt-1">
                    Venció el {new Date(resultado.vigencia_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
            )}

            {resultado.valido && (
              <p className="text-zinc-700 text-xs mt-4">Se cierra en 5 segundos...</p>
            )}
            {!resultado.valido && (
              <button onClick={resetear} className="mt-3 text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
                Escanear otro QR
              </button>
            )}
          </div>
        )}

        {/* ── RESULTADO PROVEEDOR ── */}
        {resultado && !esPersonal && !excepcionOk && (
          <div className={`w-full rounded-2xl p-6 text-center border ${
            resultado.valido ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              resultado.valido ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {resultado.valido ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
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
                <p className="text-red-300 text-sm font-medium">
                  {motivoLabel[resultado.motivo] ?? resultado.motivo}
                </p>
                {resultado.detalle && <p className="text-red-400 text-xs mt-1">{resultado.detalle}</p>}
              </div>
            )}

            {resultado.valido && resultado.dentro_perimetro === false && (
              <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">
                <p className="text-yellow-400 text-xs">⚠ GPS fuera del perímetro — registrado con anomalía</p>
              </div>
            )}

            {/* Botón excepción — solo proveedores denegados en ingreso */}
            {!resultado.valido && tipoAccion === 'INGRESO' && (
              <button
                onClick={() => setMostrarExcepcion(true)}
                className="mt-4 w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Registrar ingreso de excepción
              </button>
            )}

            {resultado.valido && (
              <p className="text-zinc-700 text-xs mt-4">Se cierra en 5 segundos...</p>
            )}
            {!resultado.valido && (
              <button onClick={resetear} className="mt-3 text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
                Escanear otro QR
              </button>
            )}
          </div>
        )}

        {/* ── CONFIRMACIÓN EXCEPCIÓN ── */}
        {excepcionOk && (
          <div className="w-full rounded-2xl p-6 text-center border bg-amber-500/5 border-amber-500/30">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-amber-300 mb-1">Ingreso de excepción registrado</h2>
            <p className="text-white font-medium">{excepcionOk.razon_social}</p>
            <p className="text-zinc-400 text-sm mt-1">
              Autorizado por: <span className="text-amber-300">{excepcionOk.autorizado_por}</span>
            </p>
            <p className="text-zinc-600 text-xs mt-3">El supervisor fue notificado</p>
            <button onClick={resetear} className="mt-4 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              Escanear otro QR
            </button>
          </div>
        )}

      </div>

      {/* Modal excepción */}
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
