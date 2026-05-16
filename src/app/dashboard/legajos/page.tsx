import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LegajosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proveedores } = await supabase
    .from('proveedores')
    .select(`id, razon_social, cuit, tipo_proveedor, estado, created_at,
      rubros(nombre), documentos_legajo(id, estado)`)
    .order('created_at', { ascending: false })

  const estadoConfig: Record<string, { label: string; color: string }> = {
    PENDIENTE:   { label: 'Pendiente',    color: 'yellow' },
    EN_REVISION: { label: 'En revisión',  color: 'blue'   },
    APROBADO:    { label: 'Aprobado',     color: 'green'  },
    RECHAZADO:   { label: 'Rechazado',    color: 'red'    },
    SUSPENDIDO:  { label: 'Suspendido',   color: 'zinc'   },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Legajos de proveedores</h1>
          <p className="text-zinc-500 text-sm">{proveedores?.length ?? 0} registros</p>
        </div>
      </div>

      {!proveedores?.length ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-16 text-center">
          <p className="text-zinc-500">No hay proveedores registrados todavía.</p>
          <Link href="/registro" target="_blank"
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Ir al portal de registro →
          </Link>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-zinc-500 text-xs font-medium px-6 py-4">Empresa</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">CUIT</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">Rubro</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">Tipo</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">Docs</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">Estado</th>
                <th className="text-left text-zinc-500 text-xs font-medium px-4 py-4">Fecha</th>
                <th className="px-4 py-4"/>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p, i) => {
                const cfg = estadoConfig[p.estado] ?? estadoConfig.PENDIENTE
                const docs = (p.documentos_legajo as any[]) ?? []
                const docsOk = docs.filter(d => d.estado === 'APROBADO').length
                const fecha = new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                return (
                  <tr key={p.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i === proveedores.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-6 py-4"><p className="text-sm font-medium">{p.razon_social}</p></td>
                    <td className="px-4 py-4 text-zinc-400 text-sm font-mono">{p.cuit}</td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{(p.rubros as any)?.nombre ?? '—'}</td>
                    <td className="px-4 py-4">
                      <span className="text-zinc-500 text-xs bg-white/[0.05] px-2 py-0.5 rounded">{p.tipo_proveedor}</span>
                    </td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{docsOk}/{docs.length}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${
                        cfg.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        cfg.color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        cfg.color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        cfg.color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      }`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-4 text-zinc-500 text-sm">{fecha}</td>
                    <td className="px-4 py-4">
                      <Link href={`/dashboard/legajos/${p.id}`}
                        className="text-blue-400 hover:text-blue-300 text-sm transition-colors">Ver →</Link>
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
