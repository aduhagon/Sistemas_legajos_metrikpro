'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  stats: { total: number; pendientes: number; enRevision: number; aprobados: number; rechazados: number; suspendidos: number }
  vencimientos: any[]
  vencidos: any[]
  porRubro: any[]
  actividad: any[]
  todosProveedores: any[]
  accesos: any[]
  establecimientos: any[]
}

export default function ReportesClient({
  stats, vencimientos, vencidos, porRubro, actividad, todosProveedores, accesos, establecimientos
}: Props) {
  const [tab, setTab] = useState<'resumen' | 'vencimientos' | 'proveedores' | 'accesos' | 'actividad'>('resumen')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroDias, setFiltroDias] = useState(30)
  const [filtroEstab, setFiltroEstab] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS') // INGRESO | EGRESO | TODOS
  const [filtroFecha, setFiltroFecha] = useState('')

  const hoy = new Date()

  function diasHasta(fecha: string) {
    return Math.ceil((new Date(fecha).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const rubroConteo = porRubro.reduce((acc: Record<string, number>, p: any) => {
    const nombre = p.rubros?.nombre ?? 'Sin rubro'
    acc[nombre] = (acc[nombre] ?? 0) + 1
    return acc
  }, {})

  // Filtrar accesos
  const accesosFiltrados = accesos.filter((a: any) => {
    if (filtroEstab !== 'TODOS' && a.establecimiento_id !== filtroEstab) return false
    if (filtroTipo !== 'TODOS' && a.tipo !== filtroTipo) return false
    if (filtroFecha) {
      const fechaAcceso = new Date(a.created_at).toISOString().split('T')[0]
      if (fechaAcceso !== filtroFecha) return false
    }
    return true
  })

  // Stats de accesos de hoy
  const hoyStr = hoy.toISOString().split('T')[0]
  const accesosHoy = accesos.filter((a: any) =>
    new Date(a.created_at).toISOString().split('T')[0] === hoyStr
  )
  const ingresosHoy = accesosHoy.filter((a: any) => a.tipo === 'INGRESO').length
  const egresosHoy  = accesosHoy.filter((a: any) => a.tipo === 'EGRESO').length
  const anomaliasHoy = accesosHoy.filter((a: any) => a.dentro_perimetro === false).length

  function exportarAccesosCSV() {
    const headers = ['Fecha', 'Hora', 'Tipo', 'Proveedor', 'CUIT', 'Rubro', 'Establecimiento', 'GPS', 'En perímetro']
    const rows = accesosFiltrados.map((a: any) => {
      const fecha = new Date(a.created_at)
      return [
        fecha.toLocaleDateString('es-AR'),
        fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        a.tipo,
        a.habilitaciones?.proveedores?.razon_social ?? '',
        a.habilitaciones?.proveedores?.cuit ?? '',
        a.habilitaciones?.proveedores?.rubros?.nombre ?? '',
        a.establecimiento ?? '',
        a.lat && a.lng ? `${a.lat},${a.lng}` : 'Sin GPS',
        a.dentro_perimetro === null ? 'Sin perímetro' : a.dentro_perimetro ? 'Sí' : 'No',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accesos_${hoyStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarCSV() {
    const headers = ['Razón social', 'CUIT', 'Tipo', 'Rubro', 'Estado', 'Email', 'Teléfono', 'Registrado', 'Alertas email']
    const rows = todosProveedores.map((p: any) => [
      p.razon_social, p.cuit, p.tipo_proveedor,
      p.rubros?.nombre ?? '', p.estado, p.email,
      p.telefono ?? '',
      new Date(p.created_at).toLocaleDateString('es-AR'),
      p.notif_vencimientos ? 'Sí' : 'No',
    ])
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proveedores_${hoyStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarVencimientosCSV() {
    const todos = [...vencimientos, ...vencidos]
    const headers = ['Proveedor', 'CUIT', 'Rubro', 'Documento', 'Fecha venc.', 'Estado', 'Días restantes']
    const rows = todos.map((d: any) => {
      const dias = d.fecha_venc ? diasHasta(d.fecha_venc) : '—'
      return [
        d.proveedores?.razon_social ?? '',
        d.proveedores?.cuit ?? '',
        d.proveedores?.rubros?.nombre ?? '',
        d.documentos_requeridos?.nombre ?? '',
        d.fecha_venc ? new Date(d.fecha_venc).toLocaleDateString('es-AR') : '',
        d.estado,
        typeof dias === 'number' ? (dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `En ${dias} días`) : '—',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vencimientos_${hoyStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const proveedoresFiltrados = filtroEstado === 'TODOS'
    ? todosProveedores
    : todosProveedores.filter((p: any) => p.estado === filtroEstado)

  const vencimientosFiltrados = vencimientos.filter((d: any) => diasHasta(d.fecha_venc) <= filtroDias)

  const estadoColor: Record<string, string> = {
    PENDIENTE:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    EN_REVISION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    APROBADO:    'bg-green-500/10 text-green-400 border-green-500/20',
    RECHAZADO:   'bg-red-500/10 text-red-400 border-red-500/20',
    SUSPENDIDO:  'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {([
          { key: 'resumen',      label: 'Resumen' },
          { key: 'accesos',      label: `Accesos (${accesos.length})` },
          { key: 'vencimientos', label: `Vencimientos (${vencimientos.length + vencidos.length})` },
          { key: 'proveedores',  label: `Proveedores (${stats.total})` },
          { key: 'actividad',    label: 'Actividad' },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total proveedores', value: stats.total,      color: 'white'  },
              { label: 'Aprobados',         value: stats.aprobados,  color: 'green'  },
              { label: 'Pendientes',        value: stats.pendientes, color: 'yellow' },
              { label: 'En revisión',       value: stats.enRevision, color: 'blue'   },
              { label: 'Rechazados',        value: stats.rechazados, color: 'red'    },
              { label: 'Suspendidos',       value: stats.suspendidos,color: 'zinc'   },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
                <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
                <p className={`text-3xl font-medium ${
                  s.color === 'green'  ? 'text-green-400' :
                  s.color === 'yellow' ? 'text-yellow-400' :
                  s.color === 'blue'   ? 'text-blue-400' :
                  s.color === 'red'    ? 'text-red-400' :
                  s.color === 'zinc'   ? 'text-zinc-500' : 'text-white'
                }`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Accesos de hoy */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-4">Accesos hoy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-medium text-green-400">{ingresosHoy}</p>
                <p className="text-zinc-500 text-xs mt-1">Ingresos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-medium text-red-400">{egresosHoy}</p>
                <p className="text-zinc-500 text-xs mt-1">Egresos</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-medium ${anomaliasHoy > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>{anomaliasHoy}</p>
                <p className="text-zinc-500 text-xs mt-1">Anomalías GPS</p>
              </div>
            </div>
            {accesosHoy.length > 0 && (
              <button onClick={() => setTab('accesos')}
                className="mt-4 text-blue-400 hover:text-blue-300 text-xs transition-colors">
                Ver detalle de accesos →
              </button>
            )}
          </div>

          {/* Distribución por rubro */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-4">Proveedores por rubro</h3>
            <div className="space-y-2">
              {Object.entries(rubroConteo)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .map(([rubro, count]) => (
                  <div key={rubro} className="flex items-center gap-3">
                    <span className="text-zinc-400 text-sm w-48 shrink-0 truncate">{rubro}</span>
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full transition-all"
                        style={{ width: `${stats.total > 0 ? ((count as number) / stats.total) * 100 : 0}%` }}/>
                    </div>
                    <span className="text-zinc-500 text-xs w-6 text-right">{count as number}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Alertas */}
          {(vencimientos.length > 0 || vencidos.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {vencidos.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span className="text-red-400 text-sm font-medium">{vencidos.length} documento(s) vencido(s)</span>
                  </div>
                  <button onClick={() => setTab('vencimientos')} className="text-red-400 hover:text-red-300 text-xs transition-colors">Ver detalle →</button>
                </div>
              )}
              {vencimientos.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span className="text-yellow-400 text-sm font-medium">{vencimientos.length} por vencer en 30 días</span>
                  </div>
                  <button onClick={() => setTab('vencimientos')} className="text-yellow-400 hover:text-yellow-300 text-xs transition-colors">Ver detalle →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ACCESOS ── */}
      {tab === 'accesos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filtroEstab} onChange={e => setFiltroEstab(e.target.value)}
              className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
              <option value="TODOS">Todos los establecimientos</option>
              {establecimientos.map((e: any) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
              <option value="TODOS">Ingresos y egresos</option>
              <option value="INGRESO">Solo ingresos</option>
              <option value="EGRESO">Solo egresos</option>
            </select>
            <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
              className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
            {filtroFecha && (
              <button onClick={() => setFiltroFecha('')}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Limpiar fecha</button>
            )}
            <div className="ml-auto">
              <button onClick={exportarAccesosCSV}
                className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-green-400">{accesosFiltrados.filter((a:any) => a.tipo === 'INGRESO').length}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Ingresos</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-red-400">{accesosFiltrados.filter((a:any) => a.tipo === 'EGRESO').length}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Egresos</p>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-yellow-400">{accesosFiltrados.filter((a:any) => a.dentro_perimetro === false).length}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Fuera perímetro</p>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-medium">Registros de acceso</span>
              <span className="text-zinc-500 text-xs">{accesosFiltrados.length} registros</span>
            </div>
            {accesosFiltrados.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-500 text-sm">No hay registros con los filtros seleccionados</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {accesosFiltrados.map((acc: any, i: number) => {
                  const prov = acc.habilitaciones?.proveedores
                  const fecha = new Date(acc.created_at)
                  return (
                    <div key={acc.id} className="px-5 py-3 flex items-center gap-4">
                      {/* Tipo */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${acc.tipo === 'INGRESO' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={acc.tipo === 'INGRESO' ? '#22c55e' : '#ef4444'} strokeWidth="2">
                          {acc.tipo === 'INGRESO'
                            ? <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>
                            : <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>
                          }
                        </svg>
                      </div>

                      {/* Info proveedor */}
                      <div className="flex-1 min-w-0">
                        {prov ? (
                          <Link href={`/dashboard/legajos/${prov.id}`}
                            className="text-white text-sm font-medium hover:text-blue-300 transition-colors">
                            {prov.razon_social}
                          </Link>
                        ) : (
                          <span className="text-zinc-500 text-sm">Proveedor desconocido</span>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {prov && <span className="text-zinc-600 text-xs">CUIT {prov.cuit}</span>}
                          {prov?.rubros?.nombre && <span className="text-zinc-700 text-xs">· {prov.rubros.nombre}</span>}
                        </div>
                      </div>

                      {/* GPS anomalía */}
                      {acc.dentro_perimetro === false && (
                        <span className="text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full shrink-0">
                          ⚠ GPS
                        </span>
                      )}

                      {/* GPS link */}
                      {acc.lat && acc.lng && (
                        <a href={`https://maps.google.com/?q=${acc.lat},${acc.lng}`} target="_blank" rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                        </a>
                      )}

                      {/* Fecha */}
                      <div className="text-right shrink-0">
                        <p className="text-zinc-400 text-xs">{fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</p>
                        <p className="text-zinc-600 text-xs">{fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VENCIMIENTOS ── */}
      {tab === 'vencimientos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">Próximos</span>
              {[7, 15, 30].map(d => (
                <button key={d} onClick={() => setFiltroDias(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filtroDias === d ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {d} días
                </button>
              ))}
            </div>
            <button onClick={exportarVencimientosCSV}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar CSV
            </button>
          </div>

          {vencidos.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-500/10">
                <span className="text-red-400 text-sm font-medium">🔴 Vencidos ({vencidos.length})</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {vencidos.map((d: any) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <Link href={`/dashboard/legajos/${d.proveedores?.id}`}
                        className="text-white text-sm hover:text-blue-300 transition-colors font-medium">
                        {d.proveedores?.razon_social}
                      </Link>
                      <p className="text-zinc-500 text-xs">{d.documentos_requeridos?.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 text-xs font-medium">Venció el {new Date(d.fecha_venc).toLocaleDateString('es-AR')}</p>
                      <p className="text-red-600 text-xs">hace {Math.abs(diasHasta(d.fecha_venc))} días</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vencimientosFiltrados.length > 0 ? (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <span className="text-yellow-400 text-sm font-medium">⚠️ Por vencer ({vencimientosFiltrados.length})</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {vencimientosFiltrados.map((d: any) => {
                  const dias = diasHasta(d.fecha_venc)
                  return (
                    <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <Link href={`/dashboard/legajos/${d.proveedores?.id}`}
                          className="text-white text-sm hover:text-blue-300 transition-colors font-medium">
                          {d.proveedores?.razon_social}
                        </Link>
                        <p className="text-zinc-500 text-xs">{d.documentos_requeridos?.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-300 text-xs">{new Date(d.fecha_venc).toLocaleDateString('es-AR')}</p>
                        <p className={`text-xs font-medium ${dias <= 7 ? 'text-red-400' : dias <= 15 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          en {dias} día{dias !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No hay documentos por vencer en los próximos {filtroDias} días</p>
            </div>
          )}
        </div>
      )}

      {/* ── PROVEEDORES ── */}
      {tab === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {['TODOS', 'PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO'].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filtroEstado === e ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {e === 'TODOS' ? 'Todos' : e === 'EN_REVISION' ? 'En revisión' : e.charAt(0) + e.slice(1).toLowerCase()}
                  {e !== 'TODOS' && ` (${todosProveedores.filter((p: any) => p.estado === e).length})`}
                </button>
              ))}
            </div>
            <button onClick={exportarCSV}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar CSV
            </button>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Empresa', 'CUIT', 'Rubro', 'Docs', 'Estado', 'Registrado', ''].map(h => (
                    <th key={h} className="text-left text-zinc-500 text-xs font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p: any, i: number) => {
                  const docs = p.documentos_legajo ?? []
                  const docsOk = docs.filter((d: any) => d.estado === 'APROBADO').length
                  const docsVenc = docs.filter((d: any) => d.estado === 'VENCIDO').length
                  return (
                    <tr key={p.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i === proveedoresFiltrados.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{p.razon_social}</p>
                        <p className="text-zinc-600 text-xs">{p.email}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{p.cuit}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{p.rubros?.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-400 text-xs">{docsOk}/{docs.length}</span>
                        {docsVenc > 0 && <span className="text-red-400 text-xs ml-1">({docsVenc} venc.)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${estadoColor[p.estado] ?? estadoColor.PENDIENTE}`}>
                          {p.estado === 'EN_REVISION' ? 'En revisión' : p.estado.charAt(0) + p.estado.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/legajos/${p.id}`} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">Ver →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {proveedoresFiltrados.length === 0 && (
              <div className="px-5 py-8 text-center"><p className="text-zinc-500 text-sm">No hay proveedores con ese estado</p></div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVIDAD ── */}
      {tab === 'actividad' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-medium">Actividad reciente</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Últimas 20 acciones registradas</p>
          </div>
          {actividad.length === 0 ? (
            <div className="px-5 py-8 text-center"><p className="text-zinc-500 text-sm">Sin actividad registrada</p></div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {actividad.map((a: any) => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    a.accion === 'APROBADO' ? 'bg-green-500/10' :
                    a.accion === 'RECHAZADO' ? 'bg-red-500/10' : 'bg-blue-500/10'
                  }`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={a.accion === 'APROBADO' ? '#22c55e' : a.accion === 'RECHAZADO' ? '#ef4444' : '#60a5fa'}
                      strokeWidth="2">
                      {a.accion === 'APROBADO' ? <polyline points="20,6 9,17 4,12"/> :
                       a.accion === 'RECHAZADO' ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> :
                       <circle cx="12" cy="12" r="4"/>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm">{a.accion.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-zinc-600 text-xs ml-2">{a.entidad}</span>
                  </div>
                  <span className="text-zinc-600 text-xs shrink-0">
                    {new Date(a.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
