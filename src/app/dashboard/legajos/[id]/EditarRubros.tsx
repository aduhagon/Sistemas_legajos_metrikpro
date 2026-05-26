'use client'
// src/app/dashboard/legajos/[id]/EditarRubros.tsx
// Popover inline para editar los rubros de un proveedor

import { useState, useRef, useEffect } from 'react'

interface Rubro {
  id: string
  nombre: string
  codigo: number
}

interface EditarRubrosProps {
  proveedorId: string
  rubrosActuales: string[]       // nombres de los rubros actuales
  rubrosActualesIds: string[]    // ids de los rubros actuales
  rubrosDisponibles: Rubro[]     // todos los rubros del tenant
}

export default function EditarRubros({
  proveedorId,
  rubrosActuales,
  rubrosActualesIds,
  rubrosDisponibles,
}: EditarRubrosProps) {
  const [open, setOpen] = useState(false)
  const [seleccionados, setSeleccionados] = useState<string[]>(rubrosActualesIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSeleccionados(rubrosActualesIds) // resetear si no guardó
        setError(null)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, rubrosActualesIds])

  function toggleRubro(id: string) {
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
    try {
      const res = await fetch('/api/proveedor/rubros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: proveedorId, rubro_ids: seleccionados }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al guardar')
      setOpen(false)
      window.location.reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const haycambios =
    seleccionados.length !== rubrosActualesIds.length ||
    seleccionados.some(id => !rubrosActualesIds.includes(id))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setSeleccionados(rubrosActualesIds); setError(null) }}
        className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 rounded"
        title="Editar rubros"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-50 bg-[#1a1d27] border border-white/[0.12] rounded-xl shadow-2xl w-56 p-3">
          <p className="text-zinc-400 text-xs font-medium mb-2">Rubros del proveedor</p>

          <div className="space-y-1 mb-3">
            {rubrosDisponibles.map(r => {
              const sel = seleccionados.includes(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRubro(r.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    sel
                      ? 'bg-blue-500/15 border border-blue-500/30'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
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
                  <span className={`text-xs truncate ${sel ? 'text-white' : 'text-zinc-400'}`}>
                    {r.nombre}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <p className="text-red-400 text-xs mb-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setSeleccionados(rubrosActualesIds); setError(null) }}
              className="flex-1 text-xs py-1.5 rounded-lg border border-white/[0.1] text-zinc-500 hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving || !haycambios}
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
