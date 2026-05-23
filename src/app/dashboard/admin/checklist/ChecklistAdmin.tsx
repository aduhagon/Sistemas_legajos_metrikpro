'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Item = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  orden: number
}

export default function ChecklistAdmin({
  items: itemsInit,
  grupoId,
}: {
  items: Item[]
  grupoId: string
}) {
  const router = useRouter()
  const [items, setItems]       = useState(itemsInit)
  const [creando, setCreando]   = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [form, setForm]         = useState({ nombre: '', descripcion: '' })
  const [error, setError]       = useState('')

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  function abrirEditar(item: Item) {
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '' })
    setEditandoId(item.id)
    setCreando(false)
    setError('')
  }

  function cancelar() {
    setCreando(false)
    setEditandoId(null)
    setForm({ nombre: '', descripcion: '' })
    setError('')
  }

  async function guardar(itemId?: string) {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError('')

    if (itemId) {
      // Editar
      const { error: err } = await supabase
        .from('checklist_auditoria')
        .update({ nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null })
        .eq('id', itemId)
      if (err) { setError(err.message); setLoading(false); return }
      setItems(prev => prev.map(i =>
        i.id === itemId
          ? { ...i, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null }
          : i
      ))
      setEditandoId(null)
    } else {
      // Crear
      const maxOrden = items.length > 0 ? Math.max(...items.map(i => i.orden)) + 1 : 0
      const { data, error: err } = await supabase
        .from('checklist_auditoria')
        .insert({ grupo_id: grupoId, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, orden: maxOrden })
        .select()
        .single()
      if (err) { setError(err.message); setLoading(false); return }
      setItems(prev => [...prev, data as Item])
      setCreando(false)
    }

    setForm({ nombre: '', descripcion: '' })
    setLoading(false)
  }

  async function toggleActivo(item: Item) {
    setLoading(true)
    await supabase
      .from('checklist_auditoria')
      .update({ activo: !item.activo })
      .eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, activo: !item.activo } : i))
    setLoading(false)
  }

  async function moverOrden(item: Item, dir: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => a.orden - b.orden)
    const idx = sorted.findIndex(i => i.id === item.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const otro = sorted[swapIdx]
    setLoading(true)

    await Promise.all([
      supabase.from('checklist_auditoria').update({ orden: otro.orden }).eq('id', item.id),
      supabase.from('checklist_auditoria').update({ orden: item.orden }).eq('id', otro.id),
    ])

    setItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, orden: otro.orden }
      if (i.id === otro.id) return { ...i, orden: item.orden }
      return i
    }))
    setLoading(false)
  }

  const itemsOrdenados = [...items].sort((a, b) => a.orden - b.orden)
  const activos   = itemsOrdenados.filter(i => i.activo).length
  const inactivos = itemsOrdenados.filter(i => !i.activo).length

  return (
    <div className="max-w-2xl space-y-4">

      {/* Botón nuevo */}
      {!creando && (
        <button
          onClick={() => { setCreando(true); setEditandoId(null); setForm({ nombre: '', descripcion: '' }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo punto de checklist
        </button>
      )}

      {/* Form crear */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium">Nuevo punto de checklist</p>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Nombre del punto *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Uso de EPP correcto"
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Descripción / guía para el auditor</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              placeholder="Descripción opcional para orientar al auditor en campo..."
              className={inputCls + ' resize-none'}
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => guardar()} disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={cancelar} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Puntos del checklist</h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              {activos} activo{activos !== 1 ? 's' : ''}
              {inactivos > 0 && ` · ${inactivos} inactivo${inactivos !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
            <p className="text-blue-300 text-xs">Se evalúan en orden de arriba a abajo</p>
          </div>
        </div>

        {itemsOrdenados.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-zinc-500 text-sm mb-1">No hay puntos en el checklist todavía</p>
            <p className="text-zinc-700 text-xs">Agregá los primeros puntos para que el auditor los evalúe en campo</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {itemsOrdenados.map((item, idx) => (
              <div key={item.id} className={`px-6 py-4 transition-colors ${!item.activo ? 'opacity-50' : ''}`}>

                {editandoId === item.id ? (
                  /* Inline edit */
                  <div className="space-y-3">
                    <input
                      value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      autoFocus
                      className={inputCls}
                    />
                    <textarea
                      value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      rows={2}
                      placeholder="Descripción opcional..."
                      className={inputCls + ' resize-none'}
                    />
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => guardar(item.id)} disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors">
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={cancelar} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors px-3 py-2">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Vista normal */
                  <div className="flex items-start gap-4">
                    {/* Número de orden */}
                    <span className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-500 text-xs font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{item.nombre}</p>
                      {item.descripcion && (
                        <p className="text-zinc-500 text-xs mt-0.5">{item.descripcion}</p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Mover arriba */}
                      <button
                        onClick={() => moverOrden(item, 'up')}
                        disabled={loading || idx === 0}
                        title="Mover arriba"
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      </button>
                      {/* Mover abajo */}
                      <button
                        onClick={() => moverOrden(item, 'down')}
                        disabled={loading || idx === itemsOrdenados.length - 1}
                        title="Mover abajo"
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() => abrirEditar(item)}
                        title="Editar"
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 transition-colors ml-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>

                      {/* Activar / desactivar */}
                      <button
                        onClick={() => toggleActivo(item)}
                        disabled={loading}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ml-1 ${
                          item.activo
                            ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                            : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                        }`}>
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <p className="text-zinc-500 text-xs font-medium mb-1">¿Cómo funciona el checklist?</p>
        <p className="text-zinc-600 text-xs leading-relaxed">
          Estos puntos aparecen en la App de Auditoría cuando el auditor registra una visita a un proveedor.
          Para cada punto puede marcar Sí / No y agregar una observación.
          Solo los puntos <span className="text-zinc-400">activos</span> aparecen en campo.
          El orden se puede cambiar con las flechas.
        </p>
      </div>
    </div>
  )
}
