// ── SeccionNomina ─────────────────────────────────────────────────────────────
// Gestión de empleados contratistas: nómina, altas tempranas y F931 mensual
// Se integra en PortalClient.tsx como nueva sección

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Empleado {
  id: string
  nombre: string
  cuil: string
  dni: string | null
  fecha_ingreso: string | null
  activo: boolean
  altas_tempranas: AltaTemprana[]
}

interface AltaTemprana {
  id: string
  estado: 'PENDIENTE' | 'CARGADO' | 'APROBADO' | 'RECHAZADO'
  archivo_url: string | null
  observaciones: string | null
}

interface PresentacionF931 {
  id: string
  periodo_anio: number
  periodo_mes: number
  estado: 'PENDIENTE' | 'CARGADO' | 'APROBADO' | 'RECHAZADO'
  archivo_url: string | null
  observaciones: string | null
  fecha_presentacion: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesAnterior() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

function estadoBadge(estado: string) {
  if (estado === 'APROBADO')  return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (estado === 'CARGADO')   return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (estado === 'RECHAZADO') return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

function estadoIcon(estado: string) {
  if (estado === 'APROBADO')  return '✓'
  if (estado === 'CARGADO')   return '⏳'
  if (estado === 'RECHAZADO') return '✗'
  return '○'
}

// ── UploadAltaModal ───────────────────────────────────────────────────────────
function UploadAltaModal({ empleado, altaId, proveedorId, onClose, onSuccess }: {
  empleado: Empleado
  altaId: string
  proveedorId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function handleSubmit() {
    if (!archivo) { setError('Seleccioná un archivo'); return }
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', archivo)
      form.append('doc_id', altaId)
      form.append('tipo', 'alta_temprana')
      const res = await fetch('/api/proveedor/upload-nomina', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir')
      setOk(true)
      setTimeout(() => { onSuccess(); onClose() }, 800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium text-sm">Constancia de Alta</h3>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-56">{empleado.nombre} · CUIL {empleado.cuil}</p>
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
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2">
                <p className="text-blue-400 text-xs">Constancia de alta temprana AFIP para este empleado.</p>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Archivo <span className="text-red-400">*</span> <span className="text-zinc-600">(PDF, JPG, PNG — máx. 10MB)</span></label>
                <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all ${archivo ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2]'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={archivo ? '#60a5fa' : '#52525b'} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    {archivo
                      ? <><p className="text-blue-300 text-sm font-medium truncate">{archivo.name}</p><p className="text-zinc-500 text-xs">{(archivo.size/1024).toFixed(0)} KB</p></>
                      : <><p className="text-zinc-400 text-sm">Tocá para seleccionar</p><p className="text-zinc-600 text-xs">o arrastrá el archivo acá</p></>}
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
                <button onClick={handleSubmit} disabled={uploading || !archivo}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
                  {uploading ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Subiendo…</> : 'Enviar constancia'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── UploadF931Modal ───────────────────────────────────────────────────────────
function UploadF931Modal({ proveedorId, f931, onClose, onSuccess }: {
  proveedorId: string
  f931: PresentacionF931 | null  // null = crear nueva
  onClose: () => void
  onSuccess: () => void
}) {
  const prev = mesAnterior()
  const [anio, setAnio] = useState(prev.anio)
  const [mes, setMes] = useState(prev.mes)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function handleSubmit() {
    if (!archivo) { setError('Seleccioná un archivo'); return }
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', archivo)
      form.append('tipo', 'f931')
      form.append('proveedor_id', proveedorId)
      form.append('periodo_anio', String(anio))
      form.append('periodo_mes', String(mes))
      if (f931?.id) form.append('f931_id', f931.id)
      const res = await fetch('/api/proveedor/upload-nomina', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir')
      setOk(true)
      setTimeout(() => { onSuccess(); onClose() }, 800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally { setUploading(false) }
  }

  const anioActual = new Date().getFullYear()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium text-sm">Presentar F931 + Nómina</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Declaración jurada mensual de cargas sociales</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {ok ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-400 font-medium">¡F931 enviado para revisión!</p>
            </div>
          ) : (
            <>
              {/* Período */}
              {!f931 && (
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Período <span className="text-red-400">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={mes} onChange={e => setMes(Number(e.target.value))}
                      className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none bg-[#1a1d27]">
                      {MESES.map((m, i) => <option key={i+1} value={i+1} className="bg-[#1a1d27]">{m}</option>)}
                    </select>
                    <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                      className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none bg-[#1a1d27]">
                      {[anioActual - 1, anioActual].map(a => <option key={a} value={a} className="bg-[#1a1d27]">{a}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {f931 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  <p className="text-zinc-400 text-xs">Período: <span className="text-white">{MESES[f931.periodo_mes - 1]} {f931.periodo_anio}</span></p>
                  {f931.observaciones && <p className="text-orange-400 text-xs mt-1 italic">↳ {f931.observaciones}</p>}
                </div>
              )}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2">
                <p className="text-blue-400 text-xs">Adjuntá el F931 y la nómina en un solo archivo (PDF o ZIP).</p>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Archivo <span className="text-red-400">*</span> <span className="text-zinc-600">(PDF, ZIP — máx. 20MB)</span></label>
                <label className={`flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all ${archivo ? 'border-green-500/40 bg-green-500/5' : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2]'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={archivo ? '#4ade80' : '#52525b'} strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    {archivo
                      ? <><p className="text-green-300 text-sm font-medium truncate">{archivo.name}</p><p className="text-zinc-500 text-xs">{(archivo.size/1024).toFixed(0)} KB</p></>
                      : <><p className="text-zinc-400 text-sm">Tocá para seleccionar</p><p className="text-zinc-600 text-xs">PDF o ZIP con F931 y nómina</p></>}
                  </div>
                  {archivo && <button type="button" onClick={e => { e.preventDefault(); setArchivo(null) }} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>}
                  <input type="file" className="hidden" accept=".pdf,.zip" onChange={e => setArchivo(e.target.files?.[0] ?? null)}/>
                </label>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-red-400 text-xs">{error}</p></div>}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl">Cancelar</button>
                <button onClick={handleSubmit} disabled={uploading || !archivo}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
                  {uploading ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Subiendo…</> : 'Enviar F931'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NuevoEmpleadoModal ────────────────────────────────────────────────────────
function NuevoEmpleadoModal({ proveedorId, onClose, onSuccess }: {
  proveedorId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ nombre: '', cuil: '', dni: '', fecha_ingreso: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-zinc-600'

  async function handleSubmit() {
    if (!form.nombre.trim() || !form.cuil.trim()) { setError('Nombre y CUIL son requeridos'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/proveedor/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, proveedor_id: proveedorId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al guardar')
      onSuccess(); onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1d27] border border-white/[0.1] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-white font-medium text-sm">Agregar empleado</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Nombre completo <span className="text-red-400">*</span></label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan García" className={inputCls} autoFocus/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">CUIL <span className="text-red-400">*</span></label>
            <input value={form.cuil} onChange={e => setForm(f => ({ ...f, cuil: e.target.value }))} placeholder="20-12345678-9" className={inputCls}/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">DNI <span className="text-zinc-600">(opcional)</span></label>
            <input value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} placeholder="12345678" className={inputCls}/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Fecha de ingreso <span className="text-zinc-600">(opcional)</span></label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} className={inputCls}/>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-red-400 text-xs">{error}</p></div>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl">Cancelar</button>
            <button onClick={handleSubmit} disabled={loading || !form.nombre.trim() || !form.cuil.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
              {loading ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando…</> : 'Agregar empleado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SeccionNomina (componente principal exportable) ───────────────────────────
export function SeccionNomina({ proveedorId, miRol }: {
  proveedorId: string
  miRol: string
}) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [f931s, setF931s] = useState<PresentacionF931[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'empleados' | 'f931'>('empleados')
  const [showNuevo, setShowNuevo] = useState(false)
  const [uploadAlta, setUploadAlta] = useState<{ empleado: Empleado; altaId: string } | null>(null)
  const [uploadF931, setUploadF931] = useState<PresentacionF931 | null | 'nuevo'>('nuevo')  // null = cerrado
  const [showUploadF931, setShowUploadF931] = useState(false)
  const [f931Editar, setF931Editar] = useState<PresentacionF931 | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const puedeEditar = miRol === 'titular' || miRol === 'admin_proveedor'

  async function cargarDatos() {
    setLoading(true)
    const [{ data: emps }, { data: fs }] = await Promise.all([
      supabase
        .from('empleados_contratista')
        .select(`id, nombre, cuil, dni, fecha_ingreso, activo,
                 altas_tempranas(id, estado, archivo_url, observaciones)`)
        .eq('proveedor_id', proveedorId)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('presentaciones_f931')
        .select('id, periodo_anio, periodo_mes, estado, archivo_url, observaciones, fecha_presentacion')
        .eq('proveedor_id', proveedorId)
        .order('periodo_anio', { ascending: false })
        .order('periodo_mes', { ascending: false })
        .limit(12),
    ])
    if (emps) setEmpleados(emps as unknown as Empleado[])
    if (fs) setF931s(fs as PresentacionF931[])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [proveedorId])

  // Importación masiva desde Excel (CSV simplificado)
  async function importarExcel() {
    if (!importFile) return
    setImporting(true); setImportMsg('')
    try {
      const text = await importFile.text()
      const lineas = text.split('\n').filter(l => l.trim())
      // Formato esperado: nombre,cuil,dni,fecha_ingreso (con o sin header)
      const empleadosData = lineas
        .slice(lineas[0].toLowerCase().includes('nombre') ? 1 : 0)
        .map(l => {
          const [nombre, cuil, dni, fecha_ingreso] = l.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
          return { nombre, cuil, dni: dni || null, fecha_ingreso: fecha_ingreso || null }
        })
        .filter(e => e.nombre && e.cuil)

      const { data } = await supabase.rpc('fn_importar_empleados', {
        p_proveedor_id: proveedorId,
        p_empleados: JSON.stringify(empleadosData),
      })
      const res = data as { ok: boolean; insertados: number; actualizados: number; errores: number }
      setImportMsg(`✓ ${res.insertados} nuevos · ${res.actualizados} actualizados${res.errores > 0 ? ` · ${res.errores} con error` : ''}`)
      setImportFile(null)
      cargarDatos()
    } catch {
      setImportMsg('Error al procesar el archivo')
    } finally { setImporting(false) }
  }

  // Mes anterior para badge de alerta F931
  const { anio: aMes, mes: mMes } = mesAnterior()
  const f931MesAnterior = f931s.find(f => f.periodo_anio === aMes && f.periodo_mes === mMes)

  if (loading) return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-10 text-center">
      <div className="text-2xl mb-2">👷</div>
      <p className="text-zinc-500 text-sm">Cargando nómina…</p>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Tabs internas */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        <button onClick={() => setTab('empleados')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === 'empleados' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          👷 Nómina ({empleados.length})
        </button>
        <button onClick={() => setTab('f931')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${tab === 'f931' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          📊 F931
          {!f931MesAnterior && empleados.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"/>
          )}
        </button>
      </div>

      {/* ── Tab Nómina ── */}
      {tab === 'empleados' && (
        <div className="space-y-3">

          {/* Acciones */}
          {puedeEditar && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowNuevo(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                + Agregar empleado
              </button>
              <label className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all">
                📥 Importar CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)}/>
              </label>
              {importFile && (
                <button onClick={importarExcel} disabled={importing}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  {importing ? 'Importando…' : `Importar ${importFile.name}`}
                </button>
              )}
            </div>
          )}

          {importMsg && (
            <div className={`border rounded-xl px-4 py-3 text-sm ${importMsg.startsWith('✓') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {importMsg}
            </div>
          )}

          {/* Hint formato CSV */}
          {puedeEditar && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
              <p className="text-zinc-600 text-xs">Formato CSV: <span className="text-zinc-500 font-mono">nombre,cuil,dni,fecha_ingreso</span></p>
              <p className="text-zinc-700 text-xs mt-0.5">Ej: Juan García,20-12345678-9,12345678,2024-03-01</p>
            </div>
          )}

          {/* Lista de empleados */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-medium">Empleados activos</h3>
            </div>
            {empleados.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">👷</div>
                <p className="text-zinc-500 text-sm">Sin empleados registrados</p>
                <p className="text-zinc-700 text-xs mt-1">Agregá empleados manualmente o importá un CSV</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {empleados.map(emp => {
                  const alta = emp.altas_tempranas?.[0]
                  const altaOk = alta?.estado === 'APROBADO'
                  const altaEstado = alta?.estado ?? 'PENDIENTE'
                  return (
                    <div key={emp.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${altaOk ? 'bg-green-500/15 text-green-400' : 'bg-zinc-500/15 text-zinc-400'}`}>
                        {emp.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{emp.nombre}</p>
                        <p className="text-zinc-500 text-xs">CUIL {emp.cuil}{emp.dni ? ` · DNI ${emp.dni}` : ''}</p>
                      </div>
                      {/* Estado alta temprana */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${estadoBadge(altaEstado)}`}>
                          {estadoIcon(altaEstado)} Alta
                        </span>
                        {!altaOk && puedeEditar && (
                          <button
                            onClick={() => {
                              // Crear o usar alta existente
                              if (alta?.id) {
                                setUploadAlta({ empleado: emp, altaId: alta.id })
                              } else {
                                // Crear registro de alta primero
                                supabase.from('altas_tempranas').insert({
                                  grupo_id: null, // se obtiene server-side
                                  empleado_id: emp.id,
                                  proveedor_id: proveedorId,
                                }).select('id').single().then(({ data }) => {
                                  if (data) setUploadAlta({ empleado: emp, altaId: data.id })
                                })
                              }
                            }}
                            className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-2.5 py-1 rounded-lg transition-all">
                            {alta?.estado === 'RECHAZADO' ? 'Corregir' : 'Subir'}
                          </button>
                        )}
                        {alta?.observaciones && (
                          <span className="text-orange-400 text-xs truncate max-w-24" title={alta.observaciones}>↳ {alta.observaciones}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab F931 ── */}
      {tab === 'f931' && (
        <div className="space-y-3">

          {/* Alerta F931 faltante */}
          {empleados.length > 0 && !f931MesAnterior && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
              <p className="text-orange-300 text-sm font-medium">⚠️ F931 pendiente — {MESES[mMes - 1]} {aMes}</p>
              <p className="text-orange-400/70 text-xs mt-0.5">Tuviste empleados el mes pasado. Presentá el F931 para mantener el acceso habilitado.</p>
            </div>
          )}
          {empleados.length > 0 && f931MesAnterior && f931MesAnterior.estado !== 'APROBADO' && (
            <div className={`border rounded-xl px-4 py-3 ${f931MesAnterior.estado === 'RECHAZADO' ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
              <p className={`text-sm font-medium ${f931MesAnterior.estado === 'RECHAZADO' ? 'text-red-300' : 'text-blue-300'}`}>
                {f931MesAnterior.estado === 'RECHAZADO' ? '❌ F931 rechazado' : '⏳ F931 en revisión'} — {MESES[f931MesAnterior.periodo_mes - 1]} {f931MesAnterior.periodo_anio}
              </p>
              {f931MesAnterior.observaciones && <p className="text-zinc-400 text-xs mt-0.5 italic">"{f931MesAnterior.observaciones}"</p>}
            </div>
          )}

          {puedeEditar && (
            <button onClick={() => setShowUploadF931(true)}
              className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2">
              + Presentar F931
            </button>
          )}

          {/* Historial F931 */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-medium">Historial de presentaciones</h3>
            </div>
            {f931s.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-zinc-500 text-sm">Sin presentaciones todavía</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {f931s.map(f => (
                  <div key={f.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                      f.estado === 'APROBADO' ? 'bg-green-500/15 text-green-400' :
                      f.estado === 'RECHAZADO' ? 'bg-red-500/15 text-red-400' :
                      f.estado === 'CARGADO' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-zinc-500/15 text-zinc-400'
                    }`}>
                      {estadoIcon(f.estado)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{MESES[f.periodo_mes - 1]} {f.periodo_anio}</p>
                      {f.observaciones && <p className="text-orange-400 text-xs italic mt-0.5">↳ {f.observaciones}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${estadoBadge(f.estado)}`}>
                        {f.estado === 'APROBADO' ? 'Aprobado' : f.estado === 'RECHAZADO' ? 'Rechazado' : f.estado === 'CARGADO' ? 'En revisión' : 'Pendiente'}
                      </span>
                      {f.archivo_url && (
                        <a href={f.archivo_url} target="_blank" rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}
                      {f.estado === 'RECHAZADO' && puedeEditar && (
                        <button onClick={() => { setF931Editar(f); setShowUploadF931(true) }}
                          className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-2.5 py-1 rounded-lg transition-all">
                          Corregir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {showNuevo && (
        <NuevoEmpleadoModal proveedorId={proveedorId} onClose={() => setShowNuevo(false)} onSuccess={cargarDatos}/>
      )}
      {uploadAlta && (
        <UploadAltaModal
          empleado={uploadAlta.empleado}
          altaId={uploadAlta.altaId}
          proveedorId={proveedorId}
          onClose={() => setUploadAlta(null)}
          onSuccess={cargarDatos}
        />
      )}
      {showUploadF931 && (
        <UploadF931Modal
          proveedorId={proveedorId}
          f931={f931Editar}
          onClose={() => { setShowUploadF931(false); setF931Editar(null) }}
          onSuccess={cargarDatos}
        />
      )}
    </div>
  )
}
