// ============================================================
// /app/superadmin/tenants/[id]/tabs/DatosTab.tsx
// Tab Datos del cliente — razón social, CUIT, contactos, importe
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tenant } from '../page'

export default function DatosTab({ tenant }: { tenant: Tenant }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state inicializado con los valores actuales
  const [form, setForm] = useState({
    razon_social:                tenant.razon_social ?? '',
    cuit:                        tenant.cuit ?? '',
    direccion:                   tenant.direccion ?? '',
    telefono:                    tenant.telefono ?? '',
    contacto_facturacion_nombre: tenant.contacto_facturacion_nombre ?? '',
    contacto_facturacion_email:  tenant.contacto_facturacion_email ?? '',
    contacto_tecnico_nombre:     tenant.contacto_tecnico_nombre ?? '',
    contacto_tecnico_email:      tenant.contacto_tecnico_email ?? '',
    importe_mensual:             tenant.importe_mensual !== null ? String(tenant.importe_mensual) : '',
    moneda:                      tenant.moneda ?? 'ARS',
    plan_hasta:                  tenant.plan_hasta ?? '',
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function guardar() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        if (v === '') payload[k] = null
        else if (k === 'importe_mensual') payload[k] = parseFloat(v)
        else payload[k] = v
      }
      const res = await fetch('/api/superadmin/tenant-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'update_datos', grupo_id: tenant.id, payload }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error')
      setSuccess(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400">
          ✓ Datos guardados correctamente
        </div>
      )}

      <Section titulo="Identidad fiscal">
        <Grid>
          <Field label="Razón social" value={form.razon_social} onChange={v => set('razon_social', v)} placeholder="ACME S.A." />
          <Field label="CUIT" value={form.cuit} onChange={v => set('cuit', v)} placeholder="30-12345678-9" />
          <Field label="Dirección" value={form.direccion} onChange={v => set('direccion', v)} placeholder="Av. Corrientes 1234, CABA" full />
          <Field label="Teléfono" value={form.telefono} onChange={v => set('telefono', v)} placeholder="+54 11 5555-5555" />
        </Grid>
      </Section>

      <Section titulo="Contacto de facturación">
        <Grid>
          <Field label="Nombre" value={form.contacto_facturacion_nombre} onChange={v => set('contacto_facturacion_nombre', v)} placeholder="Juan Pérez" />
          <Field label="Email" value={form.contacto_facturacion_email} onChange={v => set('contacto_facturacion_email', v)} placeholder="facturacion@cliente.com" type="email" />
        </Grid>
      </Section>

      <Section titulo="Contacto técnico">
        <Grid>
          <Field label="Nombre" value={form.contacto_tecnico_nombre} onChange={v => set('contacto_tecnico_nombre', v)} placeholder="María González" />
          <Field label="Email" value={form.contacto_tecnico_email} onChange={v => set('contacto_tecnico_email', v)} placeholder="it@cliente.com" type="email" />
        </Grid>
      </Section>

      <Section titulo="Facturación">
        <Grid>
          <Field label="Importe mensual" value={form.importe_mensual} onChange={v => set('importe_mensual', v.replace(/[^0-9.]/g, ''))} placeholder="50000" />
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Moneda</label>
            <select
              value={form.moneda} onChange={(e) => set('moneda', e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólares</option>
              <option value="EUR">EUR — Euros</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Vencimiento del plan</label>
            <input
              type="date" value={form.plan_hasta} onChange={(e) => set('plan_hasta', e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">Vacío = sin vencimiento (renovación mensual automática)</p>
          </div>
        </Grid>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={guardar}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition"
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{titulo}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

function Field({
  label, value, onChange, placeholder, type, full,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  full?: boolean
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
