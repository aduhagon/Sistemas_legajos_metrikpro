'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── helpers de estado ────────────────────────────────────────────────────────
const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  SUSPENDIDO:  { label: 'Suspendido',  color: 'zinc'   },
}

const ESTADO_EQUIPO_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  INACTIVO:    { label: 'Inactivo',    color: 'zinc'   },
}

function estadoBadgeClass(color: string) {
  return color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
         color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
         color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
         color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
         'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

function formatEstado(estado: string) {
  return ESTADO_LABEL[estado] ?? { label: estado, color: 'zinc' }
}

function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function formatFecha(fechaStr: string) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-AR')
}

// ── Tipos ────────────────────────────────────────────────────────────────────

type Tab = 'docs' | 'equipos' | 'historial' | 'personal' | 'accesos' | 'perfil' | 'auditorias'

type Props = {
  proveedor: any
  docs: any[]
  habilitacion: any | null
  operarios: any[]
  accesos: any[]
  historialPorDoc: Record<string, any[]>
  miRol: string
  visitasAuditoria: any[]
}

interface TipoEquipo {
  id: string
  nombre: string
  icono: string
}

interface DocRequerido {
  id: string
  nombre: string
  tipo_vigencia: 'PERMANENTE' | 'ANUAL' | 'MENSUAL'
  obligatorio: boolean
}

interface DocEquipo {
  id: string
  tipo_doc_id: string
  estado: 'PENDIENTE' | 'CARGADO' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO'
  fecha_venc: string | null
  archivo_url: string | null
  observaciones: string | null
  documentos_requeridos_equipo: DocRequerido
}

interface Equipo {
  id: string
  dominio: string
  marca: string | null
  modelo: string | null
  anio: number | null
  seguro_compania: string | null
  seguro_poliza: string | null
  seguro_vto: string | null
  estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'INACTIVO'
  tipos_equipo: TipoEquipo
  documentos_equipo: DocEquipo[]
}

