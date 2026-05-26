'use client'
// src/app/dashboard/legajos/[id]/EditarRubros.tsx
// Popover inline para editar los rubros de un proveedor
// - Admin/evaluador: pueden agregar rubros (los nuevos suman sus docs específicos)
// - Solo supervisor: puede quitar rubros (los quitados eliminan sus docs en PENDIENTE)

import { useState, useRef, useEffect } from 'react'

interface Rubro {
  id: string
  nombre: string
  codigo: number
}

interface EditarRubrosProps {
  proveedorId: string
  rubrosActuales: string[]
  rubrosActualesIds: string[]
  rubrosDisponibles: Rubro[]
  esSupervisor: boolean
}

export default function EditarRubros({
  proveedorId,
  rubrosActuales,
  rubrosActualesIds,
  rubrosDisponibles,
  esSupervisor,
}: EditarRubrosProps) {
  const [open, setOpen]               = useState(false)
  const [seleccionados, setSeleccionados] = useState<string[]>(rubrosActualesIds)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [resultado, setResultado]     = useState<{ agregados: number; quitados: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleCancelar()
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, rubrosActualesIds])

  function handleCancelar() {
    setOpen(false)
    setSeleccionados(rubrosActualesIds)
    setError(null)
    setResultado(null)
  }

  function toggleRubro(id: string) {
    const estaActual = rubrosActualesIds.includes(id)
    // Si quiere desmarcar un rubro actual y no es supervisor → bloquear
    if (estaActual && seleccionados.includes(id) && !esSupervisor) {
      setError('Solo el supervisor puede retirar rubros')
      return
    }
    setError(null)
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  async function guardar() {
    if (seleccionados.length === 0) {
      setError('El proveedor debe tener al menos un rubro')
      return
    }
    setSaving(true)
    setError(null)
    setResultado(null)

    try {
      const res = await fetch('/api/proveedor/rubros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: proveedorId, rubro_ids: seleccionados }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al guardar')

      setResultado({ agregados: data.docs_agregados ?? 0, quitados: data.docs_quitados ?? 0 })
      setTimeout(() => window.location.reload(), 1200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const rubrosAgregar = seleccionados.filter(id => !rubrosActualesIds.includes(id))
  const rubrosQuitar  = rubrosActualesIds.filter(id => !seleccionados.includes(id))
  const hayCambios    = rubrosAgregar.length > 0 || rubrosQuitar.length > 0

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setSeleccionados(rubrosActualesIds); setError(null); setResultado(null) }}
        className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 rounded"
        title="Editar rubros"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-50 bg-[#1a1d27] border border-white/[0.12] rounded-xl shadow-2xl w-64 p-3">
          <p className="text-zinc-400 text-xs font-medium mb-1">Rubros del proveedor</p>
          {!esSupervisor && (
            <p className="text-zinc-600 text-[10px] mb-2">Solo podés agregar rubros. Para retirar, contactá al supervisor.</p>
          )}

          <div className="space-y-1 mb-3 max-h-52 overflow-y-auto">
            {rubrosDisponibles.map(r => {
              const sel      = seleccionados.includes(r.id)
              const esActual = rubrosActualesIds.includes(r.id)
              const puedeQuitar = esSupervisor || !esActual
              const bloqueado = esActual && !esSupervisor // tiene el rubro pero no puede quitarlo

              return (
                <button
                  key={r.id}
                  onClick={() => toggleRubro(r.id)}
                  disabled={bloqueado && sel} // desactivar desmarcar si es bloqueado
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    sel
                      ? 'bg-blue-500/15 border border-blue-500/30'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  } ${bloqueado && sel ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    sel ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                  }`}>
                    {sel && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs truncate flex-1 ${sel ? 'text-white' : 'text-zinc-400'}`}>
                    {r.nombre}
                  </span>
                  {bloqueado && sel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" className="shrink-0">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {/* Resumen de cambios */}
          {hayCambios && (
            <div className="text-[10px] text-zinc-500 mb-2 space-y-0.5">
              {rubrosAgregar.length > 0 && (
                <p className="text-green-500">+ {rubrosAgregar.length} rubro{rubrosAgregar.length > 1 ? 's' : ''} a agregar — se crearán sus documentos</p>
              )}
              {rubrosQuitar.length > 0 && esSupervisor && (
                <p className="text-orange-400">− {rubrosQuitar.length} rubro{rubrosQuitar.length > 1 ? 's' : ''} a retirar — se eliminarán docs en PENDIENTE</p>
              )}
            </div>
          )}

          {resultado && (
            <div className="text-[10px] text-green-400 mb-2">
              ✓ Guardado — {resultado.agregados} doc{resultado.agregados !== 1 ? 's' : ''} agregado{resultado.agregados !== 1 ? 's' : ''}
              {resultado.quitados > 0 && `, ${resultado.quitados} eliminado${resultado.quitados !== 1 ? 's' : ''}`}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs mb-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCancelar}
              className="flex-1 text-xs py-1.5 rounded-lg border border-white/[0.1] text-zinc-500 hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving || !hayCambios}
              className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
