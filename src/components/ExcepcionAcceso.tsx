// src/components/ExcepcionAcceso.tsx
// FUNC-001: Modal de ingreso de excepción para el portero
// El portero registra quién autorizó verbalmente y una justificación.
// El sistema notifica automáticamente al supervisor.

'use client'

import { useState } from 'react'

type Props = {
  qrToken: string
  establecimientoId: string
  motivoBloqueo: string
  razonSocial?: string
  lat?: number | null
  lng?: number | null
  onExcepcionRegistrada: (data: { razon_social: string; autorizado_por: string }) => void
  onCancelar: () => void
}

const MOTIVO_LABEL: Record<string, string> = {
  DOC_PENDIENTE:       'Documentación pendiente / vencida',
  EQUIPOS_VENCIDOS:    'Equipos con documentación vencida',
  VENCIDA:             'Habilitación vencida',
  SUSPENDIDA:          'Habilitación suspendida',
  RUBRO_NO_HABILITADO: 'Rubro no habilitado para este establecimiento',
  QR_NO_RECONOCIDO:    'QR no reconocido',
}

export default function ExcepcionAcceso({
  qrToken,
  establecimientoId,
  motivoBloqueo,
  razonSocial,
  lat,
  lng,
  onExcepcionRegistrada,
  onCancelar,
}: Props) {
  const [autorizadoPor, setAutorizadoPor] = useState('')
  const [justificacion, setJustificacion]  = useState('')
  const [enviando, setEnviando]            = useState(false)
  const [error, setError]                  = useState('')

  const puedeConfirmar =
    autorizadoPor.trim().length >= 2 &&
    justificacion.trim().length >= 10

  async function confirmar() {
    if (!puedeConfirmar) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/acceso/excepcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token:           qrToken,
          establecimiento_id: establecimientoId,
          autorizado_por:     autorizadoPor.trim(),
          justificacion:      justificacion.trim(),
          lat:                lat ?? null,
          lng:                lng ?? null,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al registrar excepción')
      onExcepcionRegistrada({
        razon_social:  data.razon_social  ?? razonSocial ?? '',
        autorizado_por: data.autorizado_por ?? autorizadoPor,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm bg-[#0f1117] border border-amber-500/30 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Ingreso de excepción</p>
            {razonSocial && (
              <p className="text-amber-400/70 text-xs mt-0.5">{razonSocial}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Motivo del bloqueo — solo lectura */}
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-1.5">
              Motivo del bloqueo
            </p>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-red-300 text-sm">
                {MOTIVO_LABEL[motivoBloqueo] ?? motivoBloqueo}
              </p>
            </div>
          </div>

          {/* Autorizado por */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-1.5">
              Autorizado por <span className="text-amber-500">*</span>
            </p>
            <input
              type="text"
              value={autorizadoPor}
              onChange={e => setAutorizadoPor(e.target.value)}
              placeholder="Nombre de quien autorizó verbalmente el ingreso"
              className={inputCls}
            />
            <p className="text-zinc-600 text-xs mt-1">
              Ej: Juan García (Supervisor de turno), María López (Gerente de operaciones)
            </p>
          </div>

          {/* Justificación */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-1.5">
              Motivo del ingreso <span className="text-amber-500">*</span>
            </p>
            <textarea
              value={justificacion}
              onChange={e => setJustificacion(e.target.value)}
              placeholder="Describí brevemente por qué se autoriza este ingreso..."
              rows={3}
              className={inputCls + ' resize-none'}
            />
            {justificacion.trim().length > 0 && justificacion.trim().length < 10 && (
              <p className="text-zinc-600 text-xs mt-1">
                Mínimo 10 caracteres ({justificacion.trim().length}/10)
              </p>
            )}
          </div>

          {/* Aviso */}
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-amber-400/80 text-xs leading-relaxed">
              El supervisor recibirá una notificación inmediata con los datos de este ingreso.
              El registro es inmutable.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancelar}
              disabled={enviando}
              className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!puedeConfirmar || enviando}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {enviando ? 'Registrando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
