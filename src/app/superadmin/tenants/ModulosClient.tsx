// ============================================================
// /app/superadmin/tenants/[id]/modulos/ModulosClient.tsx
// Panel de módulos de un tenant — Client Component con toggles
// ============================================================
'use client'

import { useState, useTransition } from 'react'
import type { GrupoModulo } from '@/types/superadmin'
import { MODULOS_CONFIG } from '@/types/superadmin'
import { toggleModuloAction } from './actions'

interface Props {
  grupoId: string
  grupoNombre: string
  modulos: GrupoModulo[]
  superadminId: string
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  core:    { label: 'CORE',    color: 'bg-blue-900 text-blue-300' },
  addon:   { label: 'ADD-ON',  color: 'bg-purple-900 text-purple-300' },
  premium: { label: 'PREMIUM', color: 'bg-amber-900 text-amber-300' },
}

export default function ModulosClient({ grupoId, grupoNombre, modulos, superadminId }: Props) {
  const [estadoLocal, setEstadoLocal] = useState<Record<string, boolean>>(
    Object.fromEntries(modulos.map(m => [m.modulo, m.activo]))
  )
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  function solicitarToggle(modulo: string) {
    const config = MODULOS_CONFIG[modulo]
    if (!config?.toggleable) return
    setConfirmando(modulo)
  }

  function cancelar() {
    setConfirmando(null)
  }

  function confirmarToggle() {
    if (!confirmando) return
    const nuevoEstado = !estadoLocal[confirmando]
    const moduloAux = confirmando
    setConfirmando(null)

    startTransition(async () => {
      // Optimistic update
      setEstadoLocal(prev => ({ ...prev, [moduloAux]: nuevoEstado }))
      setFeedback(null)

      const result = await toggleModuloAction({
        superadminId,
        grupoId,
        modulo: moduloAux,
        activo: nuevoEstado,
      })

      if (!result.ok) {
        // Revertir
        setEstadoLocal(prev => ({ ...prev, [moduloAux]: !nuevoEstado }))
        setFeedback({ tipo: 'error', msg: result.error ?? 'Error al actualizar el módulo' })
      } else {
        setFeedback({
          tipo: 'ok',
          msg: `${MODULOS_CONFIG[moduloAux]?.nombre} ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`
        })
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  const planes: Array<'core' | 'addon' | 'premium'> = ['core', 'addon', 'premium']

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Módulos — {grupoNombre}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Activar o desactivar features por plan</p>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
          feedback.tipo === 'ok'
            ? 'bg-green-950 border border-green-900 text-green-400'
            : 'bg-red-950 border border-red-900 text-red-400'
        }`}>
          {feedback.tipo === 'ok' ? '✓' : '✗'} {feedback.msg}
        </div>
      )}

      {/* Secciones por plan */}
      {planes.map(plan => {
        const modulosDelPlan = Object.entries(MODULOS_CONFIG)
          .filter(([, cfg]) => cfg.plan === plan)
        const planInfo = PLAN_LABELS[plan]

        return (
          <div key={plan}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${planInfo.color}`}>
                {planInfo.label}
              </span>
              {plan === 'core' && (
                <span className="text-xs text-gray-600">Siempre activos — no modificables</span>
              )}
            </div>

            <div className="space-y-1">
              {modulosDelPlan.map(([moduloId, cfg]) => {
                const activo = estadoLocal[moduloId] ?? false
                const toggleable = cfg.toggleable

                return (
                  <div
                    key={moduloId}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors ${
                      activo
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-gray-950 border-gray-900 opacity-60'
                    }`}
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{cfg.nombre}</p>
                      <p className="text-xs text-gray-500 truncate">{cfg.descripcion}</p>
                    </div>

                    {/* ID técnico */}
                    <code className="text-[10px] text-gray-700 hidden md:block">{moduloId}</code>

                    {/* Toggle */}
                    {toggleable ? (
                      <button
                        onClick={() => solicitarToggle(moduloId)}
                        disabled={isPending}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                          activo ? 'bg-blue-600' : 'bg-gray-700'
                        }`}
                        aria-label={`${activo ? 'Desactivar' : 'Activar'} ${cfg.nombre}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          activo ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    ) : (
                      <div className="w-10 h-5 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Modal de confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold">Confirmar cambio</h3>
            <p className="text-sm text-gray-400">
              {estadoLocal[confirmando]
                ? `¿Desactivar `
                : `¿Activar `}
              <span className="text-white font-medium">{MODULOS_CONFIG[confirmando]?.nombre}</span>
              {` para `}
              <span className="text-white font-medium">{grupoNombre}</span>
              {`?`}
            </p>
            {!estadoLocal[confirmando] && (
              <p className="text-xs text-gray-500">
                Los datos existentes se conservarán. El cambio es inmediato y no requiere redeploy.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelar}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarToggle}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
