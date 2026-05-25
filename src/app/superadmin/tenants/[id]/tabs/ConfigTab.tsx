// ============================================================
// /app/superadmin/tenants/[id]/tabs/ConfigTab.tsx
// Tab Branding & SMTP — configuración visual + email del tenant
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConfigUI } from '../page'

export default function ConfigTab({ config, grupoId }: { config: ConfigUI | null; grupoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'branding' | 'smtp' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<'branding' | 'smtp' | null>(null)

  const [branding, setBranding] = useState({
    nombre_display:  config?.nombre_display ?? '',
    tagline:         config?.tagline ?? '',
    color_primario:  config?.color_primario ?? '#1E3A5F',
    color_acento:    config?.color_acento ?? '#2B5CE6',
    color_fondo:     config?.color_fondo ?? '#F2F0EB',
    tipografia:      config?.tipografia ?? 'Inter',
    logo_url:        config?.logo_url ?? '',
    fondo_login_url: config?.fondo_login_url ?? '',
  })

  const [smtp, setSmtp] = useState({
    smtp_host:             config?.smtp_host ?? 'smtp.gmail.com',
    smtp_port:             config?.smtp_port ? String(config.smtp_port) : '587',
    smtp_user:             config?.smtp_user ?? '',
    smtp_from_name:        config?.smtp_from_name ?? 'Sistema Legajos',
    smtp_from_email:       config?.smtp_from_email ?? '',
    notif_evaluador_email: config?.notif_evaluador_email ?? '',
  })

  async function guardar(seccion: 'branding' | 'smtp') {
    setLoading(seccion)
    setError(null)
    setSuccess(null)
    try {
      const accion = seccion === 'branding' ? 'update_branding' : 'update_smtp'
      const data = seccion === 'branding' ? branding : { ...smtp, smtp_port: smtp.smtp_port ? parseInt(smtp.smtp_port, 10) : null }
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) {
        payload[k] = v === '' ? null : v
      }
      const res = await fetch('/api/superadmin/tenant-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, grupo_id: grupoId, payload }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Error')
      setSuccess(seccion)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ─── Branding ───────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Branding visual</h3>
        <p className="text-xs text-gray-500 mb-4">
          Personalización de marca que verá el cliente en su portal y emails.
        </p>

        {success === 'branding' && (
          <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400">
            ✓ Branding guardado
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre a mostrar" value={branding.nombre_display} onChange={v => setBranding({ ...branding, nombre_display: v })} placeholder="ACME Legajos" />
          <Field label="Tagline" value={branding.tagline} onChange={v => setBranding({ ...branding, tagline: v })} placeholder="Sistema de gestión documental" />

          <ColorField label="Color primario" value={branding.color_primario} onChange={v => setBranding({ ...branding, color_primario: v })} />
          <ColorField label="Color acento" value={branding.color_acento} onChange={v => setBranding({ ...branding, color_acento: v })} />
          <ColorField label="Color fondo" value={branding.color_fondo} onChange={v => setBranding({ ...branding, color_fondo: v })} />

          <Field label="Tipografía" value={branding.tipografia} onChange={v => setBranding({ ...branding, tipografia: v })} placeholder="Inter, Roboto..." />

          <Field label="URL del logo" value={branding.logo_url} onChange={v => setBranding({ ...branding, logo_url: v })} placeholder="https://..." full />
          <Field label="URL imagen de fondo login" value={branding.fondo_login_url} onChange={v => setBranding({ ...branding, fondo_login_url: v })} placeholder="https://..." full />
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={() => guardar('branding')}
            disabled={loading === 'branding'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded transition"
          >
            {loading === 'branding' ? 'Guardando...' : 'Guardar branding'}
          </button>
        </div>
      </div>

      {/* ─── SMTP ───────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-1">SMTP del tenant</h3>
        <p className="text-xs text-gray-500 mb-4">
          Configuración del servidor de email del cliente. El password SMTP se gestiona desde el portal del cliente (no se edita acá por seguridad).
        </p>

        {success === 'smtp' && (
          <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400">
            ✓ SMTP guardado
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="SMTP Host" value={smtp.smtp_host} onChange={v => setSmtp({ ...smtp, smtp_host: v })} placeholder="smtp.gmail.com" />
          <Field label="SMTP Port" value={smtp.smtp_port} onChange={v => setSmtp({ ...smtp, smtp_port: v.replace(/[^0-9]/g, '') })} placeholder="587" />
          <Field label="SMTP User" value={smtp.smtp_user} onChange={v => setSmtp({ ...smtp, smtp_user: v })} placeholder="legajos@cliente.com" full />
          <Field label="Remitente — Nombre" value={smtp.smtp_from_name} onChange={v => setSmtp({ ...smtp, smtp_from_name: v })} placeholder="Sistema Legajos" />
          <Field label="Remitente — Email" value={smtp.smtp_from_email} onChange={v => setSmtp({ ...smtp, smtp_from_email: v })} placeholder="legajos@cliente.com" type="email" />
          <Field label="Email del evaluador (notificaciones)" value={smtp.notif_evaluador_email} onChange={v => setSmtp({ ...smtp, notif_evaluador_email: v })} placeholder="evaluador@cliente.com" type="email" full />
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={() => guardar('smtp')}
            disabled={loading === 'smtp'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded transition"
          >
            {loading === 'smtp' ? 'Guardando...' : 'Guardar SMTP'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type, full,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; full?: boolean
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}

function ColorField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 bg-gray-950 border border-gray-700 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 bg-gray-950 border border-gray-700 text-white text-sm font-mono rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  )
}
