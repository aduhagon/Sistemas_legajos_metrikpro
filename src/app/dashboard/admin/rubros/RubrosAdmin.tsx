'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type DocReq = {
  id: string
  codigo: string
  nombre: string
  tipo_vigencia: string
  obligatorio: boolean
  aplica_persona_fisica: boolean
  aplica_persona_juridica: boolean
  activo: boolean
}

type Rubro = {
  id: string
  codigo: number
  nombre: string
  descripcion: string | null
  activo: boolean
  documentos_requeridos: DocReq[]
}

const VIGENCIAS = ['PERMANENTE', 'ANUAL', 'MENSUAL']

const emptyDocForm = {
  codigo: '', nombre: '', tipo_vigencia: 'ANUAL',
  obligatorio: true, aplica_persona_fisica: true, aplica_persona_juridica: true,
}

export default function RubrosAdmin({
  rubros: rubrosIniciales,
  docsGenerales: docsGeneralesIniciales,
}: {
  rubros: Rubro[]
  docsGenerales: DocReq[]
}) {
  const router = useRouter()
  const [rubros, setRubros] = useState(rubrosIniciales)
  const [docsGenerales, setDocsGenerales] = useState(docsGeneralesIniciales)
  const [rubroAbierto, setRubroAbierto] = useState<string | null>(null)
  const [generalesAbierto, setGeneralesAbierto] = useState(true)
  const [editandoRubro, setEditandoRubro] = useState<string | null>(null)
  const [editandoDoc, setEditandoDoc] = useState<string | null>(null)
  const [nuevoDocEn, setNuevoDocEn] = useState<string | null>(null) // rubro_id o 'general'
  const [loading, setLoading] = useState(false)
  const [rubroForm, setRubroForm] = useState({ nombre: '', descripcion: '' })
  const [docForm, setDocForm] = useState(emptyDocForm)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
  const checkCls = "w-4 h-4 rounded border border-white/[0.2] bg-white/[0.05] accent-blue-500 cursor-pointer"

  // ── Toggle rubro activo ──
  async function toggleRubroActivo(rubro: Rubro) {
    setLoading(true)
    await supabase.from('rubros').update({ activo: !rubro.activo }).eq('id', rubro.id)
    setRubros(r => r.map(r2 => r2.id === rubro.id ? { ...r2, activo: !rubro.activo } : r2))
    setLoading(false)
  }

  // ── Editar rubro ──
  function abrirEditRubro(rubro: Rubro) {
    setRubroForm({ nombre: rubro.nombre, descripcion: rubro.descripcion ?? '' })
    setEditandoRubro(rubro.id)
  }

  async function guardarRubro(rubroId: string) {
    setLoading(true)
    await supabase.from('rubros').update({ nombre: rubroForm.nombre, descripcion: rubroForm.descripcion || null }).eq('id', rubroId)
    setRubros(r => r.map(r2 => r2.id === rubroId ? { ...r2, nombre: rubroForm.nombre, descripcion: rubroForm.descripcion } : r2))
    setEditandoRubro(null)
    setLoading(false)
  }

  // ── Toggle doc activo (general o de rubro) ──
  async function toggleDocActivo(doc: DocReq, rubroId?: string) {
    setLoading(true)
    await supabase.from('documentos_requeridos').update({ activo: !doc.activo }).eq('id', doc.id)
    if (rubroId) {
      setRubros(r => r.map(r2 => r2.id === rubroId
        ? { ...r2, documentos_requeridos: r2.documentos_requeridos.map(d => d.id === doc.id ? { ...d, activo: !doc.activo } : d) }
        : r2))
    } else {
      setDocsGenerales(d => d.map(d2 => d2.id === doc.id ? { ...d2, activo: !doc.activo } : d2))
    }
    setLoading(false)
  }

  // ── Editar doc ──
  function abrirEditDoc(doc: DocReq) {
    setDocForm({ codigo: doc.codigo, nombre: doc.nombre, tipo_vigencia: doc.tipo_vigencia,
      obligatorio: doc.obligatorio, aplica_persona_fisica: doc.aplica_persona_fisica,
      aplica_persona_juridica: doc.aplica_persona_juridica })
    setEditandoDoc(doc.id)
    setNuevoDocEn(null)
  }

  async function guardarDoc(doc: DocReq, rubroId?: string) {
    setLoading(true)
    await supabase.from('documentos_requeridos').update({
      codigo: docForm.codigo, nombre: docForm.nombre, tipo_vigencia: docForm.tipo_vigencia,
      obligatorio: docForm.obligatorio, aplica_persona_fisica: docForm.aplica_persona_fisica,
      aplica_persona_juridica: docForm.aplica_persona_juridica,
    }).eq('id', doc.id)
    if (rubroId) {
      setRubros(r => r.map(r2 => r2.id === rubroId
        ? { ...r2, documentos_requeridos: r2.documentos_requeridos.map(d => d.id === doc.id ? { ...d, ...docForm } : d) }
        : r2))
    } else {
      setDocsGenerales(d => d.map(d2 => d2.id === doc.id ? { ...d2, ...docForm } : d2))
    }
    setEditandoDoc(null)
    setLoading(false)
  }

  // ── Crear doc ──
  async function crearDoc(rubroId: string | null) {
    setLoading(true)
    const { data: grupo } = await supabase.from('grupos_trabajo').select('id').eq('slug', 'metrikpro').single()
    const { data: nuevo } = await supabase.from('documentos_requeridos').insert({
      grupo_id: grupo?.id, rubro_id: rubroId,
      codigo: docForm.codigo, nombre: docForm.nombre,
      tipo_vigencia: docForm.tipo_vigencia, obligatorio: docForm.obligatorio,
      aplica_persona_fisica: docForm.aplica_persona_fisica,
      aplica_persona_juridica: docForm.aplica_persona_juridica, activo: true,
    }).select().single()

    if (nuevo) {
      if (rubroId) {
        setRubros(r => r.map(r2 => r2.id === rubroId
          ? { ...r2, documentos_requeridos: [...r2.documentos_requeridos, nuevo as DocReq] }
          : r2))
      } else {
        setDocsGenerales(d => [...d, nuevo as DocReq])
      }
    }
    setNuevoDocEn(null)
    setDocForm(emptyDocForm)
    setLoading(false)
  }

  // ── Form de documento (reutilizable) ──
  function DocFormFields({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1">Código *</label>
            <input value={docForm.codigo} onChange={e => setDocForm(f => ({ ...f, codigo: e.target.value }))}
              placeholder="G-01" className={inputCls}/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1">Vigencia *</label>
            <select value={docForm.tipo_vigencia} onChange={e => setDocForm(f => ({ ...f, tipo_vigencia: e.target.value }))}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
              {VIGENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">Nombre del documento *</label>
          <input value={docForm.nombre} onChange={e => setDocForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Constancia inscripción AFIP" className={inputCls}/>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={docForm.obligatorio}
              onChange={e => setDocForm(f => ({ ...f, obligatorio: e.target.checked }))} className={checkCls}/>
            <span className="text-zinc-300 text-sm">Obligatorio</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={docForm.aplica_persona_fisica}
              onChange={e => setDocForm(f => ({ ...f, aplica_persona_fisica: e.target.checked }))} className={checkCls}/>
            <span className="text-zinc-300 text-sm">Persona Física</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={docForm.aplica_persona_juridica}
              onChange={e => setDocForm(f => ({ ...f, aplica_persona_juridica: e.target.checked }))} className={checkCls}/>
            <span className="text-zinc-300 text-sm">Persona Jurídica</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onSave} disabled={loading || !docForm.codigo || !docForm.nombre}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors px-3 py-2">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Lista de documentos (reutilizable) ──
  function ListaDocs({ docs, rubroId }: { docs: DocReq[]; rubroId?: string }) {
    return (
      <div className="divide-y divide-white/[0.04]">
        {docs.map(doc => (
          <div key={doc.id} className={`px-5 py-3 ${!doc.activo ? 'opacity-50' : ''}`}>
            {editandoDoc === doc.id ? (
              <DocFormFields
                onSave={() => guardarDoc(doc, rubroId)}
                onCancel={() => setEditandoDoc(null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-zinc-600 text-xs font-mono w-10 shrink-0">{doc.codigo}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{doc.nombre}</span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-zinc-600 text-xs">{doc.tipo_vigencia}</span>
                    {doc.obligatorio && <span className="text-zinc-600 text-xs">· Obligatorio</span>}
                    {doc.aplica_persona_fisica && !doc.aplica_persona_juridica && <span className="text-zinc-600 text-xs">· Solo PF</span>}
                    {!doc.aplica_persona_fisica && doc.aplica_persona_juridica && <span className="text-zinc-600 text-xs">· Solo PJ</span>}
                    {doc.aplica_persona_fisica && doc.aplica_persona_juridica && <span className="text-zinc-600 text-xs">· PF y PJ</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => abrirEditDoc(doc)}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button onClick={() => toggleDocActivo(doc, rubroId)} disabled={loading}
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

      {/* ── SECCIÓN: Documentos generales ── */}
      <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3">
          <button onClick={() => setGeneralesAbierto(!generalesAbierto)}
            className="text-zinc-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${generalesAbierto ? 'rotate-90' : ''}`}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Documentos generales</span>
              <span className="text-zinc-500 text-xs">
                {docsGenerales.filter(d => d.activo).length} activos de {docsGenerales.length}
              </span>
            </div>
            <p className="text-zinc-600 text-xs mt-0.5">Aplican a todos los rubros independientemente</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
            Todos los rubros
          </span>
        </div>

        {generalesAbierto && (
          <div className="border-t border-white/[0.06]">
            <ListaDocs docs={docsGenerales} />
            <div className="px-5 py-3 border-t border-white/[0.04]">
              {nuevoDocEn === 'general' ? (
                <DocFormFields
                  onSave={() => crearDoc(null)}
                  onCancel={() => { setNuevoDocEn(null); setDocForm(emptyDocForm) }}
                />
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

      {/* ── SECCIÓN: Rubros con docs específicos ── */}
      {rubros.map(rubro => (
        <div key={rubro.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden transition-all ${rubro.activo ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>
          <div className="px-5 py-4 flex items-center gap-3">
            <button onClick={() => setRubroAbierto(rubroAbierto === rubro.id ? null : rubro.id)}
              className="text-zinc-400 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${rubroAbierto === rubro.id ? 'rotate-90' : ''}`}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <div className="flex-1">
              {editandoRubro === rubro.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={rubroForm.nombre} onChange={e => setRubroForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 w-40"/>
                  <input value={rubroForm.descripcion} onChange={e => setRubroForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción (opcional)"
                    className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 flex-1"/>
                  <button onClick={() => guardarRubro(rubro.id)} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">Guardar</button>
                  <button onClick={() => setEditandoRubro(null)} className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 text-xs font-mono w-5">{rubro.codigo}</span>
                  <span className="text-white font-medium">{rubro.nombre}</span>
                  {rubro.descripcion && <span className="text-zinc-500 text-sm">{rubro.descripcion}</span>}
                  <span className="text-zinc-600 text-xs">
                    {rubro.documentos_requeridos.filter(d => d.activo).length} docs específicos
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editandoRubro !== rubro.id && (
                <button onClick={() => abrirEditRubro(rubro)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              <button onClick={() => toggleRubroActivo(rubro)} disabled={loading}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  rubro.activo
                    ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                    : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                }`}>
                {rubro.activo ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {rubroAbierto === rubro.id && (
            <div className="border-t border-white/[0.06]">
              {rubro.documentos_requeridos.length === 0 ? (
                <div className="px-5 py-4 text-center">
                  <p className="text-zinc-600 text-sm">Sin documentos específicos para este rubro</p>
                  <p className="text-zinc-700 text-xs mt-1">Los documentos generales aplican automáticamente</p>
                </div>
              ) : (
                <ListaDocs docs={rubro.documentos_requeridos} rubroId={rubro.id} />
              )}
              <div className="px-5 py-3 border-t border-white/[0.04]">
                {nuevoDocEn === rubro.id ? (
                  <DocFormFields
                    onSave={() => crearDoc(rubro.id)}
                    onCancel={() => { setNuevoDocEn(null); setDocForm(emptyDocForm) }}
                  />
                ) : (
                  <button onClick={() => { setDocForm(emptyDocForm); setNuevoDocEn(rubro.id); setEditandoDoc(null) }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Agregar documento específico para {rubro.nombre}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
