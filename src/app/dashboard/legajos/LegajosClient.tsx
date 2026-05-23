'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Proveedor = {
  id: string
  razon_social: string
  cuit: string
  tipo_proveedor: string
  estado: string
  created_at: string
  rubros: { nombre: string } | null
  documentos_legajo: { id: string; estado: string; fecha_venc: string | null }[]
}

type SortKey = 'razon_social' | 'estado' | 'created_at' | 'docs' | 'vencimiento'
type SortDir = 'asc' | 'desc'

const ESTADO_CFG: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  SUSPENDIDO:  { label: 'Suspendido',  color: 'zinc'   },
}

function estadoClass(color: string) {
  return color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
         color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
         color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
         color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
         'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
}

// Días hasta una fecha (comparación UTC pura, sin corrimiento de zona horaria)
function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

// Próximo vencimiento de los documentos del proveedor
function proximoVencimiento(docs: Proveedor['documentos_legajo']): number | null {
  const activos = docs
    .filter(d => d.fecha_venc && ['CARGADO', 'APROBADO'].includes(d.estado))
    .map(d => diasHasta(d.fecha_venc!))
  if (activos.length === 0) return null
  return Math.min(...activos)
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

export default function LegajosClient({
  proveedores,
  rubros,
}: {
  proveedores: Proveedor[]
  rubros: { id: string; nombre: string }[]
}) {
  const [busqueda, setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroRubro, setFiltroRubro]   = useState('TODOS')
  const [sortKey, setSortKey]       = useState<SortKey>('created_at')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtrados = useMemo(() => {
    let lista = [...proveedores]

    // Búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().replace(/[-\s]/g, '')
      lista = lista.filter(p =>
        p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.cuit.replace(/[-\s]/g, '').includes(q)
      )
    }

    // Filtro estado
    if (filtroEstado !== 'TODOS') {
      lista = lista.filter(p => p.estado === filtroEstado)
    }

    // Filtro rubro
    if (filtroRubro !== 'TODOS') {
      lista = lista.filter(p => p.rubros?.nombre === filtroRubro)
    }

    // Ordenamiento
    lista.sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'razon_social') {
        va = a.razon_social.toLowerCase()
        vb = b.razon_social.toLowerCase()
      } else if (sortKey === 'estado') {
        const orden = ['PENDIENTE','EN_REVISION','APROBADO','RECHAZADO','SUSPENDIDO']
        va = orden.indexOf(a.estado)
        vb = orden.indexOf(b.estado)
      } else if (sortKey === 'created_at') {
        va = a.created_at; vb = b.created_at
      } else if (sortKey === 'docs') {
        va = a.documentos_legajo.filter(d => d.estado === 'APROBADO').length
        vb = b.documentos_legajo.filter(d => d.estado === 'APROBADO').length
      } else if (sortKey === 'vencimiento') {
        va = proximoVencimiento(a.documentos_legajo) ?? 9999
        vb = proximoVencimiento(b.documentos_legajo) ?? 9999
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return lista
  }, [proveedores, busqueda, filtroEstado, filtroRubro, sortKey, sortDir])

  // Conteos por estado para los botones de filtro
  const conteos = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of proveedores) {
      c[p.estado] = (c[p.estado] ?? 0) + 1
    }
    return c
  }, [proveedores])

  const hayFiltros = busqueda || filtroEstado !== 'TODOS' || filtroRubro !== 'TODOS'

  function limpiar() {
    setBusqueda('')
    setFiltroEstado('TODOS')
    setFiltroRubro('TODOS')
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-medium">Legajos de proveedores</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {filtrados.length === proveedores.length
              ? `${proveedores.length} registros`
              : `${filtrados.length} de ${proveedores.length} registros`}
          </p>
        </div>
      </div>

      {/* ── Barra de búsqueda ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filtro rubro */}
        <select
          value={filtroRubro}
          onChange={e => setFiltroRubro(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
        >
          <option value="TODOS">Todos los rubros</option>
          {rubros.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
        </select>
      </div>

      {/* ── Filtros de estado ── */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {(['TODOS', 'PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO'] as const).map(e => {
          const cfg = e === 'TODOS' ? null : ESTADO_CFG[e]
          const count = e === 'TODOS' ? proveedores.length : (conteos[e] ?? 0)
          const activo = filtroEstado === e
          return (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activo
                  ? cfg
                    ? `${estadoClass(cfg.color)} opacity-100`
                    : 'bg-white/[0.08] text-white border-white/[0.15]'
                  : 'bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12]'
              }`}>
              {e === 'TODOS' ? 'Todos' : cfg!.label}
              <span className={`text-xs ${activo ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
            </button>
          )
        })}

        {hayFiltros && (
          <button onClick={limpiar}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Tabla ── */}
      {filtrados.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-16 text-center">
          {hayFiltros ? (
            <>
              <p className="text-zinc-500 mb-2">Sin resultados para los filtros aplicados</p>
              <button onClick={limpiar} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                Limpiar filtros →
              </button>
            </>
          ) : (
            <>
              <p className="text-zinc-500">No hay proveedores registrados todavía.</p>
              <Link href="/registro" target="_blank"
                className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors">
                Ir al portal de registro →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {/* Empresa — sorteable */}
                <th className="text-left px-6 py-3">
                  <button onClick={() => toggleSort('razon_social')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors">
                    Empresa
                    <SortIcon active={sortKey === 'razon_social'} dir={sortDir}/>
                  </button>
                </th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">CUIT</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">Rubro</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-3">Tipo</th>
                {/* Docs — sorteable */}
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('docs')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors">
                    Docs
                    <SortIcon active={sortKey === 'docs'} dir={sortDir}/>
                  </button>
                </th>
                {/* Vence — sorteable */}
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('vencimiento')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors">
                    Vence
                    <SortIcon active={sortKey === 'vencimiento'} dir={sortDir}/>
                  </button>
                </th>
                {/* Estado — sorteable */}
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('estado')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors">
                    Estado
                    <SortIcon active={sortKey === 'estado'} dir={sortDir}/>
                  </button>
                </th>
                {/* Fecha — sorteable */}
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('created_at')}
                    className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors">
                    Alta
                    <SortIcon active={sortKey === 'created_at'} dir={sortDir}/>
                  </button>
                </th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const cfg = ESTADO_CFG[p.estado] ?? ESTADO_CFG.PENDIENTE
                const docs = p.documentos_legajo
                const docsOk = docs.filter(d => d.estado === 'APROBADO').length
                const venc = proximoVencimiento(docs)
                const fecha = new Date(p.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                })
                const esUltimo = i === filtrados.length - 1

                return (
                  // Fila completa clickeable → UX-H-30
                  <tr key={p.id}
                    onClick={() => window.location.href = `/dashboard/legajos/${p.id}`}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-pointer ${esUltimo ? 'border-0' : ''}`}>

                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-white">{p.razon_social}</p>
                    </td>

                    <td className="px-4 py-3.5 text-zinc-400 text-sm font-mono">{p.cuit}</td>

                    <td className="px-4 py-3.5 text-zinc-400 text-xs max-w-[140px] truncate">
                      {p.rubros?.nombre ?? '—'}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-zinc-500 text-xs bg-white/[0.05] px-2 py-0.5 rounded">
                        {p.tipo_proveedor}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-zinc-400 text-sm">
                      {docsOk}/{docs.length}
                    </td>

                    <td className="px-4 py-3.5">
                      <VencimientoBadge dias={venc}/>
                    </td>

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
      )}
    </div>
  )
}
