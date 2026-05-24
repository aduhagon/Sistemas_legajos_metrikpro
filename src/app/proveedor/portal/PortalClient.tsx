'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── PP-01: helper de estado — mismo patrón que AuditorApp ───────────────────
const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'yellow' },
  EN_REVISION: { label: 'En revisión', color: 'blue'   },
  APROBADO:    { label: 'Aprobado',    color: 'green'  },
  RECHAZADO:   { label: 'Rechazado',   color: 'red'    },
  SUSPENDIDO:  { label: 'Suspendido',  color: 'zinc'   },
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

// ── helpers de fecha ─────────────────────────────────────────────────────────
function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function formatFecha(fechaStr: string) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-AR')
}

// ── Props exactas según page.tsx ─────────────────────────────────────────────
type Props = {
  proveedor: any
  docs: any[]
  habilitacion: any | null
  operarios: any[]
  accesos: any[]
  historialPorDoc: Record<string, any[]>
  miRol: string
  visitasAuditoria: any[]
  equiposSlot: React.ReactNode
}

export default function PortalClient({
  proveedor,
  docs,
  habilitacion,
  operarios,
  accesos,
  historialPorDoc,
  miRol,
  visitasAuditoria,
  equiposSlot,
}: Props) {
  const [tab, setTab] = useState<'docs' | 'equipos' | 'historial' | 'personal' | 'accesos' | 'perfil' | 'auditorias'>('docs')
  const [uploadModal, setUploadModal] = useState<{ docId: string; nombre: string; tipoVigencia: string; fechaActual: string | null } | null>(null)
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState({
    telefono: proveedor.telefono ?? '',
    email: proveedor.email ?? '',
  })

  // ── PP-01: estado formateado ─────────────────────────────────────────────
  const { label: estadoLabel, color: estadoColor } = formatEstado(proveedor.estado)

  // ── PP-02: análisis docs ─────────────────────────────────────────────────
  const docsAprobados = docs.filter(d => d.estado === 'APROBADO').length
  const docsVencidos  = docs.filter(d => d.estado === 'VENCIDO').length
  const docsTotales   = docs.length

  // Historial aplanado y ordenado de más reciente a más antiguo
  const historialFlat = Object.values(historialPorDoc)
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Mapa doc_id → nombre de documento (para mostrar en historial)
  const docNombreMap: Record<string, string> = {}
  for (const d of docs) {
    docNombreMap[d.id] = d.documentos_requeridos?.nombre ?? '—'
  }

  // ── PP-07: guardar perfil vía supabase-client ────────────────────────────
  async function guardarPerfil() {
    setSaving(true)
    try {
      await supabase
        .from('proveedores')
        .update({
          telefono: perfil.telefono || null,
          email: perfil.email,
        })
        .eq('id', proveedor.id)
      setEditandoPerfil(false)
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { key: 'docs',       icon: '📄', label: 'Docs',       badge: docsVencidos > 0 ? '⚠' : null },
    { key: 'equipos',    icon: '🚛', label: 'Equipos',    badge: null },
    { key: 'historial',  icon: '🕐', label: 'Historial',  badge: null },
    { key: 'personal',   icon: '👥', label: 'Personal',   badge: null },
    { key: 'accesos',    icon: '📍', label: 'Accesos',    badge: null },
    { key: 'perfil',     icon: '👤', label: 'Perfil',     badge: null },
    { key: 'auditorias', icon: '📋', label: 'Auditorías', badge: null },
  ] as const

  const estadoDocColor: Record<string, string> = {
    PENDIENTE: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    CARGADO:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    APROBADO:  'bg-green-500/10 text-green-400 border-green-500/20',
    RECHAZADO: 'bg-red-500/10 text-red-400 border-red-500/20',
    VENCIDO:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* Navbar */}
      <nav className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">S</div>
          <span className="font-medium text-sm">Sistema Legajos</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 text-sm hidden sm:block">{proveedor.razon_social}</span>
          <a href="/proveedor/logout" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Salir</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── Card de estado ── */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="font-semibold text-lg leading-tight">{proveedor.razon_social}</h1>
              <p className="text-zinc-500 text-sm mt-0.5">CUIT {proveedor.cuit}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ml-3 ${estadoBadgeClass(estadoColor)}`}>
              {estadoLabel}
            </span>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500 text-xs">Documentación</span>
            <span className="text-zinc-400 text-xs">{docsAprobados}/{docsTotales}</span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                docsAprobados === docsTotales && docsTotales > 0 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${docsTotales > 0 ? (docsAprobados / docsTotales) * 100 : 0}%` }}
            />
          </div>

          {proveedor.estado === 'EN_REVISION' && (
            <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-sm font-medium mb-0.5">📋 Tu legajo está en revisión</p>
              <p className="text-blue-400/70 text-xs">
                El equipo evaluador está revisando tu documentación. Podés seguir subiendo documentos mientras tanto.
              </p>
            </div>
          )}
          {proveedor.estado === 'RECHAZADO' && (
            <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-300 text-sm font-medium mb-0.5">❌ Tu legajo fue rechazado</p>
              <p className="text-red-400/70 text-xs">
                Revisá las observaciones en cada documento y volvé a subir la documentación corregida.
              </p>
            </div>
          )}
          {docsVencidos > 0 && proveedor.estado !== 'RECHAZADO' && (
            <div className="mt-4 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
              <p className="text-orange-300 text-sm font-medium mb-0.5">
                ⚠️ Tenés {docsVencidos} documento{docsVencidos > 1 ? 's' : ''} vencido{docsVencidos > 1 ? 's' : ''}
              </p>
              <p className="text-orange-400/70 text-xs">
                Actualizá tu documentación para mantener tu acceso habilitado a los establecimientos.
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs — FIX: scroll horizontal sin scrollbar visible ── */}
        <div className="mb-5">
          <div
            className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`
              .portal-tabs-container::-webkit-scrollbar { display: none; }
            `}</style>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  tab === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge && <span className="text-orange-400 text-xs ml-0.5">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: DOCS ── */}
        {tab === 'docs' && (
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
                    {/* Ícono de estado */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
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
                        <span className="text-sm font-medium text-white truncate">{dr?.nombre}</span>
                        {dr?.obligatorio && <span className="text-red-400 text-xs shrink-0">*</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-zinc-600 text-xs">{dr?.codigo} · {dr?.tipo_vigencia}</span>
                        {doc.fecha_venc && (
                          <span className={`text-xs ${estaVencido ? 'text-orange-400' : 'text-zinc-500'}`}>
                            Vence {formatFecha(doc.fecha_venc)}
                            {estaVencido && ' ⚠'}
                          </span>
                        )}
                      </div>
                      {doc.observaciones && (
                        <p className="text-orange-400 text-xs italic mt-0.5">↳ {doc.observaciones}</p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.archivo_url && (
                        <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                          title="Ver archivo">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}
                      {puedeSubir && (
                        <button
                          onClick={() => setUploadModal({
                            docId: doc.id,
                            nombre: dr?.nombre ?? '',
                            tipoVigencia: dr?.tipo_vigencia ?? 'ANUAL',
                            fechaActual: doc.fecha_venc,
                          })}
                          className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

            {/* ── Modal de upload ── */}
            {uploadModal && (
              <UploadModal
                docId={uploadModal.docId}
                nombre={uploadModal.nombre}
                proveedorId={proveedor.id}
                tipoVigencia={uploadModal.tipoVigencia}
                fechaActual={uploadModal.fechaActual}
                onClose={() => setUploadModal(null)}
              />
            )}
          </div>
        )}

        {/* ── TAB: EQUIPOS ── */}
        {tab === 'equipos' && (
          <div>{equiposSlot}</div>
        )}

        {/* ── TAB: HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Historial de documentos</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Todas las acciones sobre tu documentación, del más reciente al más antiguo</p>
            </div>
            {historialFlat.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-500 text-sm">Sin eventos registrados todavía</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {historialFlat.map((h: any) => (
                  <div key={h.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      h.estado_nuevo === 'APROBADO'  ? 'bg-green-400'  :
                      h.estado_nuevo === 'RECHAZADO' ? 'bg-red-400'    :
                      h.estado_nuevo === 'VENCIDO'   ? 'bg-orange-400' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="text-zinc-400">{docNombreMap[h.documento_id] ?? '—'}</span>
                        {' — '}
                        <span className={
                          h.estado_nuevo === 'APROBADO'  ? 'text-green-400' :
                          h.estado_nuevo === 'RECHAZADO' ? 'text-red-400'   : 'text-blue-400'
                        }>
                          {h.actor_tipo === 'evaluador' ? 'Evaluador' : 'Proveedor'}{' '}
                          {ESTADO_LABEL[h.estado_nuevo]?.label?.toLowerCase() ?? h.estado_nuevo}
                        </span>
                      </p>
                      {h.observaciones && (
                        <p className="text-zinc-500 text-xs italic mt-0.5">"{h.observaciones}"</p>
                      )}
                    </div>
                    <span className="text-zinc-600 text-xs shrink-0">
                      {new Date(h.created_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PERSONAL ── */}
        {tab === 'personal' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Personal con acceso al QR</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Cada operario recibe un email para definir su contraseña</p>
              </div>
              {miRol === 'titular' && (
                <div className="flex gap-2 shrink-0">
                  <button className="bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                    ↑ Importar Excel
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all">
                    + Agregar
                  </button>
                </div>
              )}
            </div>
            {miRol === 'titular' && (
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <a href="#" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  Descargar plantilla CSV
                </a>
              </div>
            )}
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
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    p.rol === 'titular'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}>
                    {p.rol === 'titular' ? 'Titular' : 'Operario'}
                  </span>
                </div>
              ))}
              {operarios.filter((p: any) => p.rol !== 'titular').length === 0 && (
                <div className="px-5 py-6 text-center">
                  <p className="text-zinc-600 text-sm">Sin operarios registrados todavía</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ACCESOS ── */}
        {tab === 'accesos' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Registros de acceso</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Ingresos y egresos registrados en los establecimientos</p>
            </div>
            {accesos.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-500 text-sm">Sin registros todavía</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {accesos.map((a: any) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      a.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {a.tipo === 'INGRESO' ? '→' : '←'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{a.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</p>
                    </div>
                    <span className="text-zinc-500 text-xs shrink-0">
                      {new Date(a.created_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PERFIL ── */}
        {tab === 'perfil' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-medium">Datos de la empresa</h2>
              {!editandoPerfil ? (
                <button
                  onClick={() => setEditandoPerfil(true)}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditandoPerfil(false)
                      setPerfil({ telefono: proveedor.telefono ?? '', email: proveedor.email ?? '' })
                    }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarPerfil}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-lg transition-all"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {([
                { label: 'Razón social', value: proveedor.razon_social },
                { label: 'CUIT',         value: proveedor.cuit },
                { label: 'Rubro',        value: (proveedor.rubros as any)?.nombre },
              ] as const).map(({ label, value }) => (
                <div key={label} className="px-5 py-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-500 text-sm w-32 shrink-0">{label}</span>
                  <span className="text-white text-sm">{value ?? '—'}</span>
                </div>
              ))}

              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Email</span>
                {editandoPerfil ? (
                  <input
                    type="email"
                    value={perfil.email}
                    onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1"
                  />
                ) : (
                  <span className="text-white text-sm">{proveedor.email}</span>
                )}
              </div>

              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Teléfono</span>
                {editandoPerfil ? (
                  <input
                    type="tel"
                    value={perfil.telefono}
                    onChange={e => setPerfil(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="Ej: 11 1234-5678"
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1 placeholder:text-zinc-600"
                  />
                ) : (
                  <span className="text-white text-sm">{proveedor.telefono ?? '—'}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: AUDITORÍAS ── */}
        {tab === 'auditorias' && (
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
                      <span className="text-white text-sm font-medium">
                        {(v.auditor as any)?.nombre ?? 'Auditor'}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${
                        v.resultado === 'APROBADO'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        v.resultado === 'RECHAZADO' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {v.resultado
                          ? v.resultado.charAt(0) + v.resultado.slice(1).toLowerCase()
                          : 'Sin resultado'}
                      </span>
                    </div>
                    {(v.establecimiento as any)?.nombre && (
                      <p className="text-zinc-600 text-xs mb-0.5">{(v.establecimiento as any).nombre}</p>
                    )}
                    <p className="text-zinc-500 text-xs">
                      {new Date(v.visitado_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    {v.observacion && (
                      <p className="text-zinc-400 text-xs mt-1 italic">"{v.observacion}"</p>
                    )}
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

// ── UploadModal ──────────────────────────────────────────────────────────────
function UploadModal({
  docId,
  nombre,
  proveedorId,
  tipoVigencia,
  fechaActual,
  onClose,
}: {
  docId: string
  nombre: string
  proveedorId: string
  tipoVigencia: string
  fechaActual: string | null
  onClose: () => void
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
      const form = new FormData()
      form.append('file', archivo)
      form.append('doc_id', docId)
      form.append('tipo', 'legajo')
      if (necesitaFecha && fecha) form.append('fecha_venc', fecha)

      const res = await fetch('/api/proveedor/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al subir el archivo')

      setOk(true)
      setTimeout(() => window.location.reload(), 1000)
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
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
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
              <p className="text-zinc-500 text-xs mt-1">Recargando…</p>
            </div>
          ) : (
            <>
              {necesitaFecha && (
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">
                    Fecha de vencimiento <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    min={hoyStr}
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
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setArchivo(null) }}
                      className="text-zinc-500 hover:text-zinc-300 shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-sm py-2.5 rounded-xl transition-all"
                >
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
