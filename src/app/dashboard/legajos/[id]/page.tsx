import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AccionesLegajo from './AccionesLegajo'
import AccionesDocumento from './AccionesDocumento'

export default async function LegajoDetallePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select(`
      id, razon_social, cuit, tipo_proveedor, estado, email, telefono, created_at,
      rubros(nombre),
      documentos_legajo(
        id, estado, fecha_venc, observaciones, archivo_url,
        fecha_presentacion, fecha_revision, updated_at,
        documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio),
        documentos_legajo_historial(
          id, estado_anterior, estado_nuevo, actor_tipo, observaciones, archivo_url, created_at,
          usuarios(nombre, email)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!proveedor) redirect('/dashboard/legajos')

  const docs = (proveedor.documentos_legajo as any[]) ?? []
  const docsAprobados = docs.filter(d => d.estado === 'APROBADO').length
  const docsCargados  = docs.filter(d => d.estado === 'CARGADO').length
  const progreso = docs.length > 0 ? Math.round((docsAprobados / docs.length) * 100) : 0

  const obligatoriosSinCargar = docs.filter(d =>
    d.documentos_requeridos?.obligatorio &&
    !['CARGADO', 'APROBADO'].includes(d.estado)
  ).length

  const estadoDocColor: Record<string, string> = {
    PENDIENTE: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
    CARGADO:   'text-blue-400 border-blue-500/20 bg-blue-500/10',
    APROBADO:  'text-green-400 border-green-500/20 bg-green-500/10',
    RECHAZADO: 'text-red-400 border-red-500/20 bg-red-500/10',
    VENCIDO:   'text-orange-400 border-orange-500/20 bg-orange-500/10',
  }

  const actorColor: Record<string, string> = {
    proveedor: 'bg-blue-500/10 text-blue-400',
    evaluador: 'bg-purple-500/10 text-purple-400',
    sistema:   'bg-zinc-500/10 text-zinc-500',
  }

  return (
    <div className="max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/legajos" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-medium">{proveedor.razon_social}</h1>
          <p className="text-zinc-500 text-sm">
            CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre} · {proveedor.tipo_proveedor}
            <span className="ml-3 text-zinc-600">
              Registrado el {new Date(proveedor.created_at).toLocaleDateString('es-AR')}
            </span>
          </p>
        </div>
        <AccionesLegajo
          proveedorId={proveedor.id}
          estadoActual={proveedor.estado}
          puedeAprobar={obligatoriosSinCargar === 0}
          mensajeBloqueo={obligatoriosSinCargar > 0 ? `${obligatoriosSinCargar} doc. obligatorio(s) sin cargar` : ''}
        />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Email</p>
          <p className="text-sm text-white">{proveedor.email}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Teléfono</p>
          <p className="text-sm text-white">{proveedor.telefono ?? '—'}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Documentación aprobada</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progreso}%` }}/>
            </div>
            <span className="text-xs text-zinc-400">{docsAprobados}/{docs.length}</span>
          </div>
          {docsCargados > 0 && (
            <p className="text-zinc-600 text-xs mt-1">{docsCargados} cargado(s) — pendiente de revisión</p>
          )}
        </div>
      </div>

      {/* Alerta */}
      {obligatoriosSinCargar > 0 && proveedor.estado !== 'APROBADO' && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-yellow-400 text-sm">
            Faltan {obligatoriosSinCargar} documento(s) obligatorio(s) para aprobar el legajo
          </span>
        </div>
      )}

      {/* Documentos */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-medium">Documentos requeridos</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Trazabilidad completa — fecha de presentación, revisión e historial de cambios
          </p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {docs.map((doc: any) => {
            const dr = doc.documentos_requeridos
            const historial = (doc.documentos_legajo_historial as any[] ?? [])
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            const colorClass = estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE

            return (
              <div key={doc.id} className="px-6 py-4">
                {/* Fila principal */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
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

                {/* Timestamps de trazabilidad */}
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
                          {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Observaciones */}
                {doc.observaciones && (
                  <p className="text-orange-400 text-xs italic mb-2">"{doc.observaciones}"</p>
                )}

                {/* Historial de estados */}
                {historial.length > 0 && (
                  <div className="mt-3 pl-3 border-l border-white/[0.06] space-y-1.5">
                    {historial.map((h: any) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${actorColor[h.actor_tipo] ?? actorColor.sistema}`}>
                          {h.actor_tipo}
                        </span>
                        <span className="text-zinc-600">
                          {h.estado_anterior && <>{h.estado_anterior.toLowerCase()} → </>}
                          <span className="text-zinc-400">{h.estado_nuevo.toLowerCase()}</span>
                        </span>
                        {h.observaciones && (
                          <span className="text-orange-400 italic">"{h.observaciones}"</span>
                        )}
                        <span className="text-zinc-700 ml-auto">
                          {new Date(h.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Acciones del evaluador */}
                <AccionesDocumento
                  docId={doc.id}
                  estado={doc.estado}
                  fechaVencActual={doc.fecha_venc}
                  tipoVigencia={dr?.tipo_vigencia ?? 'ANUAL'}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