const SECCIONES: { key: Tab; icon: string; label: string; color: string; bg: string }[] = [
  { key: 'docs',       icon: '📄', label: 'Documentos', color: 'text-blue-300',   bg: 'bg-blue-500/10 border-blue-500/20'     },
  { key: 'equipos',    icon: '🚛', label: 'Equipos',    color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20'  },
  { key: 'historial',  icon: '🕐', label: 'Historial',  color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20'  },
  { key: 'personal',   icon: '👥', label: 'Personal',   color: 'text-teal-300',   bg: 'bg-teal-500/10 border-teal-500/20'      },
  { key: 'accesos',    icon: '📍', label: 'Accesos',    color: 'text-green-300',  bg: 'bg-green-500/10 border-green-500/20'    },
  { key: 'perfil',     icon: '👤', label: 'Perfil',     color: 'text-zinc-300',   bg: 'bg-zinc-500/10 border-zinc-500/20'      },
  { key: 'auditorias', icon: '📋', label: 'Auditorías', color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/20'  },
]

// ── UploadModal (docs legajo) ─────────────────────────────────────────────────
function UploadModal({ docId, nombre, proveedorId, tipoVigencia, fechaActual, onClose }: {
  docId: string; nombre: string; proveedorId: string; tipoVigencia: string; fechaActual: string | null; onClose: () => void
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
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', archivo); form.append('doc_id', docId); form.append('tipo', 'legajo')
      if (necesitaFecha && fecha) form.append('fecha_venc', fecha)
      const res = await fetch('/api/proveedor/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir')
      setOk(true)
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) { setError(err.message ?? 'Error al subir el archivo') }
    finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium text-sm">Subir documento</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-56">{nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {ok ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-400 font-medium">¡Documento enviado!</p>
              <p className="text-zinc-500 text-xs mt-1">Recargando…</p>
            </div>
          ) : (
            <>
              {necesitaFecha && (
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Fecha de vencimiento <span className="text-red-400">*</span></label>
                  <input type="date" value={fecha} min={hoyStr} onChange={e => setFecha(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"/>
                </div>
              )}
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Archivo <span className="text-red-400">*</span> <span className="text-zinc-600">(PDF, JPG, PNG — máx. 10MB)</span></label>
                <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all ${archivo ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2]'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={archivo ? '#60a5fa' : '#52525b'} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    {archivo ? (<><p className="text-blue-300 text-sm font-medium truncate">{archivo.name}</p><p className="text-zinc-500 text-xs">{(archivo.size/1024).toFixed(0)} KB</p></>) :
                               (<><p className="text-zinc-400 text-sm">Tocá para seleccionar</p><p className="text-zinc-600 text-xs">o arrastrá el archivo acá</p></>)}
                  </div>
                  {archivo && <button type="button" onClick={e => { e.preventDefault(); setArchivo(null) }} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setArchivo(e.target.files?.[0] ?? null)}/>
                </label>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-red-400 text-xs">{error}</p></div>}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl">Cancelar</button>
                <button onClick={handleSubmit} disabled={uploading || !archivo || (necesitaFecha && !fecha)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
                  {uploading ? (<><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Subiendo…</>) : 'Enviar documento'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── UploadEquipoModal ─────────────────────────────────────────────────────────
function UploadEquipoModal({ doc, onClose, onSuccess }: {
  doc: DocEquipo; onClose: () => void; onSuccess: () => void
}) {
  const necesitaFecha = doc.documentos_requeridos_equipo.tipo_vigencia !== 'PERMANENTE'
  const [fecha, setFecha] = useState(doc.fecha_venc ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const hoyStr = new Date().toISOString().split('T')[0]

  async function handleSubmit() {
    if (!archivo) { setError('Seleccioná un archivo'); return }
    if (necesitaFecha && !fecha) { setError('Ingresá la fecha de vencimiento'); return }
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', archivo)
      form.append('doc_id', doc.id)
      form.append('tipo', 'equipo')
      if (necesitaFecha && fecha) form.append('fecha_venc', fecha)
      const res = await fetch('/api/proveedor/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir')
      setOk(true)
      setTimeout(() => { onSuccess(); onClose() }, 800)
    } catch (err: any) { setError(err.message ?? 'Error al subir el archivo') }
    finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium text-sm">Subir documento</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-56">{doc.documentos_requeridos_equipo.nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
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
                  <label className="block text-zinc-400 text-xs mb-1.5">Fecha de vencimiento <span className="text-red-400">*</span></label>
                  <input type="date" value={fecha} min={hoyStr} onChange={e => setFecha(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"/>
                </div>
              )}
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Archivo <span className="text-red-400">*</span> <span className="text-zinc-600">(PDF, JPG, PNG — máx. 10MB)</span></label>
                <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all ${archivo ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2]'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={archivo ? '#fb923c' : '#52525b'} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    {archivo ? (<><p className="text-orange-300 text-sm font-medium truncate">{archivo.name}</p><p className="text-zinc-500 text-xs">{(archivo.size/1024).toFixed(0)} KB</p></>) :
                               (<><p className="text-zinc-400 text-sm">Tocá para seleccionar</p><p className="text-zinc-600 text-xs">o arrastrá el archivo acá</p></>)}
                  </div>
                  {archivo && <button type="button" onClick={e => { e.preventDefault(); setArchivo(null) }} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setArchivo(e.target.files?.[0] ?? null)}/>
                </label>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-red-400 text-xs">{error}</p></div>}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl">Cancelar</button>
                <button onClick={handleSubmit} disabled={uploading || !archivo || (necesitaFecha && !fecha)}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
                  {uploading ? (<><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Subiendo…</>) : 'Enviar documento'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NuevoEquipoModal ──────────────────────────────────────────────────────────
function NuevoEquipoModal({ proveedorId, tiposEquipo, onClose, onSuccess }: {
  proveedorId: string; tiposEquipo: TipoEquipo[]; onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState({
    tipo_equipo_id: tiposEquipo[0]?.id ?? '',
    dominio: '', marca: '', modelo: '', anio: '',
    seguro_compania: '', seguro_poliza: '', seguro_vto: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-600'

  async function handleSubmit() {
    if (!form.dominio.trim()) { setError('El dominio/patente es requerido'); return }
    if (!form.tipo_equipo_id) { setError('Seleccioná un tipo de equipo'); return }
    setLoading(true); setError(null)
    const { data, error: rpcErr } = await supabase.rpc('registrar_equipo', {
      p_proveedor_id: proveedorId,
      p_tipo_equipo_id: form.tipo_equipo_id,
      p_dominio: form.dominio.trim().toUpperCase(),
      p_marca: form.marca || null,
      p_modelo: form.modelo || null,
      p_anio: form.anio ? parseInt(form.anio) : null,
      p_seguro_compania: form.seguro_compania || null,
      p_seguro_poliza: form.seguro_poliza || null,
      p_seguro_vto: form.seguro_vto || null,
    })
    setLoading(false)
    if (rpcErr) { setError(rpcErr.message); return }
    if (data && !data.ok) { setError(data.error ?? 'Error al registrar'); return }
    onSuccess(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl my-4">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-white font-medium text-sm">Registrar equipo</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Tipo */}
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Tipo de equipo <span className="text-red-400">*</span></label>
            <select value={form.tipo_equipo_id} onChange={e => set('tipo_equipo_id', e.target.value)}
              className={inputCls + ' bg-[#1a1d27]'}>
              {tiposEquipo.map(t => <option key={t.id} value={t.id} className="bg-[#1a1d27]">{t.icono} {t.nombre}</option>)}
            </select>
          </div>
          {/* Dominio */}
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Dominio / Patente <span className="text-red-400">*</span></label>
            <input type="text" placeholder="Ej: AB123CD" value={form.dominio}
              onChange={e => set('dominio', e.target.value.toUpperCase())} className={inputCls + ' uppercase'}/>
          </div>
          {/* Marca / Modelo */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Marca</label>
              <input type="text" placeholder="Ej: Ford" value={form.marca} onChange={e => set('marca', e.target.value)} className={inputCls}/>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Modelo</label>
              <input type="text" placeholder="Ej: F-100" value={form.modelo} onChange={e => set('modelo', e.target.value)} className={inputCls}/>
            </div>
          </div>
          {/* Año */}
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Año</label>
            <input type="number" placeholder="Ej: 2018" min={1950} max={new Date().getFullYear() + 1}
              value={form.anio} onChange={e => set('anio', e.target.value)} className={inputCls}/>
          </div>
          {/* Seguro */}
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-zinc-500 text-xs mb-2">Datos del seguro <span className="text-zinc-600">(opcional)</span></p>
            <div className="space-y-2">
              <input type="text" placeholder="Compañía aseguradora" value={form.seguro_compania}
                onChange={e => set('seguro_compania', e.target.value)} className={inputCls}/>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nº de póliza" value={form.seguro_poliza}
                  onChange={e => set('seguro_poliza', e.target.value)} className={inputCls}/>
                <input type="date" value={form.seguro_vto}
                  onChange={e => set('seguro_vto', e.target.value)} className={inputCls}/>
              </div>
            </div>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-red-400 text-xs">{error}</p></div>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={loading} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl">Cancelar</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
              {loading ? (<><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Registrando…</>) : 'Registrar equipo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EquipoCard ────────────────────────────────────────────────────────────────
function EquipoCard({ equipo, onUpload }: { equipo: Equipo; onUpload: (doc: DocEquipo) => void }) {
  const [open, setOpen] = useState(false)
  const { label, color } = ESTADO_EQUIPO_LABEL[equipo.estado] ?? { label: equipo.estado, color: 'zinc' }
  const docsVencidos  = equipo.documentos_equipo.filter(d => d.estado === 'VENCIDO').length
  const docsPendientes = equipo.documentos_equipo.filter(d => d.estado === 'PENDIENTE').length

  const DOC_ICON: Record<string, string> = { PENDIENTE: '○', CARGADO: '⏳', APROBADO: '✓', RECHAZADO: '✗', VENCIDO: '!' }
  const DOC_CLS: Record<string, string>  = {
    PENDIENTE: 'bg-zinc-500/15 text-zinc-500',
    CARGADO:   'bg-blue-500/15 text-blue-400',
    APROBADO:  'bg-green-500/15 text-green-400',
    RECHAZADO: 'bg-red-500/15 text-red-400',
    VENCIDO:   'bg-orange-500/15 text-orange-400',
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="text-2xl leading-none shrink-0">{equipo.tipos_equipo.icono}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white font-mono text-sm">{equipo.dominio}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estadoBadgeClass(color)}`}>{label}</span>
            {docsVencidos > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/20 font-medium">
                ⚠ {docsVencidos} vencido{docsVencidos > 1 ? 's' : ''}
              </span>
            )}
            {docsPendientes > 0 && docsVencidos === 0 && (
              <span className="text-xs text-zinc-500">{docsPendientes} pendiente{docsPendientes > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-zinc-600 text-xs mt-0.5">
            {equipo.tipos_equipo.nombre}
            {equipo.marca && ` · ${equipo.marca}`}
            {equipo.modelo && ` ${equipo.modelo}`}
            {equipo.anio && ` (${equipo.anio})`}
          </p>
        </div>
        <svg className={`shrink-0 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Datos seguro */}
          {equipo.seguro_compania && (
            <div className="px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
              <p className="text-zinc-500 text-xs">
                <span className="text-zinc-400">Seguro:</span> {equipo.seguro_compania}
                {equipo.seguro_poliza && ` · Póliza ${equipo.seguro_poliza}`}
                {equipo.seguro_vto && ` · Vto: ${formatFecha(equipo.seguro_vto)}`}
              </p>
            </div>
          )}
          {/* Documentos */}
          <div className="divide-y divide-white/[0.04]">
            {equipo.documentos_equipo.length === 0 ? (
              <div className="px-4 py-4 text-center"><p className="text-zinc-600 text-xs italic">Sin documentos configurados</p></div>
            ) : equipo.documentos_equipo.map(doc => {
              const puedeSubir = doc.estado !== 'APROBADO'
              const diasV = doc.fecha_venc ? diasHasta(doc.fecha_venc) : null
              const estaVencido = diasV !== null && diasV < 0
              return (
                <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${DOC_CLS[doc.estado]}`}>
                    {DOC_ICON[doc.estado]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{doc.documentos_requeridos_equipo.nombre}</p>
                    <p className="text-zinc-600 text-xs">
                      {doc.documentos_requeridos_equipo.tipo_vigencia === 'PERMANENTE' ? 'Permanente' :
                       doc.fecha_venc ? `Vence ${formatFecha(doc.fecha_venc)}${estaVencido ? ' ⚠' : ''}` :
                       'Sin fecha'}
                    </p>
                    {doc.observaciones && <p className="text-orange-400 text-xs italic mt-0.5">↳ {doc.observaciones}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.archivo_url && (
                      <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )}
                    {puedeSubir && (
                      <button onClick={() => onUpload(doc)}
                        className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                        {doc.estado === 'RECHAZADO' || doc.estado === 'VENCIDO' ? 'Renovar' : 'Subir'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SeccionEquipos ────────────────────────────────────────────────────────────
function SeccionEquipos({ proveedorId }: { proveedorId: string }) {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [tiposEquipo, setTiposEquipo] = useState<TipoEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [uploadDoc, setUploadDoc] = useState<DocEquipo | null>(null)

  async function cargarDatos() {
    setLoading(true)
    const [{ data: tipos }, { data: eqs }] = await Promise.all([
      supabase.from('tipos_equipo').select('id, nombre, icono').eq('activo', true).order('nombre'),
      supabase.from('equipos_contratista').select(`
        id, dominio, marca, modelo, anio,
        seguro_compania, seguro_poliza, seguro_vto, estado,
        tipos_equipo (id, nombre, icono),
        documentos_equipo (
          id, tipo_doc_id, estado, fecha_venc, archivo_url, observaciones,
          documentos_requeridos_equipo (id, nombre, tipo_vigencia, obligatorio)
        )
      `).eq('proveedor_id', proveedorId).order('created_at', { ascending: false }),
    ])
    if (tipos) setTiposEquipo(tipos)
    if (eqs) setEquipos(eqs as unknown as Equipo[])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [proveedorId])

  const totalVencidos = equipos.reduce((acc, eq) =>
    acc + eq.documentos_equipo.filter(d => d.estado === 'VENCIDO').length, 0)

  if (loading) return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-10 text-center">
      <div className="text-2xl mb-2">⚙️</div>
      <p className="text-zinc-500 text-sm">Cargando equipos…</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-xs">
          {equipos.length} equipo{equipos.length !== 1 ? 's' : ''} registrado{equipos.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowNuevo(true)}
          className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <span>+</span> Agregar equipo
        </button>
      </div>

      {/* Alerta vencidos */}
      {totalVencidos > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
          <p className="text-orange-300 text-sm font-medium">⚠️ {totalVencidos} documento{totalVencidos > 1 ? 's' : ''} vencido{totalVencidos > 1 ? 's' : ''} en tus equipos</p>
          <p className="text-orange-400/70 text-xs mt-0.5">Los equipos con documentos vencidos bloquean el acceso al establecimiento.</p>
        </div>
      )}

      {/* Estado vacío */}
      {equipos.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-10 text-center">
          <div className="text-4xl mb-3">🚛</div>
          <p className="text-zinc-400 text-sm font-medium">No tenés equipos registrados</p>
          <p className="text-zinc-600 text-xs mt-1">Registrá tus vehículos y maquinaria para gestionar su documentación</p>
          <button onClick={() => setShowNuevo(true)}
            className="mt-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium px-4 py-2 rounded-lg">
            Registrar primer equipo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {equipos.map(eq => <EquipoCard key={eq.id} equipo={eq} onUpload={setUploadDoc}/>)}
        </div>
      )}

      {showNuevo && (
        <NuevoEquipoModal proveedorId={proveedorId} tiposEquipo={tiposEquipo}
          onClose={() => setShowNuevo(false)} onSuccess={cargarDatos}/>
      )}
      {uploadDoc && (
        <UploadEquipoModal doc={uploadDoc}
          onClose={() => setUploadDoc(null)} onSuccess={cargarDatos}/>
      )}
    </div>
  )
}

// ── PortalClient (componente principal) ──────────────────────────────────────
export default function PortalClient({
  proveedor, docs, habilitacion, operarios, accesos,
  historialPorDoc, miRol, visitasAuditoria,
}: Props) {
  const [seccion, setSeccion] = useState<Tab | null>(null)
  const [uploadModal, setUploadModal] = useState<{
    docId: string; nombre: string; tipoVigencia: string; fechaActual: string | null
  } | null>(null)
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState({ telefono: proveedor.telefono ?? '', email: proveedor.email ?? '' })

  const { label: estadoLabel, color: estadoColor } = formatEstado(proveedor.estado)
  const docsAprobados = docs.filter(d => d.estado === 'APROBADO').length
  const docsVencidos  = docs.filter(d => d.estado === 'VENCIDO').length
  const docsTotales   = docs.length

  const historialFlat = Object.values(historialPorDoc)
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const docNombreMap: Record<string, string> = {}
  for (const d of docs) { docNombreMap[d.id] = d.documentos_requeridos?.nombre ?? '—' }

  async function guardarPerfil() {
    setSaving(true)
    try {
      await supabase.from('proveedores').update({ telefono: perfil.telefono || null, email: perfil.email }).eq('id', proveedor.id)
      setEditandoPerfil(false)
      window.location.reload()
    } finally { setSaving(false) }
  }

  const badges: Partial<Record<Tab, string>> = {
    docs: docsVencidos > 0 ? `${docsVencidos}` : undefined,
    auditorias: visitasAuditoria.filter(v => v.estado_supervision === 'PENDIENTE').length > 0
      ? `${visitasAuditoria.filter(v => v.estado_supervision === 'PENDIENTE').length}` : undefined,
  }

  const seccionActual = SECCIONES.find(s => s.key === seccion)

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (!seccion) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white">
        <nav className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">S</div>
            <span className="font-medium text-sm">Sistema Legajos</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm hidden sm:block truncate max-w-40">{proveedor.razon_social}</span>
            <a href="/proveedor/logout" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Salir</a>
          </div>
        </nav>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          {/* Card resumen */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="font-semibold text-lg leading-tight">{proveedor.razon_social}</h1>
                <p className="text-zinc-500 text-sm mt-0.5">CUIT {proveedor.cuit}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ml-3 ${estadoBadgeClass(estadoColor)}`}>
                {estadoLabel}
              </span>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-xs">Documentación</span>
              <span className="text-zinc-400 text-xs font-medium">{docsAprobados}/{docsTotales}</span>
            </div>
            <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${docsAprobados === docsTotales && docsTotales > 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${docsTotales > 0 ? (docsAprobados / docsTotales) * 100 : 0}%` }}/>
            </div>
            {proveedor.estado === 'EN_REVISION' && (
              <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-blue-300 text-sm font-medium">📋 Tu legajo está en revisión</p>
                <p className="text-blue-400/70 text-xs mt-0.5">El evaluador está revisando tu documentación.</p>
              </div>
            )}
            {proveedor.estado === 'RECHAZADO' && (
              <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm font-medium">❌ Tu legajo fue rechazado</p>
                <p className="text-red-400/70 text-xs mt-0.5">Revisá las observaciones y volvé a subir la documentación.</p>
              </div>
            )}
            {docsVencidos > 0 && proveedor.estado !== 'RECHAZADO' && (
              <div className="mt-4 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-orange-300 text-sm font-medium">⚠️ {docsVencidos} documento{docsVencidos > 1 ? 's' : ''} vencido{docsVencidos > 1 ? 's' : ''}</p>
                <p className="text-orange-400/70 text-xs mt-0.5">Actualizá tu documentación para mantener el acceso.</p>
              </div>
            )}
          </div>

          {/* Grid íconos */}
          <div className="grid grid-cols-3 gap-3">
            {SECCIONES.map(s => {
              const badge = badges[s.key]
              return (
                <button key={s.key} onClick={() => setSeccion(s.key)}
                  className={`relative flex flex-col items-center justify-center gap-2.5 py-5 px-3 rounded-2xl border transition-all active:scale-95 hover:brightness-125 ${s.bg}`}>
                  {badge && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                  <span className="text-3xl leading-none">{s.icon}</span>
                  <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── SECCIONES ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <nav className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 bg-[#0f1117]/95 backdrop-blur z-40">
        <button onClick={() => setSeccion(null)} className="text-zinc-400 hover:text-white transition-colors p-1 -ml-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-xl">{seccionActual?.icon}</span>
        <h1 className="font-semibold text-base flex-1">{seccionActual?.label}</h1>
        <a href="/proveedor/logout" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Salir</a>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-5">

        {/* DOCUMENTOS */}
        {seccion === 'docs' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Documentos requeridos</h2>
              <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máx. 10MB · Ingresá la fecha antes de subir</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {docs.map((doc: any) => {
                const dr = doc.documentos_requeridos
                const diasV = doc.fecha_venc ? diasHasta(doc.fecha_venc) : null
                const estaVencido = diasV !== null && diasV < 0
                const puedeSubir = doc.estado !== 'APROBADO'
                return (
                  <div key={doc.id} className="px-5 py-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                      doc.estado === 'APROBADO'  ? 'bg-green-500/15 text-green-400' :
                      doc.estado === 'CARGADO'   ? 'bg-blue-500/15 text-blue-400' :
                      doc.estado === 'RECHAZADO' ? 'bg-red-500/15 text-red-400' :
                      doc.estado === 'VENCIDO'   ? 'bg-orange-500/15 text-orange-400' :
                      'bg-zinc-500/15 text-zinc-500'
                    }`}>
                      {doc.estado === 'APROBADO' ? '✓' : doc.estado === 'CARGADO' ? '⏳' :
                       doc.estado === 'RECHAZADO' ? '✗' : doc.estado === 'VENCIDO' ? '!' : '○'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-white">{dr?.nombre}</span>
                        {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-zinc-600 text-xs">{dr?.codigo} · {dr?.tipo_vigencia}</span>
                        {doc.fecha_venc && (
                          <span className={`text-xs ${estaVencido ? 'text-orange-400' : 'text-zinc-500'}`}>
                            Vence {formatFecha(doc.fecha_venc)}{estaVencido && ' ⚠'}
                          </span>
                        )}
                      </div>
                      {doc.observaciones && <p className="text-orange-400 text-xs italic mt-0.5">↳ {doc.observaciones}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.archivo_url && (
                        <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}
                      {puedeSubir && (
                        <button onClick={() => setUploadModal({ docId: doc.id, nombre: dr?.nombre ?? '', tipoVigencia: dr?.tipo_vigencia ?? 'ANUAL', fechaActual: doc.fecha_venc })}
                          className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                          {doc.estado === 'RECHAZADO' || doc.estado === 'VENCIDO' ? 'Renovar' : 'Subir'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {uploadModal && (
              <UploadModal docId={uploadModal.docId} nombre={uploadModal.nombre} proveedorId={proveedor.id}
                tipoVigencia={uploadModal.tipoVigencia} fechaActual={uploadModal.fechaActual}
                onClose={() => setUploadModal(null)}/>
            )}
          </div>
        )}

        {/* EQUIPOS */}
        {seccion === 'equipos' && <SeccionEquipos proveedorId={proveedor.id}/>}

        {/* HISTORIAL */}
        {seccion === 'historial' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Historial de documentos</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Del más reciente al más antiguo</p>
            </div>
            {historialFlat.length === 0 ? (
              <div className="px-5 py-8 text-center"><p className="text-zinc-500 text-sm">Sin eventos registrados todavía</p></div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {historialFlat.map((h: any) => (
                  <div key={h.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      h.estado_nuevo === 'APROBADO' ? 'bg-green-400' : h.estado_nuevo === 'RECHAZADO' ? 'bg-red-400' :
                      h.estado_nuevo === 'VENCIDO' ? 'bg-orange-400' : 'bg-blue-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="text-zinc-400">{docNombreMap[h.documento_id] ?? '—'}</span>
                        {' — '}
                        <span className={h.estado_nuevo === 'APROBADO' ? 'text-green-400' : h.estado_nuevo === 'RECHAZADO' ? 'text-red-400' : 'text-blue-400'}>
                          {h.actor_tipo === 'evaluador' ? 'Evaluador' : 'Proveedor'}{' '}
                          {ESTADO_LABEL[h.estado_nuevo]?.label?.toLowerCase() ?? h.estado_nuevo}
                        </span>
                      </p>
                      {h.observaciones && <p className="text-zinc-500 text-xs italic mt-0.5">"{h.observaciones}"</p>}
                    </div>
                    <span className="text-zinc-600 text-xs shrink-0">
                      {new Date(h.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PERSONAL */}
        {seccion === 'personal' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Personal con acceso al QR</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Cada operario recibe un email para definir su contraseña</p>
              </div>
              {miRol === 'titular' && (
                <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0">+ Agregar</button>
              )}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {operarios.map((p: any) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/[0.06] rounded-full flex items-center justify-center text-sm font-medium">
                    {p.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{p.nombre}</p>
                    {p.cuil && <p className="text-zinc-500 text-xs">CUIL {p.cuil}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${p.rol === 'titular' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    {p.rol === 'titular' ? 'Titular' : 'Operario'}
                  </span>
                </div>
              ))}
              {operarios.filter((p: any) => p.rol !== 'titular').length === 0 && (
                <div className="px-5 py-6 text-center"><p className="text-zinc-600 text-sm">Sin operarios registrados todavía</p></div>
              )}
            </div>
          </div>
        )}

        {/* ACCESOS */}
        {seccion === 'accesos' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Registros de acceso</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Ingresos y egresos en establecimientos</p>
            </div>
            {accesos.length === 0 ? (
              <div className="px-5 py-8 text-center"><p className="text-zinc-500 text-sm">Sin registros todavía</p></div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {accesos.map((a: any) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${a.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {a.tipo === 'INGRESO' ? '→' : '←'}
                    </div>
                    <p className="text-white text-sm flex-1">{a.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</p>
                    <span className="text-zinc-500 text-xs shrink-0">
                      {new Date(a.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PERFIL */}
        {seccion === 'perfil' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-medium">Datos de la empresa</h2>
              {!editandoPerfil ? (
                <button onClick={() => setEditandoPerfil(true)} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditandoPerfil(false); setPerfil({ telefono: proveedor.telefono ?? '', email: proveedor.email ?? '' }) }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs">Cancelar</button>
                  <button onClick={guardarPerfil} disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-lg">
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[{ label: 'Razón social', value: proveedor.razon_social }, { label: 'CUIT', value: proveedor.cuit }, { label: 'Rubro', value: (proveedor.rubros as any)?.nombre }].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-500 text-sm w-32 shrink-0">{label}</span>
                  <span className="text-white text-sm">{value ?? '—'}</span>
                </div>
              ))}
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Email</span>
                {editandoPerfil ? (
                  <input type="email" value={perfil.email} onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1"/>
                ) : <span className="text-white text-sm">{proveedor.email}</span>}
              </div>
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Teléfono</span>
                {editandoPerfil ? (
                  <input type="tel" value={perfil.telefono} onChange={e => setPerfil(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="Ej: 11 1234-5678"
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1 placeholder:text-zinc-600"/>
                ) : <span className="text-white text-sm">{proveedor.telefono ?? '—'}</span>}
              </div>
            </div>
          </div>
        )}

        {/* AUDITORÍAS */}
        {seccion === 'auditorias' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Visitas de auditoría</h2>
            </div>
            {visitasAuditoria.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-zinc-500 text-sm">No tenés visitas de auditoría registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {visitasAuditoria.map((v: any) => (
                  <div key={v.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">{(v.auditor as any)?.nombre ?? 'Auditor'}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${
                        v.resultado === 'CONFORME' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        v.resultado === 'NO_CONFORME' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        v.resultado === 'URGENTE' ? 'bg-red-600/15 text-red-300 border-red-600/30' :
                        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      }`}>
                        {v.resultado === 'CONFORME' ? 'Conforme' : v.resultado === 'NO_CONFORME' ? 'No conforme' :
                         v.resultado === 'URGENTE' ? 'Urgente' : v.resultado === 'OBSERVACION' ? 'Observación' : v.resultado ?? '—'}
                      </span>
                    </div>
                    {(v.establecimiento as any)?.nombre && <p className="text-zinc-600 text-xs mb-0.5">{(v.establecimiento as any).nombre}</p>}
                    <p className="text-zinc-500 text-xs">
                      {new Date(v.visitado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {v.observacion && <p className="text-zinc-400 text-xs mt-1 italic">"{v.observacion}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
