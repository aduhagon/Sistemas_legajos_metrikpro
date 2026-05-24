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

type TipoEquipo = { id: string; nombre: string; icono: string }

// ── helpers ──────────────────────────────────────────────────────────────────
const ESTADO_EQUIPO: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  INACTIVO:    { label: 'Inactivo',    color: 'zinc'   },
}

const ESTADO_DOC: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'zinc'   },
  CARGADO:   { label: 'Cargado',   color: 'blue'   },
  APROBADO:  { label: 'Aprobado',  color: 'green'  },
  RECHAZADO: { label: 'Rechazado', color: 'red'    },
  VENCIDO:   { label: 'Vencido',   color: 'orange' },
}

function badgeClass(color: string) {
  return color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
         color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
         color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
         color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
         color === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
         'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function formatFecha(f: string) {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR')
}

const emptyForm = {
  tipo_equipo_id: '', dominio: '', marca: '', modelo: '',
  anio: '', seguro_compania: '', seguro_poliza: '', seguro_vto: '',
}

// ── UploadModal ───────────────────────────────────────────────────────────────
function UploadModal({
  docId, equipoId, nombre, tipoVigencia, fechaActual, onClose, onSuccess,
}: {
  docId: string; equipoId: string; nombre: string
  tipoVigencia: string; fechaActual: string | null
  onClose: () => void
  onSuccess: (docId: string, url: string, fecha: string | null) => void
}) {
  const necesitaFecha = tipoVigencia !== 'PERMANENTE'
  const [fecha, setFecha] = useState(fechaActual ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const hoyStr = new Date().toISOString().split('T')[0]

  async function handleSubmit() {
    if (!archivo) { setError('Seleccioná un archivo'); return }
    if (necesitaFecha && !fecha) { setError('Ingresá la fecha de vencimiento'); return }

    setUploading(true)
    setError('')
    try {
      // DT-002: upload + hash SHA-256 delegados al servidor
      const form = new FormData()
      form.append('file', archivo)
      form.append('doc_id', docId)
      form.append('tipo', 'equipo')
      if (necesitaFecha && fecha) form.append('fecha_venc', fecha)

      const res = await fetch('/api/proveedor/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir el archivo')

      setOk(true)
      onSuccess(docId, '', necesitaFecha ? fecha : null)
      setTimeout(onClose, 1200)
    } catch (err: any) {
      setError(err.message ?? 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium text-sm">Subir documento</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-56">{nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {ok ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-400 font-medium">¡Documento enviado!</p>
            </div>
          ) : (
            <>
              {necesitaFecha && (
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">
                    Fecha de vencimiento <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date" value={fecha} min={hoyStr}
                    onChange={e => setFecha(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">
                  Archivo <span className="text-red-400">*</span>
                  <span className="text-zinc-600 ml-1">(PDF, JPG, PNG — máx. 10MB)</span>
                </label>
                <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all ${
                  archivo
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]'
                }`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke={archivo ? '#60a5fa' : '#52525b'} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    {archivo ? (
                      <>
                        <p className="text-blue-300 text-sm font-medium truncate">{archivo.name}</p>
                        <p className="text-zinc-500 text-xs">{(archivo.size / 1024).toFixed(0)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-zinc-400 text-sm">Tocá para seleccionar</p>
                        <p className="text-zinc-600 text-xs">o arrastrá el archivo acá</p>
                      </>
                    )}
                  </div>
                  {archivo && (
                    <button type="button"
                      onClick={e => { e.preventDefault(); setArchivo(null) }}
                      className="text-zinc-500 hover:text-zinc-300 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose}
                  className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl transition-all">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !archivo || (necesitaFecha && !fecha)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Subiendo…
                    </>
                  ) : 'Enviar documento'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function EquiposProveedor({
  proveedorId, equiposIniciales, tiposEquipo,
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
  const [formError, setFormError] = useState('')
  const [uploadModal, setUploadModal] = useState<{
    docId: string; equipoId: string; nombre: string
    tipoVigencia: string; fechaActual: string | null
  } | null>(null)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  async function registrarEquipo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setFormError('')
    const { data, error: err } = await supabase.rpc('registrar_equipo', {
      p_proveedor_id:    proveedorId,
      p_tipo_equipo_id:  form.tipo_equipo_id,
      p_dominio:         form.dominio,
      p_marca:           form.marca || null,
      p_modelo:          form.modelo || null,
      p_anio:            form.anio ? parseInt(form.anio) : null,
      p_descripcion:     null,
      p_seguro_compania: form.seguro_compania || null,
      p_seguro_poliza:   form.seguro_poliza || null,
      p_seguro_vto:      form.seguro_vto || null,
    })
    if (err || data?.ok === false) {
      setFormError(data?.error ?? err?.message ?? 'Error al registrar el equipo')
      setLoading(false)
      return
    }
    const { data: nuevos } = await supabase
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
    setEquipos((nuevos as unknown as Equipo[]) ?? [])
    setCreando(false)
    setForm(emptyForm)
    setAbierto(data.equipo_id)
    setLoading(false)
  }

  function handleUploadSuccess(docId: string, url: string, fecha: string | null) {
    setEquipos(prev => prev.map(eq => ({
      ...eq,
      documentos_equipo: eq.documentos_equipo.map(d =>
        d.id === docId
          ? { ...d, estado: 'CARGADO', archivo_url: url, fecha_venc: fecha }
          : d
      ),
    })))
  }

  return (
    <div className="space-y-3">

      {/* Botón registrar */}
      {!creando && (
        <button onClick={() => setCreando(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors w-full justify-center">
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
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Tipo de equipo *</label>
              <select value={form.tipo_equipo_id}
                onChange={e => setForm(f => ({ ...f, tipo_equipo_id: e.target.value }))}
                required className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60">
                <option value="">Seleccioná el tipo</option>
                {tiposEquipo.map(t => <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Dominio / Patente *</label>
                <input value={form.dominio}
                  onChange={e => setForm(f => ({ ...f, dominio: e.target.value.toUpperCase() }))}
                  required placeholder="ABC 123" className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Año</label>
                <input value={form.anio} type="number" placeholder="2020" min="1900" max="2030"
                  onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                  className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Marca</label>
                <input value={form.marca} placeholder="Ford"
                  onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                  className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Modelo</label>
                <input value={form.modelo} placeholder="F-100"
                  onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                  className={inputCls}/>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-xs font-medium mb-2">Seguro (opcional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Compañía</label>
                  <input value={form.seguro_compania} placeholder="La Segunda"
                    onChange={e => setForm(f => ({ ...f, seguro_compania: e.target.value }))}
                    className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">N° Póliza</label>
                  <input value={form.seguro_poliza} placeholder="123456789"
                    onChange={e => setForm(f => ({ ...f, seguro_poliza: e.target.value }))}
                    className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Vencimiento</label>
                  <input type="date" value={form.seguro_vto}
                    onChange={e => setForm(f => ({ ...f, seguro_vto: e.target.value }))}
                    className={inputCls}/>
                </div>
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading || !form.tipo_equipo_id || !form.dominio}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
                {loading ? 'Registrando...' : 'Registrar equipo'}
              </button>
              <button type="button"
                onClick={() => { setCreando(false); setForm(emptyForm); setFormError('') }}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {equipos.length === 0 && !creando && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10 text-center">
          <p className="text-zinc-500 text-sm mb-1">No tenés equipos registrados todavía</p>
          <p className="text-zinc-700 text-xs">Registrá tus vehículos y maquinarias para mantener su documentación al día</p>
        </div>
      )}

      {/* Lista de equipos */}
      {equipos.map(equipo => {
        const tipo = equipo.tipos_equipo
        const cfg = ESTADO_EQUIPO[equipo.estado] ?? ESTADO_EQUIPO.PENDIENTE
        const docsOk      = equipo.documentos_equipo.filter(d => d.estado === 'APROBADO').length
        const docsTotal   = equipo.documentos_equipo.length
        const docsVencidos = equipo.documentos_equipo.filter(d => ['RECHAZADO', 'VENCIDO'].includes(d.estado)).length
        const isOpen = abierto === equipo.id

        return (
          <div key={equipo.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">

            {/* Header — clickeable completo */}
            <button
              onClick={() => setAbierto(isOpen ? null : equipo.id)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-zinc-500 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>

              <span className="text-xl shrink-0">{tipo?.icono}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium font-mono">{equipo.dominio}</span>
                  {tipo && <span className="text-zinc-500 text-xs">{tipo.nombre}</span>}
                  {(equipo.marca || equipo.modelo) && (
                    <span className="text-zinc-600 text-xs">{equipo.marca} {equipo.modelo}</span>
                  )}
                  {docsVencidos > 0 && (
                    <span className="text-orange-400 text-xs">⚠ {docsVencidos} vencido{docsVencidos > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-20 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${docsTotal > 0 ? (docsOk / docsTotal) * 100 : 0}%` }}/>
                  </div>
                  <span className="text-zinc-600 text-xs">{docsOk}/{docsTotal} docs</span>
                </div>
              </div>

              <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${badgeClass(cfg.color)}`}>
                {cfg.label}
              </span>
            </button>

            {/* Detalle */}
            {isOpen && (
              <div className="border-t border-white/[0.06]">
                {/* Datos básicos */}
                {(equipo.marca || equipo.modelo || equipo.anio) && (
                  <div className="px-5 py-3 flex gap-4 flex-wrap border-b border-white/[0.04] bg-white/[0.01]">
                    {equipo.marca  && <span className="text-zinc-400 text-xs">Marca: <span className="text-zinc-300">{equipo.marca}</span></span>}
                    {equipo.modelo && <span className="text-zinc-400 text-xs">Modelo: <span className="text-zinc-300">{equipo.modelo}</span></span>}
                    {equipo.anio   && <span className="text-zinc-400 text-xs">Año: <span className="text-zinc-300">{equipo.anio}</span></span>}
                  </div>
                )}

                {/* Docs */}
                {equipo.documentos_equipo.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-zinc-600 text-sm">Sin documentos requeridos para este tipo de equipo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {equipo.documentos_equipo.map(doc => {
                      const dr = doc.documentos_requeridos_equipo
                      const dcfg = ESTADO_DOC[doc.estado] ?? ESTADO_DOC.PENDIENTE
                      const diasV = doc.fecha_venc ? diasHasta(doc.fecha_venc) : null
                      const estaVencido = diasV !== null && diasV < 0
                      const puedeSubir = doc.estado !== 'APROBADO'

                      return (
                        <div key={doc.id} className="px-5 py-4 flex items-center gap-3">
                          {/* Ícono estado */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                            doc.estado === 'APROBADO'  ? 'bg-green-500/15 text-green-400' :
                            doc.estado === 'CARGADO'   ? 'bg-blue-500/15 text-blue-400' :
                            doc.estado === 'RECHAZADO' ? 'bg-red-500/15 text-red-400' :
                            doc.estado === 'VENCIDO'   ? 'bg-orange-500/15 text-orange-400' :
                            'bg-zinc-500/15 text-zinc-500'
                          }`}>
                            {doc.estado === 'APROBADO'  ? '✓' :
                             doc.estado === 'CARGADO'   ? '⏳' :
                             doc.estado === 'RECHAZADO' ? '✗' :
                             doc.estado === 'VENCIDO'   ? '!' : '○'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm text-white">{dr?.nombre}</span>
                              {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                              {doc.fecha_venc && (
                                <span className={`text-xs ${estaVencido ? 'text-orange-400' : 'text-zinc-500'}`}>
                                  Vence {formatFecha(doc.fecha_venc)}
                                  {estaVencido && ' ⚠'}
                                  {!estaVencido && diasV !== null && diasV <= 30 && ` — en ${diasV}d`}
                                </span>
                              )}
                              {doc.observaciones && (
                                <span className="text-orange-400 text-xs">↳ {doc.observaciones}</span>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 shrink-0">
                            {doc.archivo_url && (
                              <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                                title="Ver archivo">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </a>
                            )}
                            {puedeSubir && (
                              <button
                                onClick={() => setUploadModal({
                                  docId:       doc.id,
                                  equipoId:    equipo.id,
                                  nombre:      dr?.nombre ?? '',
                                  tipoVigencia: dr?.tipo_vigencia ?? 'ANUAL',
                                  fechaActual: doc.fecha_venc,
                                })}
                                className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                {doc.estado === 'RECHAZADO' || doc.estado === 'VENCIDO' ? 'Renovar' : 'Subir'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Modal de upload */}
      {uploadModal && (
        <UploadModal
          {...uploadModal}
          onClose={() => setUploadModal(null)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  )
}
