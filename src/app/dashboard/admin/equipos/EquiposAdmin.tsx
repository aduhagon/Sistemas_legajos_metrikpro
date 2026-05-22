'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type DocReq = {
  id: string
  nombre: string
  tipo_vigencia: string
  obligatorio: boolean
  tipo_equipo_id: string | null
  activo: boolean
}

type TipoEquipo = {
  id: string
  nombre: string
  descripcion: string | null
  icono: string
  activo: boolean
  documentos_requeridos_equipo: DocReq[]
}

const VIGENCIAS = ['PERMANENTE', 'ANUAL', 'MENSUAL']
const ICONOS = ['🚗', '🚛', '🚐', '🚜', '🌾', '🔗', '⚙️', '✈️', '🔧', '🚁', '⛵', '🏗️', '🚂', '🛻']
const emptyDocForm = { nombre: '', tipo_vigencia: 'ANUAL', obligatorio: true }

export default function EquiposAdmin({
  tipos: tiposIniciales,
  docsGenerales: docsGeneralesIniciales,
  grupoId,
}: {
  tipos: TipoEquipo[]
  docsGenerales: DocReq[]
  grupoId: string
}) {
  const router = useRouter()
  const [tipos, setTipos] = useState(tiposIniciales)
  const [docsGenerales, setDocsGenerales] = useState(docsGeneralesIniciales)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [generalesAbierto, setGeneralesAbierto] = useState(true)
  const [creando, setCreando] = useState(false)
  const [editandoTipo, setEditandoTipo] = useState<string | null>(null)
  const [editandoDoc, setEditandoDoc] = useState<string | null>(null)
  const [nuevoDocEn, setNuevoDocEn] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tipoForm, setTipoForm] = useState({ nombre: '', descripcion: '', icono: '🚗' })
  const [docForm, setDocForm] = useState(emptyDocForm)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
  const checkCls = "w-4 h-4 rounded border border-white/[0.2] bg-white/[0.05] accent-blue-500 cursor-pointer"

  async function guardarTipo(tipoId?: string) {
    setLoading(true)
    const payload = { grupo_id: grupoId, nombre: tipoForm.nombre, descripcion: tipoForm.descripcion || null, icono: tipoForm.icono }
    if (tipoId) {
      await supabase.from('tipos_equipo').update(payload).eq('id', tipoId)
      setTipos(t => t.map(x => x.id === tipoId ? { ...x, ...payload } : x))
      setEditandoTipo(null)
    } else {
      const { data } = await supabase.from('tipos_equipo').insert(payload).select().single()
      if (data) setTipos(t => [...t, { ...data, documentos_requeridos_equipo: [] }])
      setCreando(false)
    }
    setTipoForm({ nombre: '', descripcion: '', icono: '🚗' })
    setLoading(false)
  }

  async function toggleTipoActivo(tipo: TipoEquipo) {
    setLoading(true)
    await supabase.from('tipos_equipo').update({ activo: !tipo.activo }).eq('id', tipo.id)
    setTipos(t => t.map(x => x.id === tipo.id ? { ...x, activo: !tipo.activo } : x))
    setLoading(false)
  }

  async function toggleDocActivo(doc: DocReq, tipoId?: string) {
    setLoading(true)
    await supabase.from('documentos_requeridos_equipo').update({ activo: !doc.activo }).eq('id', doc.id)
    if (tipoId) {
      setTipos(t => t.map(x => x.id === tipoId
        ? { ...x, documentos_requeridos_equipo: x.documentos_requeridos_equipo.map(d => d.id === doc.id ? { ...d, activo: !doc.activo } : d) }
        : x))
    } else {
      setDocsGenerales(d => d.map(x => x.id === doc.id ? { ...x, activo: !doc.activo } : x))
    }
    setLoading(false)
  }

  function abrirEditDoc(doc: DocReq) {
    setDocForm({ nombre: doc.nombre, tipo_vigencia: doc.tipo_vigencia, obligatorio: doc.obligatorio })
    setEditandoDoc(doc.id)
    setNuevoDocEn(null)
  }

  async function guardarDoc(doc: DocReq, tipoId?: string) {
    setLoading(true)
    await supabase.from('documentos_requeridos_equipo').update(docForm).eq('id', doc.id)
    if (tipoId) {
      setTipos(t => t.map(x => x.id === tipoId
        ? { ...x, documentos_requeridos_equipo: x.documentos_requeridos_equipo.map(d => d.id === doc.id ? { ...d, ...docForm } : d) }
        : x))
    } else {
      setDocsGenerales(d => d.map(x => x.id === doc.id ? { ...x, ...docForm } : x))
    }
    setEditandoDoc(null)
    setLoading(false)
  }

  async function crearDoc(tipoId: string | null) {
    setLoading(true)
    const { data } = await supabase.from('documentos_requeridos_equipo').insert({
      grupo_id: grupoId,
      tipo_equipo_id: tipoId,
      nombre: docForm.nombre,
      tipo_vigencia: docForm.tipo_vigencia,
      obligatorio: docForm.obligatorio,
      activo: true,
    }).select().single()
    if (data) {
      if (tipoId) {
        setTipos(t => t.map(x => x.id === tipoId
          ? { ...x, documentos_requeridos_equipo: [...x.documentos_requeridos_equipo, data as DocReq] }
          : x))
      } else {
        setDocsGenerales(d => [...d, data as DocReq])
      }
    }
    setNuevoDocEn(null)
    setDocForm(emptyDocForm)
    setLoading(false)
  }

  function DocFormFields({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-zinc-400 text-xs mb-1">Nombre del documento *</label>
            <input value={docForm.nombre} onChange={e => setDocForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Habilitación municipal" className={inputCls}/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1">Vigencia *</label>
            <select value={docForm.tipo_vigencia} onChange={e => setDocForm(f => ({ ...f, tipo_vigencia: e.target.value }))}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
              {VIGENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={docForm.obligatorio}
              onChange={e => setDocForm(f => ({ ...f, obligatorio: e.target.checked }))} className={checkCls}/>
            <span className="text-zinc-300 text-sm">Obligatorio</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onSave} disabled={loading || !docForm.nombre}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors px-3 py-2">Cancelar</button>
        </div>
      </div>
    )
  }

  function ListaDocs({ docs, tipoId }: { docs: DocReq[]; tipoId?: string }) {
    return (
      <div className="divide-y divide-white/[0.04]">
        {docs.map(doc => (
          <div key={doc.id} className={`px-5 py-3 ${!doc.activo ? 'opacity-50' : ''}`}>
            {editandoDoc === doc.id ? (
              <DocFormFields onSave={() => guardarDoc(doc, tipoId)} onCancel={() => setEditandoDoc(null)}/>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{doc.nombre}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-zinc-600 text-xs">{doc.tipo_vigencia}</span>
                    {doc.obligatorio && <span className="text-zinc-600 text-xs">· Obligatorio</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => abrirEditDoc(doc)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button onClick={() => toggleDocActivo(doc, tipoId)} disabled={loading}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                      doc.activo
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                        : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                    }`}>
                    {doc.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Botón crear tipo */}
      {!creando && (
        <button onClick={() => { setCreando(true); setEditandoTipo(null); setTipoForm({ nombre: '', descripcion: '', icono: '🚗' }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo tipo de equipo
        </button>
      )}

      {/* Form crear tipo */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium">Nuevo tipo de equipo</p>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1">
              <label className="block text-zinc-400 text-xs mb-1">Ícono</label>
              <select value={tipoForm.icono} onChange={e => setTipoForm(f => ({ ...f, icono: e.target.value }))}
                className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none text-xl">
                {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-zinc-400 text-xs mb-1">Nombre *</label>
              <input value={tipoForm.nombre} onChange={e => setTipoForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Avión fumigador" className={inputCls}/>
            </div>
            <div className="col-span-2">
              <label className="block text-zinc-400 text-xs mb-1">Descripción</label>
              <input value={tipoForm.descripcion} onChange={e => setTipoForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Opcional" className={inputCls}/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => guardarTipo()} disabled={loading || !tipoForm.nombre}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setCreando(false)} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* Documentos generales (aplican a todos los tipos) */}
      <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => setGeneralesAbierto(!generalesAbierto)} className="text-zinc-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${generalesAbierto ? 'rotate-90' : ''}`}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Documentos generales</span>
              <span className="text-zinc-500 text-xs">{docsGenerales.filter(d => d.activo).length} activos</span>
            </div>
            <p className="text-zinc-600 text-xs mt-0.5">Aplican a todos los tipos de equipo</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">Todos</span>
        </div>
        {generalesAbierto && (
          <div className="border-t border-white/[0.06]">
            <ListaDocs docs={docsGenerales}/>
            <div className="px-5 py-3 border-t border-white/[0.04]">
              {nuevoDocEn === 'general' ? (
                <DocFormFields onSave={() => crearDoc(null)} onCancel={() => { setNuevoDocEn(null); setDocForm(emptyDocForm) }}/>
              ) : (
                <button onClick={() => { setDocForm(emptyDocForm); setNuevoDocEn('general'); setEditandoDoc(null) }}
                  className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Agregar documento general
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tipos de equipo */}
      {tipos.map(tipo => (
        <div key={tipo.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden ${tipo.activo ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>
          <div className="px-5 py-4 flex items-center gap-3">
            <button onClick={() => setAbierto(abierto === tipo.id ? null : tipo.id)} className="text-zinc-400 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${abierto === tipo.id ? 'rotate-90' : ''}`}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <span className="text-2xl">{tipo.icono}</span>
            <div className="flex-1">
              {editandoTipo === tipo.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={tipoForm.icono} onChange={e => setTipoForm(f => ({ ...f, icono: e.target.value }))}
                    className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-2 py-1.5 text-white text-sm w-16">
                    {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <input value={tipoForm.nombre} onChange={e => setTipoForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm w-40"/>
                  <input value={tipoForm.descripcion} onChange={e => setTipoForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción" className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm flex-1"/>
                  <button onClick={() => guardarTipo(tipo.id)} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg">Guardar</button>
                  <button onClick={() => setEditandoTipo(null)} className="text-zinc-500 text-xs hover:text-zinc-300">Cancelar</button>
                </div>
              ) : (
                <div>
                  <span className="text-white font-medium">{tipo.nombre}</span>
                  {tipo.descripcion && <span className="text-zinc-500 text-sm ml-2">{tipo.descripcion}</span>}
                  <p className="text-zinc-600 text-xs mt-0.5">
                    {tipo.documentos_requeridos_equipo.filter(d => d.activo).length} docs específicos
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editandoTipo !== tipo.id && (
                <button onClick={() => { setTipoForm({ nombre: tipo.nombre, descripcion: tipo.descripcion ?? '', icono: tipo.icono }); setEditandoTipo(tipo.id) }}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              <button onClick={() => toggleTipoActivo(tipo)} disabled={loading}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  tipo.activo
                    ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                    : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                }`}>
                {tipo.activo ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {abierto === tipo.id && editandoTipo !== tipo.id && (
            <div className="border-t border-white/[0.06]">
              {tipo.documentos_requeridos_equipo.length === 0 ? (
                <div className="px-5 py-4 text-center">
                  <p className="text-zinc-600 text-sm">Sin documentos específicos — solo aplican los generales</p>
                </div>
              ) : (
                <ListaDocs docs={tipo.documentos_requeridos_equipo} tipoId={tipo.id}/>
              )}
              <div className="px-5 py-3 border-t border-white/[0.04]">
                {nuevoDocEn === tipo.id ? (
                  <DocFormFields onSave={() => crearDoc(tipo.id)} onCancel={() => { setNuevoDocEn(null); setDocForm(emptyDocForm) }}/>
                ) : (
                  <button onClick={() => { setDocForm(emptyDocForm); setNuevoDocEn(tipo.id); setEditandoDoc(null) }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Agregar documento específico para {tipo.nombre}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {tipos.length === 0 && !creando && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm mb-3">No hay tipos de equipo configurados todavía</p>
          <button onClick={() => setCreando(true)} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">Crear el primero →</button>
        </div>
      )}
    </div>
  )
}
