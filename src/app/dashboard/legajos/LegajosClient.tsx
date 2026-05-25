'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type RubroRef = { rubros: { id: string; nombre: string; codigo: number } | null }

type Proveedor = {
  id: string
  razon_social: string
  cuit: string
  email: string | null
  tipo_proveedor: string
  estado: string
  created_at: string
  establecimiento_id: string | null
  rubros: { nombre: string } | null
  proveedor_rubros: RubroRef[]
  documentos_legajo: { id: string; estado: string; fecha_venc: string | null }[]
}

type SortKey = 'razon_social' | 'estado' | 'created_at' | 'docs' | 'vencimiento'
type SortDir = 'asc' | 'desc'
type FiltroVenc = 'TODOS' | 'SIN_VENCER' | 'POR_VENCER' | 'VENCIDOS'
type Vista = 'lista' | 'grid'

const ESTADO_CFG: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  SUSPENDIDO:  { label: 'Suspendido',  color: 'zinc'   },
}

const PAGE_SIZE = 50

function estadoClass(color: string) {
  return color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
         color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
         color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
         color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
         'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function proximoVencimiento(docs: Proveedor['documentos_legajo']): number | null {
  const activos = docs
    .filter(d => d.fecha_venc && ['CARGADO', 'APROBADO'].includes(d.estado))
    .map(d => diasHasta(d.fecha_venc!))
  if (activos.length === 0) return null
  return Math.min(...activos)
}

function getRubrosProveedor(p: Proveedor): string[] {
  const nombres = new Set<string>()
  for (const pr of p.proveedor_rubros ?? []) {
    if (pr.rubros?.nombre) nombres.add(pr.rubros.nombre)
  }
  if (nombres.size === 0 && p.rubros?.nombre) nombres.add(p.rubros.nombre)
  return Array.from(nombres)
}

function VencimientoBadge({ dias }: { dias: number | null }) {
  if (dias === null) return null
  if (dias < 0)  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">Vencido</span>
  if (dias === 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">Hoy</span>
  if (dias <= 7)  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/15 shrink-0">{dias}d</span>
  if (dias <= 30) return <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15 shrink-0">{dias}d</span>
  return null
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`ml-1 inline transition-all ${active ? 'opacity-100' : 'opacity-30'}`}>
      {dir === 'asc' || !active
        ? <><path d="M12 5v14M5 12l7-7 7 7" opacity={active && dir === 'asc' ? 1 : 0.4}/></>
        : <path d="M12 5v14M5 12l7 7 7-7"/>}
    </svg>
  )
}

