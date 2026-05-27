'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Tipos ──────────────────────────────────────────────────────────────────
type ApiKey = {
  id: string
  nombre: string
  key_prefix: string
  permisos: string[]
  activa: boolean
  ultimo_uso_at: string | null
  expira_at: string | null
  created_at: string
}

type Webhook = {
  id: string
  nombre: string
  url: string
  eventos: string[]
  activo: boolean
  created_at: string
}

type WebhookLog = {
  id: string
  evento: string
  intento: number
  status_code: number | null
  entregado: boolean
  error_msg: string | null
  created_at: string
  webhook_id: string
}

type Props = {
  grupoId: string
  apiKeys: ApiKey[]
  webhooks: Webhook[]
  webhookLogs: WebhookLog[]
}

const PERMISOS_DISPONIBLES = [
  { value: 'read:proveedores',  label: 'Leer proveedores' },
  { value: 'write:proveedores', label: 'Crear/actualizar proveedores' },
  { value: 'read:documentos',   label: 'Leer documentos' },
  { value: 'read:accesos',      label: 'Leer registros de acceso' },
  { value: 'webhooks:config',   label: 'Configurar webhooks' },
]

const EVENTOS_DISPONIBLES = [
  { value: 'proveedor.aprobado',       label: 'Proveedor aprobado' },
  { value: 'proveedor.rechazado',      label: 'Proveedor rechazado' },
  { value: 'proveedor.suspendido',     label: 'Proveedor suspendido' },
  { value: 'documento.vencido',        label: 'Documento vencido' },
  { value: 'documento.proximo_vencer', label: 'Documento por vencer' },
  { value: 'ingreso.registrado',       label: 'Ingreso registrado' },
  { value: 'egreso.registrado',        label: 'Egreso registrado' },
]

