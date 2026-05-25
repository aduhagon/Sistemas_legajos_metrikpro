// ============================================================
// /app/superadmin/tenants/[id]/tabs/GeneralTab.tsx
// Tab General — plan, estado cuenta, suspender/reactivar
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tenant } from '../page'

export default function GeneralTab({ tenant }: { tenant: Tenant }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ accion: string; mensaje: string; payload?: Record<string, unknown> } | null>(null)

  async function ejecutar(accion: string, payload?: Record<string, unknown>) {
    setLoading(accion)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/tenant-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, grupo_id: tenant.id, payload }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(null)
      setConfirmar(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <Card titulo="Plan contratado">
        <div className="flex items-center gap-2 mb-3">
          {(['basico', 'pro', 'enterprise'] as const).map(p => {
            const info = {
              basico:     { label: 'Básico',     mod: '6 Core' },
              pro:        { label: 'Pro',        mod: '13 Core+Addons' },
              enterprise: { label: 'Enterprise', mod: '16 Todos' },
            }[p]
            const seleccionado = tenant.plan === p
            return (
              <button
                key={p}
                onClick={() => {
                  if (seleccionado) return
                  setConfirmar({
                    accion: 'update_plan',
                    mensaje: `Cambiar al plan "${info.label}"? Se activarán los módulos correspondientes (no se desactivan los ya prendidos).`,
                    payload: { plan: p },
                  })
                }}
                disabled={loading === 'update_plan'}
                className={`px-4 py-2 rounded border text-left transition ${
                  seleccionado
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className={`text-sm font-medium ${seleccionado ? 'text-white' : 'text-gray-300'}`}>{info.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{info.mod}</p>
              </button>
            )
          })}
        </div>
        {tenant.plan_desde && (
          <p className="text-xs text-gray-500">
            Plan vigente desde {new Date(tenant.plan_desde + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
      </Card>

      <Card titulo="Estado de cuenta">
        <p className="text-xs text-gray-500 mb-3">
          Suspendido bloquea el acceso del cliente. Pendiente de pago lo deja entrar pero con aviso visible.
        </p>
        <div className="flex gap-2 flex-wrap">
          {(['al_dia', 'pendiente_pago', 'suspendido'] as const).map(e => {
            const info = {
              al_dia:         { label: 'Al día',          color: 'emerald' },
              pendiente_pago: { label: 'Pendiente de pago', color: 'amber'   },
              suspendido:     { label: 'Suspendido',      color: 'red'     },
            }[e]
            const seleccionado = tenant.estado_cuenta === e
            return (
              <button
                key={e}
                onClick={() => {
                  if (seleccionado) return
                  ejecutar('cambiar_estado_cuenta', { estado_cuenta: e })
                }}
                disabled={loading === 'cambiar_estado_cuenta'}
                className={`px-3 py-1.5 rounded border text-sm font-medium transition ${
                  seleccionado
                    ? `border-${info.color}-500/40 bg-${info.color}-500/10 text-${info.color}-400`
                    : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {info.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card titulo="Acceso al sistema" variant={tenant.activo ? 'normal' : 'warning'}>
        <p className="text-xs text-gray-400 mb-3">
          {tenant.activo
            ? 'El tenant está activo. Los usuarios pueden ingresar normalmente.'
            : 'El tenant está suspendido. Ningún usuario puede iniciar sesión.'}
        </p>
        <button
          onClick={() => setConfirmar({
            accion: 'toggle_activo',
            mensaje: tenant.activo
              ? `¿Suspender "${tenant.nombre}"? Todos los usuarios del tenant perderán acceso inmediatamente.`
              : `¿Reactivar "${tenant.nombre}"? Los usuarios podrán volver a ingresar.`,
            payload: { activo: !tenant.activo },
          })}
          disabled={loading === 'toggle_activo'}
          className={`text-sm font-medium px-3 py-2 rounded transition ${
            tenant.activo
              ? 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          } disabled:opacity-50`}
        >
          {tenant.activo ? 'Suspender tenant' : 'Reactivar tenant'}
        </button>
      </Card>

      {/* Modal de confirmación */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-white mb-2">Confirmar acción</h3>
            <p className="text-sm text-gray-300 mb-5">{confirmar.mensaje}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmar(null)} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => ejecutar(confirmar.accion, confirmar.payload)}
                disabled={loading === confirmar.accion}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition disabled:opacity-50"
              >
                {loading === confirmar.accion ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ titulo, children, variant }: { titulo: string; children: React.ReactNode; variant?: 'normal' | 'warning' }) {
  return (
    <div className={`bg-gray-900 border rounded-lg p-5 ${
      variant === 'warning' ? 'border-amber-500/30' : 'border-gray-800'
    }`}>
      <h3 className="text-sm font-semibold text-white mb-3">{titulo}</h3>
      {children}
    </div>
  )
}