// ── Modal Nuevo Proveedor ─────────────────────────────────────────────────────
function ModalNuevoProveedor({
  rubros,
  grupoId,
  onClose,
  onCreado,
}: {
  rubros: { id: string; nombre: string }[]
  grupoId: string
  onClose: () => void
  onCreado: (p: Proveedor) => void
}) {
  const [form, setForm] = useState({
    razon_social: '', cuit: '', email: '', telefono: '',
    tipo_proveedor: 'PJ', rubro_ids: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function toggleRubro(id: string) {
    setForm(f => ({
      ...f,
      rubro_ids: f.rubro_ids.includes(id)
        ? f.rubro_ids.filter(r => r !== id)
        : [...f.rubro_ids, id],
    }))
  }

  async function guardar() {
    if (!form.razon_social.trim()) { setError('La razón social es obligatoria'); return }
    if (!form.cuit.trim())         { setError('El CUIT es obligatorio'); return }
    if (!form.email.trim())        { setError('El email es obligatorio'); return }
    if (form.rubro_ids.length === 0) { setError('Seleccioná al menos un rubro'); return }

    setLoading(true)
    setError('')

    try {
      const { data, error: errFn } = await supabase.rpc('registrar_proveedor', {
        p_razon_social:       form.razon_social.trim(),
        p_cuit:               form.cuit.replace(/[-\s]/g, ''),
        p_tipo_proveedor:     form.tipo_proveedor,
        p_rubro_id:           form.rubro_ids[0],
        p_email:              form.email.trim(),
        p_telefono:           form.telefono.trim() || null,
        p_notif_vencimientos: false,
      })

      if (errFn || data?.error) throw new Error(data?.error ?? errFn?.message)

      if (form.rubro_ids.length > 1 && data?.proveedor_id) {
        await supabase.from('proveedor_rubros').insert(
          form.rubro_ids.slice(1).map(rid => ({
            proveedor_id: data.proveedor_id,
            rubro_id:     rid,
            grupo_id:     grupoId,
          }))
        )
      }

      if (data?.proveedor_id) {
        window.location.href = `/dashboard/legajos/${data.proveedor_id}`
      } else {
        window.location.reload()
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al crear el proveedor')
      setLoading(false)
    }
  }

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-600"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12151e] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#12151e]">
          <h2 className="text-white font-medium">Nuevo proveedor</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Razón social *</label>
            <input value={form.razon_social}
              onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
              placeholder="Empresa S.A." autoFocus className={inputCls}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">CUIT *</label>
              <input value={form.cuit}
                onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))}
                placeholder="20-12345678-9" className={inputCls}/>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Tipo</label>
              <select value={form.tipo_proveedor}
                onChange={e => setForm(f => ({ ...f, tipo_proveedor: e.target.value }))}
                className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50">
                <option value="PJ">Persona Jurídica</option>
                <option value="PF">Persona Física</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Email *</label>
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contacto@empresa.com" className={inputCls}/>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Teléfono</label>
              <input value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="+54 11 1234-5678" className={inputCls}/>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">
              Rubro(s) *
              <span className="text-zinc-600 ml-1">({form.rubro_ids.length} seleccionado{form.rubro_ids.length !== 1 ? 's' : ''})</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {rubros.map(r => {
                const sel = form.rubro_ids.includes(r.id)
                return (
                  <button key={r.id} type="button" onClick={() => toggleRubro(r.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                      sel ? 'border-blue-500/50 bg-blue-500/8' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      sel ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                    }`}>
                      {sel && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm truncate ${sel ? 'text-white' : 'text-zinc-300'}`}>{r.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={guardar} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {loading ? 'Creando...' : 'Crear proveedor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal Invitar Proveedor ───────────────────────────────────────────────────
function ModalInvitar({ onClose }: { onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/proveedor/registro`
    : 'https://sistemas-legajos-metrikpro.vercel.app/proveedor/registro'

  function copiar() {
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12151e] border border-white/[0.08] rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-white font-medium">Invitar proveedor</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-zinc-400 text-sm">
            Compartí este link con el proveedor para que complete su registro y cargue su documentación de forma autónoma.
          </p>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-zinc-300 text-sm flex-1 truncate font-mono text-xs">{url}</span>
            <button onClick={copiar}
              className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                copiado
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.1]'
              }`}>
              {copiado ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copiar
                </>
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-sm transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Ver formulario
            </a>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              Listo
            </button>
          </div>

          <p className="text-zinc-600 text-xs">
            Una vez que el proveedor complete el formulario, aparecerá en este listado con estado <span className="text-yellow-400">Pendiente</span> esperando revisión.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LegajosClient({
  proveedores,
  rubros,
  establecimientos,
  grupoId,
  scopeRestringido = false,
}: {
  proveedores: Proveedor[]
  rubros: { id: string; nombre: string }[]
  establecimientos: { id: string; nombre: string }[]
  grupoId: string
  scopeRestringido?: boolean
}) {
  // ── Estado local (no persistido) ──
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda]           = useState('')
  const [filtroEstado, setFiltroEstado]   = useState('TODOS')
  const [filtroRubro, setFiltroRubro]     = useState('TODOS')
  const [filtroEstab, setFiltroEstab]     = useState('TODOS')
  const [filtroVenc, setFiltroVenc]       = useState<FiltroVenc>('TODOS')
  const [sortKey, setSortKey]             = useState<SortKey>('created_at')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')
  const [vista, setVista]                 = useState<Vista>('lista')
  const [pagina, setPagina]               = useState(1)
  const [modalNuevo, setModalNuevo]       = useState(false)
  const [modalInvitar, setModalInvitar]   = useState(false)
  const [filtrosOpen, setFiltrosOpen]     = useState(false)

  // Debounce de búsqueda (250ms)
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(busquedaInput), 250)
    return () => clearTimeout(t)
  }, [busquedaInput])

  // Cualquier cambio de filtro/búsqueda resetea a la página 1
  useEffect(() => {
    setPagina(1)
  }, [busqueda, filtroEstado, filtroRubro, filtroEstab, filtroVenc, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Filtrar proveedores
  const filtrados = useMemo(() => {
    let lista = [...proveedores]

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      const qNum = q.replace(/[-\s]/g, '')
      lista = lista.filter(p => {
        if (p.razon_social.toLowerCase().includes(q)) return true
        if (p.cuit.replace(/[-\s]/g, '').includes(qNum)) return true
        if (p.email && p.email.toLowerCase().includes(q)) return true
        return false
      })
    }

    if (filtroEstado !== 'TODOS') lista = lista.filter(p => p.estado === filtroEstado)

    if (filtroRubro !== 'TODOS') {
      lista = lista.filter(p => getRubrosProveedor(p).includes(filtroRubro))
    }

    if (filtroEstab !== 'TODOS') {
      lista = lista.filter(p => p.establecimiento_id === filtroEstab)
    }

    if (filtroVenc !== 'TODOS') {
      lista = lista.filter(p => {
        const venc = proximoVencimiento(p.documentos_legajo)
        if (filtroVenc === 'SIN_VENCER') return venc === null || venc > 30
        if (filtroVenc === 'POR_VENCER') return venc !== null && venc >= 0 && venc <= 30
        if (filtroVenc === 'VENCIDOS')   return venc !== null && venc < 0
        return true
      })
    }

    // Ordenamiento
    lista.sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'razon_social') { va = a.razon_social.toLowerCase(); vb = b.razon_social.toLowerCase() }
      else if (sortKey === 'estado') {
        const orden = ['PENDIENTE','EN_REVISION','APROBADO','RECHAZADO','SUSPENDIDO']
        va = orden.indexOf(a.estado); vb = orden.indexOf(b.estado)
      }
      else if (sortKey === 'created_at') { va = a.created_at; vb = b.created_at }
      else if (sortKey === 'docs') {
        va = a.documentos_legajo.filter(d => d.estado === 'APROBADO').length
        vb = b.documentos_legajo.filter(d => d.estado === 'APROBADO').length
      }
      else if (sortKey === 'vencimiento') {
        va = proximoVencimiento(a.documentos_legajo) ?? 9999
        vb = proximoVencimiento(b.documentos_legajo) ?? 9999
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return lista
  }, [proveedores, busqueda, filtroEstado, filtroRubro, filtroEstab, filtroVenc, sortKey, sortDir])

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const inicio = (pagina - 1) * PAGE_SIZE
  const fin    = Math.min(pagina * PAGE_SIZE, filtrados.length)
  const visibles = filtrados.slice(inicio, fin)

  // Conteo por estado
  const conteos = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of proveedores) { c[p.estado] = (c[p.estado] ?? 0) + 1 }
    return c
  }, [proveedores])

  const hayFiltros =
    busqueda || filtroEstado !== 'TODOS' || filtroRubro !== 'TODOS' ||
    filtroEstab !== 'TODOS' || filtroVenc !== 'TODOS'

  const cantidadFiltrosAvanzados =
    (filtroRubro !== 'TODOS' ? 1 : 0) +
    (filtroEstab !== 'TODOS' ? 1 : 0) +
    (filtroVenc  !== 'TODOS' ? 1 : 0)

  function limpiar() {
    setBusquedaInput(''); setBusqueda('')
    setFiltroEstado('TODOS'); setFiltroRubro('TODOS'); setFiltroEstab('TODOS'); setFiltroVenc('TODOS')
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium">Legajos de proveedores</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {filtrados.length === proveedores.length
              ? `${proveedores.length} registro${proveedores.length !== 1 ? 's' : ''}`
              : `${filtrados.length} de ${proveedores.length} registros`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setModalInvitar(true)}
            className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Invitar proveedor
          </button>
          <button onClick={() => setModalNuevo(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo proveedor
          </button>
        </div>
      </div>

      {/* Aviso de scope */}
      {scopeRestringido && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-amber-400 text-sm">
            Mostrando solo los proveedores de tus establecimientos asignados.
          </p>
        </div>
      )}

      {/* ── Búsqueda + Más filtros + Toggle vista ── */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={busquedaInput} onChange={e => setBusquedaInput(e.target.value)}
            placeholder="Buscar por nombre, CUIT o email..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/50 transition-all"/>
          {busquedaInput && (
            <button onClick={() => { setBusquedaInput(''); setBusqueda('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        <button onClick={() => setFiltrosOpen(o => !o)}
          className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm transition-all ${
            filtrosOpen || cantidadFiltrosAvanzados > 0
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:border-white/[0.15]'
          }`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
          {cantidadFiltrosAvanzados > 0 && (
            <span className="bg-blue-500/30 text-blue-200 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              {cantidadFiltrosAvanzados}
            </span>
          )}
        </button>

        {/* Toggle vista */}
        <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-xl p-0.5">
          <button onClick={() => setVista('lista')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              vista === 'lista' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Lista
          </button>
          <button onClick={() => setVista('grid')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              vista === 'grid' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Grid
          </button>
        </div>
      </div>

      {/* ── Panel de filtros avanzados (colapsable) ── */}
      {filtrosOpen && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Rubro</label>
            <select value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50">
              <option value="TODOS">Todos los rubros</option>
              {rubros.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Establecimiento</label>
            <select value={filtroEstab} onChange={e => setFiltroEstab(e.target.value)}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50">
              <option value="TODOS">Todos los establecimientos</option>
              {establecimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Vencimientos</label>
            <select value={filtroVenc} onChange={e => setFiltroVenc(e.target.value as FiltroVenc)}
              className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50">
              <option value="TODOS">Todos</option>
              <option value="SIN_VENCER">Sin vencer (más de 30 días)</option>
              <option value="POR_VENCER">Por vencer (en 30 días)</option>
              <option value="VENCIDOS">Vencidos</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Chips de estado ── */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {(['TODOS', 'PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO'] as const).map(e => {
          const cfg = e === 'TODOS' ? null : ESTADO_CFG[e]
          const count = e === 'TODOS' ? proveedores.length : (conteos[e] ?? 0)
          const activo = filtroEstado === e
          return (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activo
                  ? cfg ? `${estadoClass(cfg.color)} opacity-100` : 'bg-white/[0.08] text-white border-white/[0.15]'
                  : 'bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12]'
              }`}>
              {e === 'TODOS' ? 'Todos' : cfg!.label}
              <span className={`text-xs ${activo ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
            </button>
          )
        })}
        {hayFiltros && (
          <button onClick={limpiar}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Resultados ── */}
      {filtrados.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-16 text-center">
          {hayFiltros ? (
            <>
              <p className="text-zinc-500 mb-2">Sin resultados para los filtros aplicados</p>
              <button onClick={limpiar} className="text-blue-400 hover:text-blue-300 text-sm">Limpiar filtros →</button>
            </>
          ) : (
            <>
              <p className="text-zinc-500 mb-4">No hay proveedores registrados todavía.</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setModalNuevo(true)}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors">
                  + Nuevo proveedor
                </button>
                <button onClick={() => setModalInvitar(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Invitar proveedor →
                </button>
              </div>
            </>
          )}
        </div>
      ) : vista === 'lista' ? (
        // ── VISTA LISTA (tabla) ──
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-6 py-3">
                  <button onClick={() => toggleSort('razon_social')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300">
                    Empresa <SortIcon active={sortKey === 'razon_social'} dir={sortDir}/>
                  </button>
                </th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">CUIT</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">Rubros</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('docs')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300">
                    Docs <SortIcon active={sortKey === 'docs'} dir={sortDir}/>
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('vencimiento')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300">
                    Vence <SortIcon active={sortKey === 'vencimiento'} dir={sortDir}/>
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('estado')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300">
                    Estado <SortIcon active={sortKey === 'estado'} dir={sortDir}/>
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('created_at')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300">
                    Alta <SortIcon active={sortKey === 'created_at'} dir={sortDir}/>
                  </button>
                </th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p, i) => {
                const cfg = ESTADO_CFG[p.estado] ?? ESTADO_CFG.PENDIENTE
                const docs = p.documentos_legajo
                const docsOk = docs.filter(d => d.estado === 'APROBADO').length
                const venc = proximoVencimiento(docs)
                const fecha = new Date(p.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                })
                const rubrosNombres = getRubrosProveedor(p)

                return (
                  <tr key={p.id}
                    onClick={() => window.location.href = `/dashboard/legajos/${p.id}`}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-pointer ${i === visibles.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-white">{p.razon_social}</p>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 text-sm font-mono">{p.cuit}</td>
                    <td className="px-4 py-3.5">
                      {rubrosNombres.length === 0 ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : rubrosNombres.length === 1 ? (
                        <span className="text-zinc-400 text-xs">{rubrosNombres[0]}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-400 text-xs truncate max-w-[100px]">{rubrosNombres[0]}</span>
                          <span className="text-xs bg-white/[0.06] border border-white/[0.1] text-zinc-500 px-1.5 py-0.5 rounded-full shrink-0">
                            +{rubrosNombres.length - 1}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-zinc-500 text-xs bg-white/[0.05] px-2 py-0.5 rounded">
                        {p.tipo_proveedor}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 text-sm">{docsOk}/{docs.length}</td>
                    <td className="px-4 py-3.5"><VencimientoBadge dias={venc}/></td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${estadoClass(cfg.color)}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 text-sm">{fecha}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-blue-400 text-sm">Ver →</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // ── VISTA GRID (cards) ──
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibles.map(p => {
            const cfg = ESTADO_CFG[p.estado] ?? ESTADO_CFG.PENDIENTE
            const docs = p.documentos_legajo
            const docsOk = docs.filter(d => d.estado === 'APROBADO').length
            const venc = proximoVencimiento(docs)
            const rubrosNombres = getRubrosProveedor(p)
            const inicial = p.razon_social.charAt(0).toUpperCase()

            return (
              <div key={p.id}
                onClick={() => window.location.href = `/dashboard/legajos/${p.id}`}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all cursor-pointer flex flex-col gap-3">

                {/* Header con inicial + estado */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="text-blue-300 font-semibold text-sm">{inicial}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.razon_social}</p>
                      <p className="text-xs text-zinc-500 font-mono truncate">{p.cuit}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${estadoClass(cfg.color)}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Rubros */}
                {rubrosNombres.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {rubrosNombres.slice(0, 2).map(r => (
                      <span key={r} className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                    {rubrosNombres.length > 2 && (
                      <span className="text-[10px] text-zinc-500 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        +{rubrosNombres.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats: docs + vencimiento */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Docs</p>
                      <p className="text-sm font-medium text-white">{docsOk}/{docs.length}</p>
                    </div>
                    {venc !== null && (
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Vence</p>
                        <VencimientoBadge dias={venc}/>
                      </div>
                    )}
                  </div>
                  <span className="text-blue-400 text-xs">Ver →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Paginación ── */}
      {filtrados.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 flex-wrap gap-3">
          <p>Mostrando {inicio + 1}–{fin} de {filtrados.length}</p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
                className="px-3 py-1 rounded-lg border border-white/[0.08] hover:border-white/[0.15] hover:text-zinc-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                ← Anterior
              </button>
              <span className="text-zinc-600">Página {pagina} de {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}
                className="px-3 py-1 rounded-lg border border-white/[0.08] hover:border-white/[0.15] hover:text-zinc-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modalNuevo && (
        <ModalNuevoProveedor
          rubros={rubros}
          grupoId={grupoId}
          onClose={() => setModalNuevo(false)}
          onCreado={() => {}}
        />
      )}
      {modalInvitar && <ModalInvitar onClose={() => setModalInvitar(false)}/>}
    </div>
  )
}