export default function IntegracionesClient({ grupoId, apiKeys: initialKeys, webhooks: initialWebhooks, webhookLogs }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'keys' | 'webhooks' | 'logs'>('keys')

  // ── Estado API Keys ──────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState(initialKeys)
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKeyNombre, setNewKeyNombre] = useState('')
  const [newKeyPermisos, setNewKeyPermisos] = useState<string[]>(['read:proveedores', 'write:proveedores', 'read:documentos'])
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(false)

  // ── Estado Webhooks ──────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState(initialWebhooks)
  const [showNewWebhook, setShowNewWebhook] = useState(false)
  const [newWebNombre, setNewWebNombre] = useState('')
  const [newWebUrl, setNewWebUrl] = useState('')
  const [newWebEventos, setNewWebEventos] = useState<string[]>(['proveedor.aprobado', 'proveedor.rechazado', 'proveedor.suspendido'])
  const [loadingWeb, setLoadingWeb] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Crear API Key ────────────────────────────────────────────────────────
  async function crearApiKey() {
    if (!newKeyNombre.trim() || newKeyPermisos.length === 0) return
    setLoadingKey(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/integraciones/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newKeyNombre, permisos: newKeyPermisos }),
      })
      const json = await res.json() as { ok: boolean; key?: string; error?: string }
      if (!json.ok) { setErrorMsg(json.error ?? 'Error al crear la key'); return }
      setNewKeyResult(json.key ?? null)
      setNewKeyNombre('')
      router.refresh()
    } finally {
      setLoadingKey(false)
    }
  }

  // ── Revocar API Key ──────────────────────────────────────────────────────
  async function revocarKey(id: string) {
    if (!confirm('¿Revocar esta API key? Los sistemas que la usen dejarán de funcionar.')) return
    const res = await fetch('/api/admin/integraciones/api-keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activa: false }),
    })
    const json = await res.json() as { ok: boolean }
    if (json.ok) {
      setApiKeys(prev => prev.map(k => k.id === id ? { ...k, activa: false } : k))
    }
  }

  // ── Crear Webhook ────────────────────────────────────────────────────────
  async function crearWebhook() {
    if (!newWebNombre.trim() || !newWebUrl.trim() || newWebEventos.length === 0) return
    setLoadingWeb(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/integraciones/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newWebNombre, url: newWebUrl, eventos: newWebEventos }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!json.ok) { setErrorMsg(json.error ?? 'Error al crear el webhook'); return }
      setShowNewWebhook(false)
      setNewWebNombre('')
      setNewWebUrl('')
      router.refresh()
    } finally {
      setLoadingWeb(false)
    }
  }

  // ── Toggle Webhook activo ────────────────────────────────────────────────
  async function toggleWebhook(id: string, activo: boolean) {
    const res = await fetch('/api/admin/integraciones/webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !activo }),
    })
    const json = await res.json() as { ok: boolean }
    if (json.ok) {
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, activo: !activo } : w))
    }
  }

  // ── Eliminar Webhook ─────────────────────────────────────────────────────
  async function eliminarWebhook(id: string) {
    if (!confirm('¿Eliminar este webhook?')) return
    const res = await fetch('/api/admin/integraciones/webhooks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json() as { ok: boolean }
    if (json.ok) {
      setWebhooks(prev => prev.filter(w => w.id !== id))
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {[
          { id: 'keys', label: '🔑 API Keys' },
          { id: 'webhooks', label: '🔔 Webhooks' },
          { id: 'logs', label: '📋 Logs' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              tab === t.id
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {/* ── TAB: API KEYS ── */}
      {tab === 'keys' && (
        <div className="space-y-4">
          {/* Key recién creada — mostrar UNA SOLA VEZ */}
          {newKeyResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-400 text-sm font-medium mb-2">✓ API Key creada — copiala ahora, no se mostrará de nuevo</p>
              <div className="flex items-center gap-3 bg-black/30 rounded-lg px-4 py-3">
                <code className="text-green-300 text-sm flex-1 break-all">{newKeyResult}</code>
                <button onClick={() => { navigator.clipboard.writeText(newKeyResult); }}
                  className="text-zinc-400 hover:text-white text-xs shrink-0 bg-white/[0.05] px-3 py-1.5 rounded-lg transition-colors">
                  Copiar
                </button>
              </div>
              <button onClick={() => setNewKeyResult(null)} className="text-zinc-500 text-xs mt-2 hover:text-zinc-300">
                Entendido, ya la copié
              </button>
            </div>
          )}

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">API Keys</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Autenticación para sistemas externos que consumen la API</p>
              </div>
              <button onClick={() => { setShowNewKey(true); setNewKeyResult(null) }}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1.5 rounded-lg transition-all">
                + Nueva key
              </button>
            </div>

            {/* Formulario nueva key */}
            {showNewKey && (
              <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm font-medium mb-3">Nueva API Key</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Nombre (ej: "Finnegans Producción")</label>
                    <input value={newKeyNombre} onChange={e => setNewKeyNombre(e.target.value)}
                      placeholder="Finnegans Producción"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"/>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-2 block">Permisos</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PERMISOS_DISPONIBLES.map(p => (
                        <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newKeyPermisos.includes(p.value)}
                            onChange={e => setNewKeyPermisos(prev =>
                              e.target.checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                            )}
                            className="accent-blue-500"/>
                          <span className="text-zinc-400 text-xs">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={crearApiKey} disabled={loadingKey || !newKeyNombre.trim()}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-40">
                      {loadingKey ? 'Creando...' : 'Crear key'}
                    </button>
                    <button onClick={() => { setShowNewKey(false); setNewKeyNombre('') }}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-3 py-2 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de keys */}
            {apiKeys.length === 0 && !showNewKey ? (
              <div className="px-6 py-8 text-center">
                <p className="text-zinc-600 text-sm">No hay API keys configuradas</p>
                <p className="text-zinc-700 text-xs mt-1">Creá una key para que Finnegans pueda conectarse</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {apiKeys.map(key => (
                  <div key={key.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-white">{key.nombre}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          key.activa
                            ? 'text-green-400 border-green-500/20 bg-green-500/10'
                            : 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10'
                        }`}>
                          {key.activa ? 'Activa' : 'Revocada'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <code className="text-zinc-500 text-xs">{key.key_prefix}</code>
                        <span className="text-zinc-700 text-xs">
                          Creada: {new Date(key.created_at).toLocaleDateString('es-AR')}
                        </span>
                        {key.ultimo_uso_at && (
                          <span className="text-zinc-600 text-xs">
                            Último uso: {new Date(key.ultimo_uso_at).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.permisos.map(p => (
                          <span key={p} className="text-xs bg-white/[0.04] border border-white/[0.06] text-zinc-500 px-2 py-0.5 rounded-full">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    {key.activa && (
                      <button onClick={() => revocarKey(key.id)}
                        className="text-zinc-600 hover:text-red-400 text-xs transition-colors shrink-0">
                        Revocar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: WEBHOOKS ── */}
      {tab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Webhooks</h2>
                <p className="text-zinc-500 text-xs mt-0.5">El sistema notifica a estos endpoints cuando ocurren eventos</p>
              </div>
              <button onClick={() => setShowNewWebhook(true)}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-3 py-1.5 rounded-lg transition-all">
                + Nuevo webhook
              </button>
            </div>

            {/* Formulario nuevo webhook */}
            {showNewWebhook && (
              <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm font-medium mb-3">Nuevo Webhook</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Nombre</label>
                    <input value={newWebNombre} onChange={e => setNewWebNombre(e.target.value)}
                      placeholder="Finnegans Producción"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"/>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">URL del endpoint</label>
                    <input value={newWebUrl} onChange={e => setNewWebUrl(e.target.value)}
                      placeholder="https://api.finnegans.com/webhooks/legajos"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"/>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-2 block">Eventos a notificar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {EVENTOS_DISPONIBLES.map(e => (
                        <label key={e.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newWebEventos.includes(e.value)}
                            onChange={ev => setNewWebEventos(prev =>
                              ev.target.checked ? [...prev, e.value] : prev.filter(x => x !== e.value)
                            )}
                            className="accent-blue-500"/>
                          <span className="text-zinc-400 text-xs">{e.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={crearWebhook} disabled={loadingWeb || !newWebNombre.trim() || !newWebUrl.trim()}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-40">
                      {loadingWeb ? 'Creando...' : 'Crear webhook'}
                    </button>
                    <button onClick={() => setShowNewWebhook(false)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-3 py-2 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista webhooks */}
            {webhooks.length === 0 && !showNewWebhook ? (
              <div className="px-6 py-8 text-center">
                <p className="text-zinc-600 text-sm">No hay webhooks configurados</p>
                <p className="text-zinc-700 text-xs mt-1">Configurá un endpoint para recibir notificaciones de eventos</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {webhooks.map(wh => (
                  <div key={wh.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white">{wh.nombre}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            wh.activo
                              ? 'text-green-400 border-green-500/20 bg-green-500/10'
                              : 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10'
                          }`}>
                            {wh.activo ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs font-mono mb-2 truncate">{wh.url}</p>
                        <div className="flex flex-wrap gap-1">
                          {wh.eventos.map(ev => {
                            const label = EVENTOS_DISPONIBLES.find(e => e.value === ev)?.label ?? ev
                            return (
                              <span key={ev} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => toggleWebhook(wh.id, wh.activo)}
                          className={`text-xs transition-colors ${
                            wh.activo
                              ? 'text-zinc-500 hover:text-yellow-400'
                              : 'text-zinc-500 hover:text-green-400'
                          }`}>
                          {wh.activo ? 'Pausar' : 'Activar'}
                        </button>
                        <button onClick={() => eliminarWebhook(wh.id)}
                          className="text-zinc-600 hover:text-red-400 text-xs transition-colors">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: LOGS ── */}
      {tab === 'logs' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium">Últimos logs de webhooks</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Historial de entregas — últimas 10</p>
          </div>
          {webhookLogs.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-zinc-600 text-sm">Sin logs todavía</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {webhookLogs.map(log => (
                <div key={log.id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${log.entregado ? 'bg-green-400' : 'bg-red-400'}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-300">{log.evento}</span>
                      {log.status_code && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          log.status_code < 300
                            ? 'text-green-400 bg-green-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}>
                          HTTP {log.status_code}
                        </span>
                      )}
                      <span className="text-zinc-600 text-xs">intento {log.intento}</span>
                    </div>
                    {log.error_msg && (
                      <p className="text-red-400 text-xs mt-0.5 truncate">{log.error_msg}</p>
                    )}
                  </div>
                  <span className="text-zinc-600 text-xs shrink-0">
                    {new Date(log.created_at).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                    })}
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
