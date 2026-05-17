'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { QRCodeSVG } from 'qrcode.react'

export default function EntradaEstablecimientoPage({ params }: { params: { token: string } }) {
  const [establecimiento, setEstablecimiento] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [qrProveedor, setQrProveedor] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [tipoAccion, setTipoAccion] = useState<'INGRESO' | 'EGRESO'>('INGRESO')

  useEffect(() => {
    supabase.from('establecimientos')
      .select('id, nombre, modo_acceso, tipos_establecimiento(icono, nombre)')
      .eq('qr_token', params.token)
      .eq('activo', true)
      .single()
      .then(({ data }) => {
        setEstablecimiento(data)
        setCargando(false)
      })
  }, [params.token])

  async function obtenerGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: true }
      )
    })
  }

  async function registrarAcceso() {
    if (!qrProveedor.trim()) return
    setProcesando(true)

    const gps = await obtenerGPS()
    const token = qrProveedor.includes('/qr/') ? qrProveedor.split('/qr/').pop()! : qrProveedor.trim()

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

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Cargando...</div>
      </div>
    )
  }

  if (!establecimiento) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg font-medium mb-2">QR no válido</p>
          <p className="text-zinc-500 text-sm">Este QR no corresponde a ningún establecimiento activo</p>
        </div>
      </div>
    )
  }

  const tipo = establecimiento.tipos_establecimiento

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Info establecimiento */}
        <div className="text-center mb-8">
          {tipo && <p className="text-4xl mb-2">{tipo.icono}</p>}
          <h1 className="text-white font-medium text-xl">{establecimiento.nombre}</h1>
          {tipo && <p className="text-zinc-500 text-sm">{tipo.nombre}</p>}
        </div>

        {!resultado ? (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <p className="text-zinc-400 text-sm text-center">
              Ingresá el código de tu carnet QR para registrar tu {tipoAccion === 'INGRESO' ? 'ingreso' : 'egreso'}
            </p>

            {/* Toggle */}
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

            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Tu código QR</label>
              <input value={qrProveedor} onChange={e => setQrProveedor(e.target.value)}
                placeholder="Escaneá tu carnet QR..."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
            </div>

            <button onClick={registrarAcceso} disabled={procesando || !qrProveedor}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg py-3 text-sm transition-colors">
              {procesando ? 'Procesando...' : `Registrar ${tipoAccion === 'INGRESO' ? 'ingreso' : 'egreso'}`}
            </button>

            <p className="text-zinc-700 text-xs text-center">
              También podés ir a{' '}
              <a href="/proveedor/documentos" className="text-blue-400 hover:text-blue-300 transition-colors">
                tu portal
              </a>
              {' '}y mostrar tu QR al operador
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl p-6 text-center border ${
            resultado.valido ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              resultado.valido ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {resultado.valido ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${resultado.valido ? 'text-green-400' : 'text-red-400'}`}>
              {resultado.valido
                ? (tipoAccion === 'INGRESO' ? '¡Bienvenido!' : 'Egreso registrado')
                : 'Acceso denegado'}
            </h2>
            {resultado.razon_social && <p className="text-white">{resultado.razon_social}</p>}
            {!resultado.valido && resultado.motivo && (
              <p className="text-red-300 text-sm mt-2">
                {resultado.motivo === 'RUBRO_NO_HABILITADO' ? 'Tu rubro no está habilitado para este establecimiento' :
                 resultado.motivo === 'HABILITACION_VENCIDA' ? 'Tu habilitación está vencida' :
                 resultado.motivo === 'DOC_PENDIENTE' ? 'Tenés documentación pendiente' :
                 resultado.motivo}
              </p>
            )}
            <button onClick={() => { setResultado(null); setQrProveedor('') }}
              className="mt-4 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              Nuevo registro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
