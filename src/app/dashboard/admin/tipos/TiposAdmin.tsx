'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Rubro = { id: string; codigo: number; nombre: string }
type Tipo = {
  id: string
  nombre: string
  descripcion: string | null
  icono: string
  activo: boolean
  tipos_establecimiento_rubros: { rubro_id: string; rubros: Rubro }[]
}

const ICONOS = ['🏢', '🌾', '🏭', '🏗️', '⚓', '🚛', '🌿', '🔧', '🏪', '🏬']

export default function TiposAdmin({
  tipos: tiposIniciales, rubros, grupoId
}: { tipos: Tipo[]; rubros: Rubro[]; grupoId: string }) {
  const router = useRouter()
  const [tipos, setTipos] = useState(tiposIniciales)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nombre: '', descripcion: '', icono: '🏢' })

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"

  function getRubrosHabilitados(tipo: Tipo) {
    return tipo.tipos_establecimiento_rubros?.map(r => r.rubro_id) ?? []
  }

  async function toggleRubro(tipoId: string, rubroId: string, habilitado: boolean) {
    setLoading(true)
    if (habilitado) {
      await supabase.from('tipos_establecimiento_rubros')
        .delete()
        .eq('tipo_establecimiento_id', tipoId)
        .eq('rubro_id', rubroId)
      setTipos(prev => prev.map(t => t.id === tipoId
        ? { ...t, tipos_establecimiento_rubros: t.tipos_establecimiento_rubros.filter(r => r.rubro_id !== rubroId) }
        : t))
    } else {
      const { data } = await supabase.from('tipos_establecimiento_rubros')
        .insert({ tipo_establecimiento_id: tipoId, rubro_id: rubroId })
        .select('rubro_id, rubros(id, codigo, nombre)')
        .single()
      if (data) {
        setTipos(prev => prev.map(t => t.id === tipoId
          ? { ...t, tipos_establecimiento_rubros: [...t.tipos_establecimiento_rubros, data as any] }
          : t))
      }
    }
    setLoading(false)
  }

  async function guardar(tipoId?: string) {
    setLoading(true)
    const payload = {
      grupo_id:    grupoId,
      nombre:      form.nombre,
      descripcion: form.descripcion || null,
      icono:       form.icono,
    }
    if (tipoId) {
      await supabase.from('tipos_establecimiento').update(payload).eq('id', tipoId)
      setTipos(prev => prev.map(t => t.id === tipoId ? { ...t, ...payload } : t))
      setEditando(null)
    } else {
      const { data } = await supabase.from('tipos_establecimiento')
        .insert(payload).select().single()
      if (data) setTipos(prev => [...prev, { ...data, tipos_establecimiento_rubros: [] }])
      setCreando(false)
    }
    setForm({ nombre: '', descripcion: '', icono: '🏢' })
    setLoading(false)
  }

  async function toggleActivo(tipo: Tipo) {
    setLoading(true)
    await supabase.from('tipos_establecimiento').update({ activo: !tipo.activo }).eq('id', tipo.id)
    setTipos(prev => prev.map(t => t.id === tipo.id ? { ...t, activo: !tipo.activo } : t))
    setLoading(false)
  }

  return (
    <div className="space-y-3">

      {/* Botón crear */}
      {!creando && (
        <button onClick={() => { setCreando(true); setEditando(null); setForm({ nombre: '', descripcion: '', icono: '🏢' }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo tipo
        </button>
      )}

      {/* Form crear */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium">Nuevo tipo de establecimiento</p>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1">
              <label className="block text-zinc-400 text-xs mb-1">Ícono</label>
              <select value={form.icono} onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
                className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all text-xl">
                {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-zinc-400 text-xs mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Campo agrícola" className={inputCls}/>
            </div>
            <div className="col-span-2">
              <label className="block text-zinc-400 text-xs mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Opcional" className={inputCls}/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => guardar()} disabled={loading || !form.nombre}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setCreando(false)} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de tipos */}
      {tipos.map(tipo => {
        const rubrosHab = getRubrosHabilitados(tipo)
        return (
          <div key={tipo.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden ${tipo.activo ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <button onClick={() => setAbierto(abierto === tipo.id ? null : tipo.id)}
                className="text-zinc-400 hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${abierto === tipo.id ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <span className="text-2xl">{tipo.icono}</span>

              <div className="flex-1">
                {editando === tipo.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={form.icono} onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
                      className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none w-16">
                      {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 w-40"/>
                    <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Descripción"
                      className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 flex-1"/>
                    <button onClick={() => guardar(tipo.id)} disabled={loading}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">Guardar</button>
                    <button onClick={() => setEditando(null)} className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors">Cancelar</button>
                  </div>
                ) : (
                  <div>
                    <span className="text-white font-medium">{tipo.nombre}</span>
                    {tipo.descripcion && <span className="text-zinc-500 text-sm ml-2">{tipo.descripcion}</span>}
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {rubrosHab.length === 0
                        ? 'Sin rubros configurados — todos los proveedores podrán ingresar'
                        : `${rubrosHab.length} rubro${rubrosHab.length !== 1 ? 's' : ''} habilitado${rubrosHab.length !== 1 ? 's' : ''}: ${tipo.tipos_establecimiento_rubros.map(r => r.rubros?.nombre).join(', ')}`
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {editando !== tipo.id && (
                  <button onClick={() => {
                    setForm({ nombre: tipo.nombre, descripcion: tipo.descripcion ?? '', icono: tipo.icono })
                    setEditando(tipo.id)
                  }} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                <button onClick={() => toggleActivo(tipo)} disabled={loading}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    tipo.activo
                      ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                  }`}>
                  {tipo.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>

            {/* Rubros habilitados */}
            {abierto === tipo.id && editando !== tipo.id && (
              <div className="border-t border-white/[0.06] px-5 py-4">
                <p className="text-sm font-medium mb-1">Rubros habilitados para ingresar</p>
                <p className="text-zinc-600 text-xs mb-4">
                  Seleccioná qué rubros de proveedores pueden acceder a establecimientos de tipo <strong className="text-zinc-400">{tipo.nombre}</strong>.
                  Si no seleccionás ninguno, todos los rubros podrán ingresar.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {rubros.map(r => {
                    const hab = rubrosHab.includes(r.id)
                    return (
                      <label key={r.id} onClick={() => toggleRubro(tipo.id, r.id, hab)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          hab
                            ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          hab ? 'bg-blue-600 border-blue-500' : 'bg-white/[0.05] border-white/[0.2]'
                        }`}>
                          {hab && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${hab ? 'text-blue-300' : 'text-zinc-400'}`}>{r.nombre}</p>
                          <p className="text-zinc-600 text-xs">Rubro {r.codigo}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {rubrosHab.length === 0 && (
                  <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                    <p className="text-yellow-400 text-xs">
                      ⚠ Sin rubros seleccionados — cualquier proveedor podrá ingresar a establecimientos de este tipo.
                      Seleccioná al menos un rubro para restringir el acceso.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {tipos.length === 0 && !creando && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm mb-3">No hay tipos de establecimiento configurados</p>
          <button onClick={() => setCreando(true)} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Crear el primero →
          </button>
        </div>
      )}
    </div>
  )
}
