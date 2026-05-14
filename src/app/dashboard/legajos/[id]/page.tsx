import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AccionesLegajo from './AccionesLegajo'

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
        id, estado, fecha_venc, observaciones, archivo_url, updated_at,
        documentos_requeridos(codigo, nombre, tipo_vigencia, obligatorio)
      )
    `)
    .eq('id', params.id)
    .single()

  if (!proveedor) redirect('/dashboard/legajos')

  const docs = (proveedor.documentos_legajo as any[]) ?? []
  const docsAprobados = docs.filter(d => d.estado === 'APROBADO').length
  const progreso = docs.length > 0 ? Math.round((docsAprobados / docs.length) * 100) : 0

  const estadoDocColor: Record<string, string> = {
    PENDIENTE: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
    CARGADO:   'text-blue-400 border-blue-500/20 bg-blue-500/10',
    APROBADO:  'text-green-400 border-green-500/20 bg-green-500/10',
    RECHAZADO: 'text-red-400 border-red-500/20 bg-red-500/10',
    VENCIDO:   'text-orange-400 border-orange-500/20 bg-orange-500/10',
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/legajos" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-medium">{proveedor.razon_social}</h1>
            <p className="text-zinc-500 text-sm">CUIT {proveedor.cuit} · {(proveedor.rubros as any)?.nombre} · {proveedor.tipo_proveedor}</p>
          </div>
          <AccionesLegajo proveedorId={proveedor.id} estadoActual={proveedor.estado} />
        </div>

        {/* Info + progreso */}
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
            <p className="text-zinc-500 text-xs mb-1">Documentación</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progreso}%` }}/>
              </div>
              <span className="text-xs text-zinc-400">{docsAprobados}/{docs.length}</span>
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Documentos requeridos</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {docs.map((doc: any) => {
              const dr = doc.documentos_requeridos
              const colorClass = estadoDocColor[doc.estado] ?? estadoDocColor.PENDIENTE
              return (
                <div key={doc.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-zinc-500 text-xs font-mono">{dr?.codigo}</span>
                      <span className="text-sm text-white">{dr?.nombre}</span>
                      {dr?.obligatorio && (
                        <span className="text-zinc-600 text-xs">*</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-600 text-xs">{dr?.tipo_vigencia}</span>
                      {doc.fecha_venc && (
                        <span className="text-zinc-600 text-xs">Vence: {new Date(doc.fecha_venc).toLocaleDateString('es-AR')}</span>
                      )}
                      {doc.observaciones && (
                        <span className="text-zinc-500 text-xs italic">"{doc.observaciones}"</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
