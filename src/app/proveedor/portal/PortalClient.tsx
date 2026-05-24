'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ── PP-01: mismo helper que AuditorApp ──────────────────────────────────────
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

type Props = {
  proveedor: any
  documentos: any[]
  historial: any[]
  equipos: any[]
  personal: any[]
  accesos: any[]
  visitas: any[]
}

export default function PortalClient({
  proveedor,
  documentos,
  historial,
  equipos,
  personal,
  accesos,
  visitas,
}: Props) {
  const [tab, setTab] = useState<'docs' | 'equipos' | 'historial' | 'personal' | 'accesos' | 'perfil' | 'auditorias'>('docs')
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState({
    telefono: proveedor.telefono ?? '',
    email: proveedor.email ?? '',
  })

  const { label: estadoLabel, color: estadoColor } = formatEstado(proveedor.estado)

  // ── PP-02: análisis del estado de docs ──────────────────────────────────
  const docsAprobados = documentos.filter(d => d.estado === 'APROBADO').length
  const docsVencidos  = documentos.filter(d => d.estado === 'VENCIDO').length
  const docsTotales   = documentos.length

  // ── PP-07: guardar perfil ────────────────────────────────────────────────
  async function guardarPerfil() {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('proveedores').update({
        telefono: perfil.telefono || null,
        email: perfil.email,
      }).eq('id', proveedor.id)
      setEditandoPerfil(false)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { key: 'docs',       icon: '📄', label: 'Docs', badge: docsVencidos > 0 ? '⚠' : null },
    { key: 'equipos',    icon: '🚛', label: 'Equipos' },
    { key: 'historial',  icon: '🕐', label: 'Historial' },
    { key: 'personal',   icon: '👥', label: 'Personal' },
    { key: 'accesos',    icon: '📍', label: 'Accesos' },
    { key: 'perfil',     icon: '👤', label: 'Perfil' },
    { key: 'auditorias', icon: '📋', label: 'Auditorías' },
  ] as const

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">S</div>
          <span className="font-medium text-sm">Sistema Legajos</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 text-sm">{proveedor.razon_social}</span>
          <a href="/proveedor/logout" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Salir</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── Card de estado del proveedor ── */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="font-semibold text-lg leading-tight">{proveedor.razon_social}</h1>
              <p className="text-zinc-500 text-sm mt-0.5">CUIT {proveedor.cuit}</p>
            </div>
            {/* PP-01: badge formateado */}
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${estadoBadgeClass(estadoColor)}`}>
              {estadoLabel}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500 text-xs">Documentación</span>
            <span className="text-zinc-400 text-xs">{docsAprobados}/{docsTotales}</span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${docsAprobados === docsTotales && docsTotales > 0 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${docsTotales > 0 ? (docsAprobados / docsTotales) * 100 : 0}%` }}
            />
          </div>

          {/* PP-02: banner contextual cuando hay docs vencidos o estado EN_REVISION */}
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
              <p className="text-orange-300 text-sm font-medium mb-0.5">⚠️ Tenés {docsVencidos} documento{docsVencidos > 1 ? 's' : ''} vencido{docsVencidos > 1 ? 's' : ''}</p>
              <p className="text-orange-400/70 text-xs">
                Actualizá tu documentación para mantener tu acceso habilitado a los establecimientos.
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.badge && <span className="text-orange-400 text-xs">{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── TAB: DOCS ── */}
        {tab === 'docs' && (
          <div className="space-y-3">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-medium">Documentos requeridos</h2>
                <p className="text-zinc-500 text-xs mt-0.5">PDF, JPG o PNG — máx. 10MB · Ingresá la fecha antes de subir</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {documentos.map((doc: any) => {
                  const dr = doc.documentos_requeridos
                  const diasV = doc.fecha_venc ? diasHasta(doc.fecha_venc) : null
                  const estaVencido = diasV !== null && diasV < 0

                  const estadoDocColor: Record<string, string> = {
                    PENDIENTE: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                    CARGADO:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    APROBADO:  'bg-green-500/10 text-green-400 border-green-500/20',
                    RECHAZADO: 'bg-red-500/10 text-red-400 border-red-500/20',
                    VENCIDO:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
                  }

                  return (
                    <div key={doc.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-zinc-500 text-xs font-mono">{dr?.codigo}</span>
                            <span className="text-sm font-medium text-white">{dr?.nombre}</span>
                            {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                            {doc.fecha_venc && (
                              <span className={`text-xs ${estaVencido ? 'text-orange-400' : 'text-zinc-500'}`}>
                                Vence: {formatFecha(doc.fecha_venc)}
                                {estaVencido && ' (vencido)'}
                                {!estaVencido && diasV !== null && diasV <= 30 && ` (en ${diasV} días)`}
                              </span>
                            )}
                          </div>
                          {doc.observaciones && (
                            <p className="text-orange-400 text-xs italic mt-1">"{doc.observaciones}"</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.archivo_url && (
                            <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                              ↗
                            </a>
                          )}
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE}`}>
                            {doc.estado === 'VENCIDO' ? 'Vencido' : doc.estado.charAt(0) + doc.estado.slice(1).toLowerCase()}
                          </span>
                        </div>
                      </div>
                      {/* Subida de archivo */}
                      <DocUploadRow docId={doc.id} tipoVigencia={dr?.tipo_vigencia ?? 'ANUAL'} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: EQUIPOS ── */}
        {tab === 'equipos' && (
          <div className="space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
              <span>+</span> Registrar equipo / vehículo
            </button>
            {equipos.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
                <p className="text-zinc-500 text-sm">No tenés equipos registrados todavía</p>
              </div>
            ) : (
              equipos.map((eq: any) => (
                <div key={eq.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 flex items-center gap-4">
                  <span className="text-2xl">{eq.tipos_equipo?.icono}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium font-mono">{eq.dominio}</span>
                      <span className="text-zinc-500 text-xs">{eq.tipos_equipo?.nombre}</span>
                    </div>
                    {(eq.marca || eq.modelo) && (
                      <p className="text-zinc-600 text-xs">{eq.marca} {eq.modelo}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-20 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${eq.documentos_equipo?.length > 0 ? (eq.documentos_equipo.filter((d: any) => d.estado === 'APROBADO').length / eq.documentos_equipo.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-zinc-600 text-xs">
                        {eq.documentos_equipo?.filter((d: any) => d.estado === 'APROBADO').length ?? 0}/{eq.documentos_equipo?.length ?? 0} docs
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${estadoBadgeClass(ESTADO_LABEL[eq.estado]?.color ?? 'zinc')}`}>
                    {ESTADO_LABEL[eq.estado]?.label ?? eq.estado}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium">Historial de documentos</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Todas las acciones sobre tu documentación, del más reciente al más antiguo</p>
            </div>
            {historial.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-500 text-sm">Sin eventos registrados todavía</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {historial.map((h: any) => (
                  <div key={h.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      h.estado_nuevo === 'APROBADO' ? 'bg-green-400' :
                      h.estado_nuevo === 'RECHAZADO' ? 'bg-red-400' :
                      h.estado_nuevo === 'VENCIDO' ? 'bg-orange-400' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="text-zinc-400">{h.nombre_documento}</span>
                        {' — '}
                        <span className={
                          h.estado_nuevo === 'APROBADO' ? 'text-green-400' :
                          h.estado_nuevo === 'RECHAZADO' ? 'text-red-400' :
                          'text-blue-400'
                        }>
                          {h.actor_tipo === 'evaluador' ? 'Evaluador' : 'Proveedor'} {' '}
                          {ESTADO_LABEL[h.estado_nuevo]?.label?.toLowerCase() ?? h.estado_nuevo}
                        </span>
                      </p>
                      {h.observaciones && (
                        <p className="text-zinc-500 text-xs italic mt-0.5">"{h.observaciones}"</p>
                      )}
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

        {/* ── TAB: PERSONAL ── */}
        {tab === 'personal' && (
          <div className="space-y-3">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">Personal con acceso al QR</h2>
                  <p className="text-zinc-500 text-xs mt-0.5">Cada operario recibe un email para definir su contraseña</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                    ↑ Importar Excel
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all">
                    + Agregar
                  </button>
                </div>
              </div>
              <div className="px-5 py-3">
                <a href="#" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  Descargar plantilla CSV
                </a>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {personal.map((p: any) => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/[0.06] rounded-full flex items-center justify-center text-sm">
                      {p.nombre?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{p.nombre}</p>
                      {p.email && <p className="text-zinc-500 text-xs">{p.email}</p>}
                    </div>
                    {p.es_titular && (
                      <span className="text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded-full">Titular</span>
                    )}
                  </div>
                ))}
                {personal.filter((p: any) => !p.es_titular).length === 0 && (
                  <div className="px-5 py-4 text-center">
                    <p className="text-zinc-600 text-sm">Sin operarios todavía</p>
                  </div>
                )}
              </div>
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
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      a.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {a.tipo === 'INGRESO' ? '→' : '←'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{a.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</p>
                      {a.establecimientos?.nombre && (
                        <p className="text-zinc-500 text-xs">{a.establecimientos.nombre}</p>
                      )}
                    </div>
                    <span className="text-zinc-500 text-xs shrink-0">
                      {new Date(a.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PERFIL (PP-07) ── */}
        {tab === 'perfil' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-medium">Datos de la empresa</h2>
              {!editandoPerfil ? (
                <button
                  onClick={() => setEditandoPerfil(true)}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex items-center gap-1"
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
                    onClick={() => { setEditandoPerfil(false); setPerfil({ telefono: proveedor.telefono ?? '', email: proveedor.email ?? '' }) }}
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
              {[
                { label: 'Razón social', value: proveedor.razon_social, readonly: true },
                { label: 'CUIT',        value: proveedor.cuit,         readonly: true },
                { label: 'Rubro',       value: proveedor.rubros?.nombre, readonly: true },
              ].map(({ label, value, readonly }) => (
                <div key={label} className="px-5 py-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-500 text-sm w-32 shrink-0">{label}</span>
                  <span className="text-white text-sm text-right">{value ?? '—'}</span>
                </div>
              ))}

              {/* Email — editable */}
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Email</span>
                {editandoPerfil ? (
                  <input
                    type="email"
                    value={perfil.email}
                    onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1 text-right"
                  />
                ) : (
                  <span className="text-white text-sm">{proveedor.email}</span>
                )}
              </div>

              {/* Teléfono — editable */}
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-zinc-500 text-sm w-32 shrink-0">Teléfono</span>
                {editandoPerfil ? (
                  <input
                    type="tel"
                    value={perfil.telefono}
                    onChange={e => setPerfil(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="Ej: 11 1234-5678"
                    className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 flex-1 text-right placeholder:text-zinc-600"
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
            {visitas.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-zinc-500 text-sm">No tenés visitas de auditoría registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {visitas.map((v: any) => (
                  <div key={v.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">
                        {v.auditor?.nombre ?? 'Auditor'}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${
                        v.resultado === 'APROBADO' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        v.resultado === 'RECHAZADO' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {v.resultado?.toLowerCase() ?? 'sin resultado'}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">
                      {new Date(v.visitado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

// ── Subcomponente de upload (mantiene lógica existente) ──────────────────────
function DocUploadRow({ docId, tipoVigencia }: { docId: string; tipoVigencia: string }) {
  const [fecha, setFecha] = useState('')
  const [uploading, setUploading] = useState(false)

  const hoyStr = new Date().toISOString().split('T')[0]

  async function handleUpload(file: File) {
    if (!fecha) { alert('Ingresá la fecha de vencimiento antes de subir'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('doc_id', docId)
      form.append('fecha_venc', fecha)
      await fetch('/api/proveedor/upload', { method: 'POST', body: form })
      window.location.reload()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        type="date"
        value={fecha}
        min={hoyStr}
        onChange={e => setFecha(e.target.value)}
        className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 w-36"
      />
      <label className={`cursor-pointer bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 text-sm px-4 py-1.5 rounded-lg transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        {uploading ? 'Subiendo…' : 'Subir archivo'}
        <input
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }}
        />
      </label>
    </div>
  )
}
