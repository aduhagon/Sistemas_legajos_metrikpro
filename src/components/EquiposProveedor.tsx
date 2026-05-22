'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

type DocEquipo = {
  id: string
  estado: string
  fecha_venc: string | null
  archivo_url: string | null
  observaciones: string | null
  documentos_requeridos_equipo: {
    nombre: string
    tipo_vigencia: string
    obligatorio: boolean
  }
}

type Equipo = {
  id: string
  dominio: string
  marca: string | null
  modelo: string | null
  anio: number | null
  estado: string
  tipos_equipo: { nombre: string; icono: string }
  documentos_equipo: DocEquipo[]
}

type TipoEquipo = {
  id: string
  nombre: string
  icono: string
}

const estadoDocCfg: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'zinc' },
  CARGADO:   { label: 'Cargado',   color: 'blue' },
  APROBADO:  { label: 'Aprobado',  color: 'green' },
  RECHAZADO: { label: 'Rechazado', color: 'red' },
  VENCIDO:   { label: 'Vencido',   color: 'orange' },
}

const estadoEquipoCfg: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue' },
  APROBADO:    { label: 'Aprobado',    color: 'green' },
  RECHAZADO:   { label: 'Rechazado',   color: 'red' },
  INACTIVO:    { label: 'Inactivo',    color: 'zinc' },
}

