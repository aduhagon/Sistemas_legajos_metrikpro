import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server-admin'
import { redirect } from 'next/navigation'
import { getGrupoId } from '@/lib/grupo'
import IntegracionesClient from './IntegracionesClient'

export default async function IntegracionesPage() {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (usuario?.rol !== 'admin') redirect('/dashboard')

  const grupoId = await getGrupoId()

  // Cargar API keys (sin exponer el hash)
  const { data: apiKeys } = await supabaseAdmin
    .from('api_keys')
    .select('id, nombre, key_prefix, permisos, activa, ultimo_uso_at, expira_at, created_at')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  // Cargar webhooks (sin exponer el secret)
  const { data: webhooks } = await supabaseAdmin
    .from('webhooks_config')
    .select('id, nombre, url, eventos, activo, created_at')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })

  // Últimos 10 logs de webhook
  const { data: webhookLogs } = await supabaseAdmin
    .from('webhook_logs')
    .select('id, evento, intento, status_code, entregado, error_msg, created_at, webhook_id')
    .eq('grupo_id', grupoId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Integraciones ERP</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Gestioná las API keys y webhooks para conectar con Finnegans, SAP u otros sistemas.
        </p>
      </div>
      <IntegracionesClient
        grupoId={grupoId}
        apiKeys={apiKeys ?? []}
        webhooks={webhooks ?? []}
        webhookLogs={webhookLogs ?? []}
      />
    </div>
  )
}
