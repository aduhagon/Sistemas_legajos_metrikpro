'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import QRScanner from '@/components/QRScanner'

export default function EntradaEstablecimientoPage({ params }: { params: { token: string } }) {
  const [establecimiento, setEstablecimiento] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [tipoAccion, setTipoAccion] = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const [modoEntrada, setModoEntrada] = useState<'camara' | 'manual'>('camara')
  const [qrManual, setQrManual] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)

  useEffect(() => {
    supabase.from('establecimientos')
      .select('id, nombre, modo_acceso, tipos_establecimiento(icono, nombre)')
      .eq('qr_token', params.token)
      .eq('activo', true)
      .single()
      .then(({ data }) => {
        setEstablecimiento(data)
        setCargando(false)
        if (data) setCamaraActiva(true)
      })
  }, [params.token])

  useEffect(() => {
    if (resultado) {
      const t = setTimeout(() => {
        setResultado(null)
        setQrManual('')
        setCamaraActiva(modoEntrada === 'camara')
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [resultado, modoEntrada])

  useEffect(() => {
    setCamaraActiva(modoEntrada === 'camara' && !!establecimiento && !resultado)
  }, [modoEntrada, establecimiento, resultado])

  async function obtenerGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), { timeout: 5000, enableHighAccuracy: true }
      )
    })
  }

  async function procesarQR(qr: string) {
    if (!qr.trim()) return
    setProcesando(true)
    setCamaraActiva(false)

    const gps = await obtenerGPS()
    const token = qr.includes('/qr/') ? qr.split('/qr/').pop()! : qr.trim()

    if (tipoAccion === 'INGRESO') {
      const { data } = await supabase.rpc('validar_acceso_establecimiento', {
        p_qr_token_establecimiento: params.token,
        p_qr_token_proveedor: token,
        p_lat: gps?.lat ?? null,
        p_lng: gps?.lng ?? null,
      })
      setResultado(data)
    } else {
      const { data } = await supabase.rpc('registrar_egreso', {
        p_qr_token_proveedor: token,
        p_establecimiento_id: establecimiento?.id,
        p_lat: gps?.lat ?? null,
        p_lng: gps?.lng ?? null,
      })
      setResultado(data?.ok ? { valido: true } : { valido: false, motivo: data?.error })
    }
    setProcesando(false)
  }

  const motivoLabel: Record<string, string> = {
    RUBRO_NO_HABILITADO: 'Tu rubro no está habilitado para este establecimiento',
    HABILITACION_VENCIDA: 'Tu habilitación está vencida',
    VENCIDA: 'Tu habilitación está vencida',
    SUSPENDIDA: 'Tu acceso está suspendido',
    DOC_PENDIENTE: 'Tenés documentación pendiente',
  }

  if (cargando) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Cargando...</div>
    </div>
  )

  if (!establecimiento) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 text-center">
      <div>
        <p className="text-red-400 text-lg font-medium mb-2">QR no válido</p>
        <p className="text-zinc-500 text-sm">Este QR no corresponde a ningún establecimiento activo</p>
      </div>
    </div>
  )

  const tipo = establecimiento.tipos_establecimiento

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Info establecimiento */}
        <div className="text-center">
          {tipo && <p className="text-4xl mb-1">{tipo.icono}</p>}
          <h1 className="text-white font-medium text-xl">{establecimiento.nombre}</h1>
          {tipo && <p className="text-zinc-500 text-sm">{tipo.nombre}</p>}
        </div>

        {/* Toggle Ingreso/Egreso */}
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          <button onClick={() => setTipoAccion('INGRESO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'INGRESO' ? 'bg-green-600 text-white' : 'text-zinc-500'}`}>
            ↓ Ingreso
          </button>
          <button onClick={() => setTipoAccion('EGRESO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'EGRESO' ? 'bg-red-600 text-white' : 'text-zinc-500'}`}>
            ↑ Egreso
          </button>
        </div>

        {!resultado && (
          <>
            {/* Toggle cámara/manual */}
            <div className="flex gap-2">
              <button onClick={() => setModoEntrada('camara')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  modoEntrada === 'camara' ? 'bg-white/[0.08] text-white border-white/[0.15]' : 'text-zinc-500 border-white/[0.06]'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Usar cámara
              </button>
              <button onClick={() => setModoEntrada('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  modoEntrada === 'manual' ? 'bg-white/[0.08] text-white border-white/[0.15]' : 'text-zinc-500 border-white/[0.06]'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
                </svg>
                Ingresar código
              </button>
            </div>

            {modoEntrada === 'camara' && (
              <div>
                <QRScanner activo={camaraActiva} onScan={procesarQR} />
                {procesando && <p className="text-zinc-500 text-xs text-center mt-2">Validando...</p>}
              </div>
            )}

            {modoEntrada === 'manual' && (
              <form onSubmit={e => { e.preventDefault(); procesarQR(qrManual) }} className="space-y-2">
                <input value={qrManual} onChange={e => setQrManual(e.target.value)}
                  placeholder="Pegá el código de tu carnet QR..." autoFocus
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
                <button type="submit" disabled={procesando || !qrManual}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                  {procesando ? 'Validando...' : `Registrar ${tipoAccion === 'INGRESO' ? 'ingreso' : 'egreso'}`}
                </button>
              </form>
            )}
          </>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`rounded-2xl p-6 text-center border ${
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
                ? (tipoAccion === 'INGRESO' ? '¡Bienvenido!' : 'Egreso registrado')
                : 'Acceso denegado'}
            </h2>
            {resultado.razon_social && <p className="text-white font-medium">{resultado.razon_social}</p>}
            {!resultado.valido && resultado.motivo && (
              <p className="text-red-300 text-sm mt-2">
                {motivoLabel[resultado.motivo] ?? resultado.motivo}
              </p>
            )}
            <button onClick={() => { setResultado(null); setQrManual('') }}
              className="mt-4 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              Nuevo registro
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
