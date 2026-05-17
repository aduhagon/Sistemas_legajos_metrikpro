'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type Resultado = {
  valido: boolean
  razon_social?: string
  cuit?: string
  motivo?: string
  detalle?: string
  dentro_perimetro?: boolean | null
  fecha_venc?: string
  establecimiento?: string
}

export default function AccesoOperadorPage() {
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [estabSeleccionado, setEstabSeleccionado] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [tipoAccion, setTipoAccion] = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (resultado) {
      const t = setTimeout(() => {
        setResultado(null)
        setQrInput('')
        inputRef.current?.focus()
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [resultado])

  async function obtenerGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 3000 }
      )
    })
  }

  async function procesarQR(qr: string) {
    if (!estabSeleccionado || !qr.trim()) return
    setLoading(true)
    setResultado(null)

    const gps = await obtenerGPS()

    // Extraer token del QR (puede ser URL completa o solo el token)
    const token = qr.includes('/qr/') ? qr.split('/qr/').pop()! : qr.trim()

    if (tipoAccion === 'INGRESO') {
      const { data } = await supabase.rpc('validar_acceso', {
        p_qr_token_proveedor: token,
        p_establecimiento_id: estabSeleccionado,
        p_lat: gps?.lat ?? null,
        p_lng: gps?.lng ?? null,
      })
      setResultado(data)
    } else {
      const { data } = await supabase.rpc('registrar_egreso', {
        p_qr_token_proveedor: token,
        p_establecimiento_id: estabSeleccionado,
        p_lat: gps?.lat ?? null,
        p_lng: gps?.lng ?? null,
      })
      setResultado(data?.ok ? { valido: true, razon_social: 'Egreso registrado' } : { valido: false, motivo: data?.error })
    }

    setLoading(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    procesarQR(qrInput)
  }

  const estabActual = establecimientos.find(e => e.id === estabSeleccionado)

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

      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full">

        {/* Selector de establecimiento */}
        <div className="w-full mb-6">
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
        <div className="flex gap-1 w-full mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          <button onClick={() => setTipoAccion('INGRESO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'INGRESO' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            ↓ Ingreso
          </button>
          <button onClick={() => setTipoAccion('EGRESO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tipoAccion === 'EGRESO' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            ↑ Egreso
          </button>
        </div>

        {/* Input QR */}
        {estabSeleccionado && (
          <form onSubmit={handleSubmit} className="w-full mb-4">
            <label className="block text-zinc-400 text-xs mb-1.5">
              Escaneá o ingresá el QR del proveedor
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="Apuntá la cámara al QR..."
                autoFocus
                className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              />
              <button type="submit" disabled={loading || !qrInput}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 rounded-lg transition-colors">
                {loading ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`w-full rounded-2xl p-6 text-center border ${
            resultado.valido
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-red-500/5 border-red-500/30'
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

            <h2 className={`text-xl font-semibold mb-1 ${resultado.valido ? 'text-green-400' : 'text-red-400'}`}>
              {resultado.valido ? (tipoAccion === 'INGRESO' ? 'Ingreso autorizado' : 'Egreso registrado') : 'Acceso denegado'}
            </h2>

            {resultado.razon_social && resultado.razon_social !== 'Egreso registrado' && (
              <p className="text-white font-medium">{resultado.razon_social}</p>
            )}
            {resultado.cuit && <p className="text-zinc-500 text-sm">CUIT {resultado.cuit}</p>}

            {!resultado.valido && resultado.motivo && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                <p className="text-red-300 text-sm">
                  {resultado.motivo === 'RUBRO_NO_HABILITADO' ? 'Rubro no habilitado para este establecimiento' :
                   resultado.motivo === 'HABILITACION_VENCIDA' ? 'Habilitación vencida' :
                   resultado.motivo === 'VENCIDA' ? 'Habilitación vencida' :
                   resultado.motivo === 'SUSPENDIDA' ? 'Proveedor suspendido' :
                   resultado.motivo === 'DOC_PENDIENTE' ? 'Documentación pendiente' :
                   resultado.motivo}
                </p>
                {resultado.detalle && <p className="text-red-400 text-xs mt-1">{resultado.detalle}</p>}
              </div>
            )}

            {resultado.valido && resultado.dentro_perimetro === false && (
              <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">
                <p className="text-yellow-400 text-xs">⚠ GPS fuera del perímetro configurado — registrado con anomalía</p>
              </div>
            )}

            <p className="text-zinc-700 text-xs mt-4">Se cierra automáticamente en 4 segundos...</p>
          </div>
        )}

        {/* Instrucciones */}
        {!resultado && estabSeleccionado && (
          <p className="text-zinc-600 text-xs text-center mt-4">
            {tipoAccion === 'INGRESO'
              ? 'Escaneá el carnet QR del contratista para registrar el ingreso'
              : 'Escaneá el carnet QR del contratista para registrar el egreso'}
          </p>
        )}

      </div>
    </div>
  )
}
