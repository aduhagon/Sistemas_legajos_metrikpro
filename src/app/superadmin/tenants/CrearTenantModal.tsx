// ============================================================
// /app/superadmin/tenants/CrearTenantModal.tsx
// Modal compacto con todos los campos + pantalla de confirmación
// que muestra el password temporal generado.
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResultadoExitoso {
  ok: true
  tenant:   { id: string; nombre: string; slug: string; plan: string }
  admin:    { email: string; password_temporal: string; nombre: string }
  url_login: string
}

export default function CrearTenantModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoExitoso | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  // Form fields
  const [nombre, setNombre]            = useState('')
  const [slug, setSlug]                = useState('')
  const [plan, setPlan]                = useState<'basico' | 'pro' | 'enterprise'>('pro')
  const [adminNombre, setAdminNombre]  = useState('')
  const [adminEmail, setAdminEmail]    = useState('')

  function resetForm() {
    setNombre('')
    setSlug('')
    setPlan('pro')
    setAdminNombre('')
    setAdminEmail('')
    setError(null)
    setResultado(null)
  }

  function onClose() {
    if (resultado) {
      // Si se completó la creación, al cerrar refrescamos la lista
      router.refresh()
    }
    setOpen(false)
    // Esperar fin de animación antes de limpiar
    setTimeout(resetForm, 200)
  }

  // Auto-generar slug a partir del nombre (solo en primer cambio)
  function onNombreChange(v: string) {
    setNombre(v)
    if (!slug || slug === sluggify(nombre)) {
      setSlug(sluggify(v))
    }
  }

  function sluggify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
  }

  async function onSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/crear-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, slug, plan,
          admin_nombre: adminNombre,
          admin_email:  adminEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error desconocido')
      }
      setResultado(data as ResultadoExitoso)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function copiar(texto: string, key: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(key)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // ignore
    }
  }

  const formValido =
    nombre.trim().length >= 3 &&
    slug.length >= 3 &&
    /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug) &&
    adminNombre.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Crear tenant
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full p-6 my-8">
            {/* ─── Pantalla de éxito ────────────────────────────────── */}
            {resultado ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Tenant creado exitosamente</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      <strong className="text-white">{resultado.tenant.nombre}</strong> está listo. Compartile estos datos al cliente:
                    </p>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 mb-4">
                  <p className="text-xs text-amber-200">
                    ⚠️ Esta es la <strong>única vez</strong> que vas a ver el password temporal. Copialo ahora — una vez cerrado este modal no hay forma de recuperarlo (tendrías que generar uno nuevo).
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <CredencialCopiable
                    label="URL de login"
                    value={resultado.url_login}
                    copiado={copiado === 'url'}
                    onCopy={() => copiar(resultado.url_login, 'url')}
                  />
                  <CredencialCopiable
                    label="Email"
                    value={resultado.admin.email}
                    copiado={copiado === 'email'}
                    onCopy={() => copiar(resultado.admin.email, 'email')}
                  />
                  <CredencialCopiable
                    label="Password temporal"
                    value={resultado.admin.password_temporal}
                    copiado={copiado === 'pass'}
                    onCopy={() => copiar(resultado.admin.password_temporal, 'pass')}
                    destacado
                  />
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  El usuario va a ser obligado a cambiar la contraseña en su primer ingreso.
                </p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => copiar(
                      `URL: ${resultado.url_login}\nEmail: ${resultado.admin.email}\nPassword temporal: ${resultado.admin.password_temporal}`,
                      'todo'
                    )}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    {copiado === 'todo' ? '✓ Copiado todo' : 'Copiar todo'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded transition"
                  >
                    Entendido, cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ─── Formulario ─────────────────────────────────────── */}
                <h3 className="text-lg font-semibold text-white mb-1">Crear nuevo tenant</h3>
                <p className="text-sm text-gray-400 mb-5">
                  Esto crea el cliente con sus módulos iniciales y un usuario administrador.
                </p>

                {error && (
                  <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Datos del tenant */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => onNombreChange(e.target.value)}
                      placeholder="Empresa ACME S.A."
                      className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                      Slug (identificador único)
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="acme"
                      className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 font-mono focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Solo letras minúsculas, números y guiones. Usado en URLs internas.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                      Plan
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['basico', 'pro', 'enterprise'] as const).map(p => {
                        const info = {
                          basico:     { label: 'Básico',     descripcion: 'Solo Core (6)' },
                          pro:        { label: 'Pro',        descripcion: 'Core + Add-ons (13)' },
                          enterprise: { label: 'Enterprise', descripcion: 'Todos (16)' },
                        }[p]
                        const seleccionado = plan === p
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlan(p)}
                            className={`px-3 py-2 rounded border text-left transition ${
                              seleccionado
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <p className={`text-sm font-medium ${seleccionado ? 'text-white' : 'text-gray-300'}`}>{info.label}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{info.descripcion}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs font-medium text-gray-300 mb-3">Administrador inicial del cliente</p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                          Nombre completo
                        </label>
                        <input
                          type="text"
                          value={adminNombre}
                          onChange={(e) => setAdminNombre(e.target.value)}
                          placeholder="Juan Pérez"
                          className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@acme.com"
                          className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 mt-2">
                      Se genera un password temporal que vas a ver en la próxima pantalla.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-gray-300 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={!formValido || loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition"
                  >
                    {loading ? 'Creando...' : 'Crear tenant'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function CredencialCopiable({
  label, value, copiado, onCopy, destacado,
}: {
  label: string
  value: string
  copiado: boolean
  onCopy: () => void
  destacado?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <div className={`flex items-center gap-2 rounded border px-3 py-2 ${
        destacado
          ? 'bg-blue-500/5 border-blue-500/30'
          : 'bg-gray-950 border-gray-700'
      }`}>
        <code className={`flex-1 text-sm font-mono break-all ${destacado ? 'text-white text-base font-semibold tracking-wider' : 'text-gray-200'}`}>
          {value}
        </code>
        <button
          onClick={onCopy}
          className="text-xs text-blue-400 hover:text-blue-300 transition flex-shrink-0"
        >
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
