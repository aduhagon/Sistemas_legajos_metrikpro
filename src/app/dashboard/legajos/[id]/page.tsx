import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AccionesLegajo from './AccionesLegajo'
import AccionesDocumento from './AccionesDocumento'
import AccionesDocumentoEquipo from '@/components/AccionesDocumentoEquipo'
import VisitasAuditoriaLegajo from './VisitasAuditoriaLegajo'
import HistorialDocumento from './HistorialDocumento'
import LegajoTabs from './LegajoTabs'
import AccionesRapidasLegajo from './AccionesRapidasLegajo'

type Tab = 'documentos' | 'equipos' | 'auditorias' | 'historial'

export default async function LegajoDetallePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tabActivo = (searchParams.tab as Tab) ?? 'documentos'

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select(`
      id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at,
      rubros(nombre),
      documentos_legajo(
        id, estado, fecha_venc, observaciones, archivo_url,
        fecha_presentacion, fecha_revision, updated_at,
        documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)
      )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!proveedor) redirect('/dashboard/legajos')

  // Historial
  const { data: historialData } = await supabase
    .from('documentos_legajo_historial')
    .select('id, documento_id, estado_anterior, estado_nuevo, actor_tipo, observaciones, created_at')
    .in('documento_id', (proveedor.documentos_legajo as any[]).map((d: any) => d.id))
    .order('created_at', { ascending: true })

  const historialPorDoc: Record<string, any[]> = {}
  for (const h of historialData ?? []) {
    if (!historialPorDoc[h.documento_id]) historialPorDoc[h.documento_id] = []
    historialPorDoc[h.documento_id].push(h)
  }

  // Equipos
  const { data: equipos } = await supabase
    .from('equipos_contratista')
    .select(`
      id, dominio, marca, modelo, anio, estado,
      tipos_equipo(nombre, icono),
      documentos_equipo(
        id, estado, fecha_venc, archivo_url, observaciones, updated_at,
        documentos_requeridos_equipo(nombre, tipo_vigencia, obligatorio)
      )
    `)
    .eq('proveedor_id', params.id)
    .order('created_at', { ascending: false })

  // Visitas de auditoría
  const { data: visitasAuditoria } = await supabase
    .from('visitas_auditoria')
    .select(`
      id, visitado_at, resultado, estado_supervision,
      observacion, supervision_obs, offline, lat, lng,
      auditor:auditor_id ( nombre ),
      checklist:visitas_checklist (
        cumple, observacion,
        item:checklist_id ( nombre )
      )
    `)
    .eq('proveedor_id', params.id)
    .order('visitado_at', { ascending: false })

  // Habilitación (para Ver QR)
  const { data: habilitacion } = await supabase
    .from('habilitaciones')
    .select('qr_token, estado')
    .eq('proveedor_id', params.id)
    .eq('estado', 'VIGENTE')
    .maybeSingle()

  const { data: usuario } = await supabase
    .from('usuarios').select('rol').eq('id', user.id).single()

  const docs = (proveedor.documentos_legajo as any[]) ?? []
  const equiposData = (equipos ?? []) as any[]

  const docsAprobados = docs.filter(d => d.estado === 'APROBADO').length
  const docsCargados  = docs.filter(d => d.estado === 'CARGADO').length
  const progreso = docs.length > 0 ? Math.round((docsAprobados / docs.length) * 100) : 0

  const obligatoriosSinCargar = docs.filter(d =>
    d.documentos_requeridos?.obligatorio &&
    !['CARGADO', 'APROBADO'].includes(d.estado)
  ).length

  const equiposCargados = equiposData.filter(e =>
    e.documentos_equipo?.some((d: any) => d.estado === 'CARGADO')
  ).length

  const auditoriasPendientes = (visitasAuditoria ?? []).filter(
    (v: any) => v.estado_supervision === 'PENDIENTE'
  ).length

  const estadoDocColor: Record<string, string> = {
    PENDIENTE: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
    CARGADO:   'text-blue-400 border-blue-500/20 bg-blue-500/10',
    APROBADO:  'text-green-400 border-green-500/20 bg-green-500/10',
    RECHAZADO: 'text-red-400 border-red-500/20 bg-red-500/10',
    VENCIDO:   'text-orange-400 border-orange-500/20 bg-orange-500/10',
  }

  const estadoProvColor: Record<string, string> = {
    PENDIENTE:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    EN_REVISION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    APROBADO:    'bg-green-500/10 text-green-400 border-green-500/20',
    RECHAZADO:   'bg-red-500/10 text-red-400 border-red-500/20',
    SUSPENDIDO:  'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  }

  const estadoProvLabel: Record<string, string> = {
    PENDIENTE:   'Pendiente',
    EN_REVISION: 'En revisión',
    APROBADO:    'Aprobado',
    RECHAZADO:   'Rechazado',
    SUSPENDIDO:  'Suspendido',
  }

  return (
    <div className="max-w-4xl">

      {/* ── HEADER ── */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/dashboard/legajos" className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-medium">{proveedor.razon_social}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${estadoProvColor[proveedor.estado] ?? estadoProvColor.PENDIENTE}`}>
              {estadoProvLabel[proveedor.estado] ?? proveedor.estado}
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre} · {proveedor.tipo_proveedor}
            <span className="ml-3 text-zinc-600">
              Alta: {new Date(proveedor.created_at).toLocaleDateString('es-AR')}
            </span>
          </p>
        </div>

        {/* Acciones rápidas del header */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <AccionesRapidasLegajo
            proveedorId={proveedor.id}
            proveedorEmail={proveedor.email}
            qrToken={habilitacion?.qr_token ?? null}
          />
          <AccionesLegajo
            proveedorId={proveedor.id}
            estadoActual={proveedor.estado}
            puedeAprobar={obligatoriosSinCargar === 0}
            mensajeBloqueo={obligatoriosSinCargar > 0 ? `${obligatoriosSinCargar} doc. obligatorio(s) sin cargar` : ''}
          />
        </div>
      </div>

      {/* ── INFO CARDS ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Email</p>
          <p className="text-sm text-white truncate">{proveedor.email}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Teléfono</p>
          <p className="text-sm text-white">{proveedor.telefono ?? '—'}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Documentos</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progreso}%` }}/>
            </div>
            <span className="text-xs text-zinc-400">{docsAprobados}/{docs.length}</span>
          </div>
          {docsCargados > 0 && (
            <p className="text-zinc-600 text-xs mt-1">{docsCargados} para revisar</p>
          )}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Equipos</p>
          <p className="text-sm text-white">{equiposData.length} registrado{equiposData.length !== 1 ? 's' : ''}</p>
          {equiposCargados > 0 && (
            <p className="text-zinc-600 text-xs mt-1">{equiposCargados} con docs pendientes</p>
          )}
        </div>
      </div>

      {/* Alerta docs obligatorios */}
      {obligatoriosSinCargar > 0 && proveedor.estado !== 'APROBADO' && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-yellow-400 text-sm">
            Faltan {obligatoriosSinCargar} documento(s) obligatorio(s) para aprobar el legajo
          </span>
        </div>
      )}

      {/* ── TABS ── */}
      <LegajoTabs
        tabActivo={tabActivo}
        badgeDocsPendientes={docsCargados}
        badgeEquiposPendientes={equiposCargados}
        badgeAuditoriasPendientes={auditoriasPendientes}
      />

      {/* ── TAB: DOCUMENTOS ── */}
      {tabActivo === 'documentos' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Documentos del legajo</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Documentación de la empresa contratista</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {docs.map((doc: any) => {
              const dr = doc.documentos_requeridos
              const colorClass = estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE

              return (
                <div key={doc.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-zinc-500 text-xs font-mono">{dr?.codigo}</span>
                        <span className="text-sm text-white">{dr?.nombre}</span>
                        {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                      </div>
                      <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {doc.archivo_url && (
                        <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                          Ver archivo →
                        </a>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${colorClass}`}>
                        {doc.estado.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="flex items-center gap-4 mb-2 flex-wrap">
                    {doc.fecha_presentacion && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"/>
                        <span className="text-zinc-600 text-xs">
                          Presentado: <span className="text-zinc-400">
                            {new Date(doc.fecha_presentacion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </div>
                    )}
                    {doc.fecha_revision && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"/>
                        <span className="text-zinc-600 text-xs">
                          Revisado: <span className="text-zinc-400">
                            {new Date(doc.fecha_revision).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </div>
                    )}
                    {doc.fecha_venc && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"/>
                        <span className="text-zinc-600 text-xs">
                          Vence: <span className="text-zinc-400">
                            {new Date(doc.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {doc.observaciones && (
                    <p className="text-orange-400 text-xs italic mb-2">"{doc.observaciones}"</p>
                  )}

                  {/* NOTIF-001: proveedorId y docNombre para notificación de rechazo */}
                  <AccionesDocumento
                    docId={doc.id}
                    estado={doc.estado}
                    fechaVencActual={doc.fecha_venc}
                    tipoVigencia={dr?.tipo_vigencia ?? 'ANUAL'}
                    proveedorId={proveedor.id}
                    docNombre={dr?.nombre ?? ''}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: EQUIPOS ── */}
      {tabActivo === 'equipos' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Equipos y bienes de uso</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {equiposData.length === 0
                ? 'Sin equipos registrados'
                : `${equiposData.length} equipo${equiposData.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {equiposData.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-zinc-600 text-sm">El proveedor no ha registrado equipos todavía</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {equiposData.map((equipo: any) => {
                const tipo = equipo.tipos_equipo
                const docsEquipo = equipo.documentos_equipo ?? []
                const docsAprobadosEq = docsEquipo.filter((d: any) => d.estado === 'APROBADO').length
                const docsCargadosEq  = docsEquipo.filter((d: any) => d.estado === 'CARGADO').length
                const progresoEq = docsEquipo.length > 0 ? Math.round((docsAprobadosEq / docsEquipo.length) * 100) : 0

                const estadoEquipoColor: Record<string, string> = {
                  PENDIENTE:   'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
                  EN_REVISION: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
                  APROBADO:    'text-green-400 border-green-500/20 bg-green-500/10',
                  RECHAZADO:   'text-red-400 border-red-500/20 bg-red-500/10',
                  INACTIVO:    'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
                }

                return (
                  <details key={equipo.id} className="group">
                    <summary className="px-6 py-4 flex items-center gap-4 cursor-pointer list-none hover:bg-white/[0.01] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className="text-zinc-600 group-open:rotate-90 transition-transform shrink-0">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      <span className="text-xl shrink-0">{tipo?.icono}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium font-mono">{equipo.dominio}</span>
                          <span className="text-zinc-500 text-xs">{tipo?.nombre}</span>
                          {equipo.marca && <span className="text-zinc-600 text-xs">{equipo.marca} {equipo.modelo}</span>}
                          {docsCargadosEq > 0 && (
                            <span className="text-blue-400 text-xs bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                              {docsCargadosEq} para revisar
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progresoEq}%` }}/>
                          </div>
                          <span className="text-zinc-600 text-xs">{docsAprobadosEq}/{docsEquipo.length} docs</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${estadoEquipoColor[equipo.estado] ?? estadoEquipoColor.PENDIENTE}`}>
                        {equipo.estado.toLowerCase()}
                      </span>
                    </summary>

                    <div className="border-t border-white/[0.04]">
                      {docsEquipo.length === 0 ? (
                        <div className="px-6 py-4 text-center">
                          <p className="text-zinc-600 text-sm">Sin documentos requeridos para este tipo de equipo</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.03]">
                          {docsEquipo.map((doc: any) => {
                            const dr = doc.documentos_requeridos_equipo
                            const colorClass = estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE
                            return (
                              <div key={doc.id} className="px-6 py-4 pl-14">
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-sm text-white">{dr?.nombre}</span>
                                      {dr?.obligatorio && <span className="text-red-400 text-xs">*</span>}
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                                      {doc.fecha_venc && (
                                        <span className="text-zinc-500 text-xs">
                                          Vence: {new Date(doc.fecha_venc + 'T12:00:00').toLocaleDateString('es-AR')}
                                        </span>
                                      )}
                                    </div>
                                    {doc.observaciones && (
                                      <p className="text-orange-400 text-xs italic mt-1">"{doc.observaciones}"</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {doc.archivo_url && (
                                      <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                                        Ver archivo →
                                      </a>
                                    )}
                                    <span className={`text-xs px-2.5 py-1 rounded-full border ${colorClass}`}>
                                      {doc.estado.toLowerCase()}
                                    </span>
                                  </div>
                                </div>
                                <AccionesDocumentoEquipo
                                  docId={doc.id}
                                  estado={doc.estado}
                                  fechaVencActual={doc.fecha_venc}
                                  tipoVigencia={dr?.tipo_vigencia ?? 'ANUAL'}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: AUDITORÍAS ── */}
      {tabActivo === 'auditorias' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Visitas de auditoría</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {(visitasAuditoria ?? []).length === 0
                ? 'Sin visitas registradas'
                : `${(visitasAuditoria ?? []).length} visita${(visitasAuditoria ?? []).length !== 1 ? 's' : ''} registrada${(visitasAuditoria ?? []).length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="px-6 py-4">
            <VisitasAuditoriaLegajo
              visitas={visitasAuditoria ?? []}
              rol={usuario?.rol ?? 'evaluador'}
            />
          </div>
        </div>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {tabActivo === 'historial' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Historial de documentos</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              Todas las acciones sobre la documentación del proveedor
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {docs.map((doc: any) => {
              const historial = historialPorDoc[doc.id] ?? []
              if (historial.length === 0) return null
              const dr = doc.documentos_requeridos
              const colorClass = estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE
              return (
                <div key={doc.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-zinc-500 text-xs font-mono">{dr?.codigo}</span>
                    <span className="text-sm text-white">{dr?.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ml-auto ${colorClass}`}>
                      {doc.estado.toLowerCase()}
                    </span>
                  </div>
                  <HistorialDocumento historial={historial} expandidoPorDefecto={true} />
                </div>
              )
            })}
            {Object.keys(historialPorDoc).length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-zinc-500 text-sm">Sin historial registrado todavía</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