function colorClass(color: string) {
  return color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
         color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
         color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
         color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
         color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
         'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

const emptyForm = {
  tipo_equipo_id: '', dominio: '', marca: '', modelo: '',
  anio: '', descripcion: '', seguro_compania: '', seguro_poliza: '', seguro_vto: '',
}

export default function EquiposProveedor({
  proveedorId,
  equiposIniciales,
  tiposEquipo,
}: {
  proveedorId: string
  equiposIniciales: Equipo[]
  tiposEquipo: TipoEquipo[]
}) {
  const [equipos, setEquipos] = useState(equiposIniciales)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)
  const [fechas, setFechas] = useState<Record<string, string>>({})

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  async function registrarEquipo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('registrar_equipo', {
      p_proveedor_id:    proveedorId,
      p_tipo_equipo_id:  form.tipo_equipo_id,
      p_dominio:         form.dominio,
      p_marca:           form.marca || null,
      p_modelo:          form.modelo || null,
      p_anio:            form.anio ? parseInt(form.anio) : null,
      p_descripcion:     form.descripcion || null,
      p_seguro_compania: form.seguro_compania || null,
      p_seguro_poliza:   form.seguro_poliza || null,
      p_seguro_vto:      form.seguro_vto || null,
    })
    if (err || data?.ok === false) {
      setError(data?.error ?? err?.message ?? 'Error al registrar el equipo')
      setLoading(false)
      return
    }
    // Recargar equipos
    const { data: nuevosEquipos } = await supabase
      .from('equipos_contratista')
      .select(`
        id, dominio, marca, modelo, anio, estado,
        tipos_equipo(nombre, icono),
        documentos_equipo(
          id, estado, fecha_venc, archivo_url, observaciones,
          documentos_requeridos_equipo(nombre, tipo_vigencia, obligatorio)
        )
      `)
      .eq('proveedor_id', proveedorId)
      .order('created_at', { ascending: false })
    setEquipos((nuevosEquipos as unknown as Equipo[]) ?? [])
    setCreando(false)
    setForm(emptyForm)
    setAbierto(data.equipo_id)
    setLoading(false)
  }

  async function handleUpload(equipoId: string, docId: string, file: File) {
    const doc = equipos.find(e => e.id === equipoId)?.documentos_equipo.find(d => d.id === docId)
    const necesitaFecha = doc?.documentos_requeridos_equipo?.tipo_vigencia !== 'PERMANENTE'
    if (necesitaFecha && !fechas[docId]) {
      setError(`Ingresá la fecha de vencimiento antes de subir.`)
      return
    }
    setSubiendo(docId)
    setUploadOk(null)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `equipos/${equipoId}/${docId}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 60 * 24 * 365)
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      await supabase.rpc('presentar_documento_equipo', {
        p_doc_id: docId,
        p_archivo_url: urlData?.signedUrl ?? path,
        p_hash_sha256: hash,
        p_fecha_venc: fechas[docId] || null,
      })
      setEquipos(prev => prev.map(eq => eq.id === equipoId
        ? {
            ...eq,
            documentos_equipo: eq.documentos_equipo.map(d => d.id === docId
              ? { ...d, estado: 'CARGADO', archivo_url: urlData?.signedUrl ?? path, fecha_venc: fechas[docId] || null }
              : d
            )
          }
        : eq
      ))
      setUploadOk(docId)
    } catch (err: any) {
      setError(`Error al subir: ${err.message}`)
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <div className="space-y-3">

      {/* Botón registrar equipo */}
      {!creando && (
        <button onClick={() => setCreando(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar equipo / vehículo
        </button>
      )}

      {/* Form nuevo equipo */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5">
          <p className="text-sm font-medium mb-4">Nuevo equipo / vehículo</p>
          <form onSubmit={registrarEquipo} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-zinc-400 text-xs mb-1.5">Tipo de equipo *</label>
                <select value={form.tipo_equipo_id} onChange={e => setForm(f => ({ ...f, tipo_equipo_id: e.target.value }))}
                  required className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                  <option value="">Seleccioná el tipo</option>
                  {tiposEquipo.map(t => (
                    <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Dominio / Patente *</label>
                <input value={form.dominio} onChange={e => setForm(f => ({ ...f, dominio: e.target.value.toUpperCase() }))}
                  required placeholder="ABC 123" className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Año</label>
                <input value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                  type="number" placeholder="2020" min="1900" max="2030" className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Marca</label>
                <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                  placeholder="Ford" className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Modelo</label>
                <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                  placeholder="F-100" className={inputCls}/>
              </div>
            </div>

            {/* Datos del seguro */}
            <div>
              <p className="text-zinc-400 text-xs font-medium mb-2">Datos del seguro (opcional — también podés cargarlo como documento)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Compañía</label>
                  <input value={form.seguro_compania} onChange={e => setForm(f => ({ ...f, seguro_compania: e.target.value }))}
                    placeholder="La Segunda" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">N° Póliza</label>
                  <input value={form.seguro_poliza} onChange={e => setForm(f => ({ ...f, seguro_poliza: e.target.value }))}
                    placeholder="123456789" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Vencimiento</label>
                  <input type="date" value={form.seguro_vto} onChange={e => setForm(f => ({ ...f, seguro_vto: e.target.value }))}
                    className={inputCls}/>
                </div>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading || !form.tipo_equipo_id || !form.dominio}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
                {loading ? 'Registrando...' : 'Registrar equipo'}
              </button>
              <button type="button" onClick={() => { setCreando(false); setForm(emptyForm); setError('') }}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de equipos */}
      {equipos.length === 0 && !creando && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10 text-center">
          <p className="text-zinc-500 text-sm mb-2">No tenés equipos registrados todavía</p>
          <p className="text-zinc-700 text-xs">Registrá tus vehículos y maquinarias para mantener su documentación al día</p>
        </div>
      )}

      {equipos.map(equipo => {
        const tipo = equipo.tipos_equipo
        const cfg = estadoEquipoCfg[equipo.estado] ?? estadoEquipoCfg.PENDIENTE
        const docsOk = equipo.documentos_equipo.filter(d => d.estado === 'APROBADO').length
        const docsTotal = equipo.documentos_equipo.length
        const docsProblema = equipo.documentos_equipo.filter(d => ['RECHAZADO', 'VENCIDO'].includes(d.estado)).length

        return (
          <div key={equipo.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            {/* Header equipo */}
            <div className="px-5 py-4 flex items-center gap-3">
              <button onClick={() => setAbierto(abierto === equipo.id ? null : equipo.id)}
                className="text-zinc-400 hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${abierto === equipo.id ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <span className="text-2xl shrink-0">{tipo?.icono}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium font-mono">{equipo.dominio}</span>
                  {tipo && <span className="text-zinc-500 text-xs">{tipo.nombre}</span>}
                  {equipo.marca && <span className="text-zinc-600 text-xs">{equipo.marca} {equipo.modelo}</span>}
                  {docsProblema > 0 && <span className="text-orange-400 text-xs">⚠ {docsProblema} doc{docsProblema > 1 ? 's' : ''}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-20 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${docsTotal > 0 ? (docsOk / docsTotal) * 100 : 0}%` }}/>
                    </div>
                    <span className="text-zinc-600 text-xs">{docsOk}/{docsTotal}</span>
                  </div>
                </div>
              </div>

              <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${colorClass(cfg.color)}`}>
                {cfg.label}
              </span>
            </div>

            {/* Documentos del equipo */}
            {abierto === equipo.id && (
              <div className="border-t border-white/[0.06]">
                {/* Info básica */}
                {(equipo.marca || equipo.modelo || equipo.anio) && (
                  <div className="px-5 py-3 flex gap-4 flex-wrap border-b border-white/[0.04]">
                    {equipo.marca && <span className="text-zinc-400 text-xs">Marca: <span className="text-zinc-300">{equipo.marca}</span></span>}
                    {equipo.modelo && <span className="text-zinc-400 text-xs">Modelo: <span className="text-zinc-300">{equipo.modelo}</span></span>}
                    {equipo.anio && <span className="text-zinc-400 text-xs">Año: <span className="text-zinc-300">{equipo.anio}</span></span>}
                  </div>
                )}

                <div className="px-5 py-3 border-b border-white/[0.04]">
                  <p className="text-zinc-500 text-xs font-medium mb-2">Documentos requeridos</p>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {equipo.documentos_equipo.map(doc => {
                    const dr = doc.documentos_requeridos_equipo
                    const dcfg = estadoDocCfg[doc.estado] ?? estadoDocCfg.PENDIENTE
                    const estaSubiendo = subiendo === doc.id
                    const necesitaFecha = dr?.tipo_vigencia !== 'PERMANENTE'

                    return (
                      <div key={doc.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm text-white">{dr?.nombre}</span>
                              {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                              {doc.fecha_venc && (
                                <span className="text-zinc-500 text-xs">Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>
                              )}
                              {doc.observaciones && <span className="text-orange-400 text-xs">⚠ {doc.observaciones}</span>}
                              {uploadOk === doc.id && <span className="text-green-400 text-xs">✓ Subido</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass(dcfg.color)}`}>{dcfg.label}</span>
                            {doc.archivo_url && (
                              <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Archivo adjunto — visible siempre, editable si no está aprobado */}
                        <div className="mt-3 space-y-2">
                          {doc.archivo_url && (
                            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex-1 truncate">
                                Ver documento adjunto →
                              </a>
                            </div>
                          )}
                          {doc.estado !== 'APROBADO' && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {necesitaFecha && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-600 text-xs shrink-0">Vence:</span>
                                  <input type="date" value={fechas[doc.id] || doc.fecha_venc || ''}
                                    onChange={e => setFechas(f => ({ ...f, [doc.id]: e.target.value }))}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1 text-white text-xs"/>
                                </div>
                              )}
                              <label className={`cursor-pointer ${estaSubiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(equipo.id, doc.id, f) }}/>
                                <span className={`text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 border transition-all ${
                                  estaSubiendo
                                    ? 'bg-white/[0.03] border-white/[0.08] text-zinc-500'
                                    : doc.archivo_url
                                      ? 'bg-white/[0.05] hover:bg-white/[0.08] border-white/[0.1] text-zinc-400'
                                      : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-300'
                                }`}>
                                  {estaSubiendo ? (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                      </svg>
                                      Subiendo...
                                    </>
                                  ) : doc.archivo_url ? (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                      </svg>
                                      Reemplazar archivo
                                    </>
                                  ) : (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                      </svg>
                                      Adjuntar archivo
                                    </>
                                  )}
                                </span>
                              </label>
                              {uploadOk === doc.id && (
                                <span className="text-green-400 text-xs flex items-center gap-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20,6 9,17 4,12"/>
                                  </svg>
                                  Guardado
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {equipo.documentos_equipo.length === 0 && (
                    <div className="px-5 py-4 text-center">
                      <p className="text-zinc-600 text-sm">Sin documentos requeridos configurados para este tipo</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {error && !creando && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}
    </div>
  )
}
