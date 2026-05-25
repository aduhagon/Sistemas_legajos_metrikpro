// ============================================================
// /app/superadmin/tenants/[id]/tabs/ModulosTab.tsx
// Tab Módulos — agrupados por plan con toggle + confirmación core
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ModuloUI } from '../page'

const PLAN_META: Record<string, { label: string; descripcion: string; badge: string }> = {
  core: {
    label:       'Core',
    descripcion: 'Módulos esenciales del sistema. Vienen activos por defecto. Desactivarlos puede romper funcionalidades.',
    badge:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  addon: {
    label:       'Add-ons',
    descripcion: 'Funcionalidades opcionales. El cliente paga extra por cada add-on activado.',
    badge:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  premium: {
    label:       'Premium',
    descripcion: 'Features avanzados (IA, integraciones, marca blanca). Solo en planes Premium / Enterprise.',
    badge:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
}

export default function ModulosTab({
  modulos,
  grupoId,
}: {
  modulos: ModuloUI[]
  grupoId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDesactivar, setConfirmDesactivar] = useState<ModuloUI | null>(null)

  async function toggle(modulo: string, nuevoEstado: boolean) {
    setLoading(modulo)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/toggle-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_id: grupoId, modulo, activo: nuevoEstado }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(null)
      setConfirmDesactivar(null)
    }
  }

  function onToggleClick(m: ModuloUI) {
    if (m.activo && m.es_core_critico) {
      setConfirmDesactivar(m)
      return
    }
    toggle(m.modulo, !m.activo)
  }

  const grupos: { plan: 'core' | 'addon' | 'premium'; modulos: ModuloUI[] }[] = [
    { plan: 'core',    modulos: modulos.filter(m => m.plan === 'core') },
    { plan: 'addon',   modulos: modulos.filter(m => m.plan === 'addon') },
    { plan: 'premium', modulos: modulos.filter(m => m.plan === 'premium') },
  ]

  return (
    <>
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {grupos.map(g => {
        if (g.modulos.length === 0) return null
        const meta = PLAN_META[g.plan]
        const activosEnPlan = g.modulos.filter(m => m.activo).length

        return (
          <section key={g.plan} className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-semibold text-white">{meta.label}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${meta.badge}`}>
                {activosEnPlan} / {g.modulos.length} activos
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{meta.descripcion}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {g.modulos.map(m => (
                <div key={m.modulo} className={`bg-gray-900 border rounded-lg p-4 transition ${m.activo ? 'border-gray-700' : 'border-gray-800/50 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white">{m.nombre}</h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{m.modulo}</p>
                    </div>
                    <button
                      onClick={() => onToggleClick(m)}
                      disabled={loading === m.modulo}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${m.activo ? 'bg-emerald-500' : 'bg-gray-700'} ${loading === m.modulo ? 'opacity-50' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${m.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{m.descripcion}</p>
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-600">
                    {m.activo ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        Inactivo
                      </span>
                    )}
                    {m.updated_at && (
                      <span>Actualizado {new Date(m.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {confirmDesactivar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">¿Desactivar módulo Core?</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Estás por desactivar <strong className="text-white">{confirmDesactivar.nombre}</strong>, que es parte del Core.
                </p>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 mb-4">
              <p className="text-xs text-amber-200">
                Los módulos Core son esenciales para el funcionamiento del sistema. Al desactivarlo, los usuarios pueden perder acceso a funcionalidades críticas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDesactivar(null)} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">
                Cancelar
              </button>
              <button
                onClick={() => toggle(confirmDesactivar.modulo, false)}
                disabled={loading === confirmDesactivar.modulo}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition disabled:opacity-50"
              >
                {loading === confirmDesactivar.modulo ? 'Desactivando...' : 'Sí, desactivar igual'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
