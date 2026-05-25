// ============================================================
// /app/superadmin/tenants/[id]/tabs/AdminsTab.tsx
// Tab Admins — listado, invitar, quitar, resetear password
// ============================================================
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminUser } from '../page'

interface CredencialResultado {
  password_temporal: string
  email: string
  nombre: string
  origen: 'invitar' | 'reset'
}

export default function AdminsTab({ admins, grupoId }: { admins: AdminUser[]; grupoId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<CredencialResultado | null>(null)
  const [confirmar, setConfirmar] = useState<{ accion: string; mensaje: string; payload: Record<string, unknown> } | null>(null)
  const [invitarOpen, setInvitarOpen] = useState(false)
  const [invitarNombre, setInvitarNombre] = useState('')
  const [invitarEmail, setInvitarEmail] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)

  async function ejecutar(accion: string, payload: Record<string, unknown>): Promise<unknown> {
    setLoading(accion)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/tenant-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, grupo_id: grupoId, payload }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error')
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      throw e
    } finally {
      setLoading(null)
      setConfirmar(null)
    }
  }

  async function resetPassword(admin: AdminUser) {
    try {
      const data = await ejecutar('reset_password_admin', { user_id: admin.id }) as { password_temporal: string; email: string; nombre: string }
      setCredencial({
        password_temporal: data.password_temporal,
        email:             data.email,
        nombre:            data.nombre,
        origen:            'reset',
      })
    } catch { /* error mostrado arriba */ }
  }

  async function invitarAdmin() {
    if (!invitarNombre.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitarEmail)) {
      setError('Nombre y email válidos requeridos')
      return
    }
    try {
      const data = await ejecutar('invitar_admin', {
        nombre: invitarNombre.trim(),
        email:  invitarEmail.trim().toLowerCase(),
      }) as { password_temporal: string; email: string; nombre: string }
      setCredencial({
        password_temporal: data.password_temporal,
        email:             data.email,
        nombre:            data.nombre,
        origen:            'invitar',
      })
      setInvitarOpen(false)
      setInvitarNombre('')
      setInvitarEmail('')
      router.refresh()
    } catch { /* error mostrado */ }
  }

  async function quitarAdmin(admin: AdminUser) {
    try {
      await ejecutar('quitar_admin', { user_id: admin.id })
      router.refresh()
    } catch { /* error mostrado */ }
  }

  async function copiar(texto: string, key: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(key)
      setTimeout(() => setCopiado(null), 2000)
    } catch { /* ignore */ }
  }

  const activos = admins.filter(a => a.activo)
  const inactivos = admins.filter(a => !a.activo)

  return (
    <div>
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Administradores del tenant</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {activos.length} activo{activos.length !== 1 ? 's' : ''}
            {inactivos.length > 0 && ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setInvitarOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition"
        >
          + Invitar admin
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Nombre</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Desde</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {[...activos, ...inactivos].map(a => (
              <tr key={a.id} className={`border-b border-gray-800 ${!a.activo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-sm text-white">{a.nombre}</td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono">{a.email}</td>
                <td className="px-4 py-3">
                  {a.activo ? (
                    a.primer_login ? (
                      <span className="text-xs text-amber-400">Esperando primer login</span>
                    ) : (
                      <span className="text-xs text-emerald-400">Activo</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-500">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {a.activo && (
                    <>
                      <button
                        onClick={() => setConfirmar({
                          accion:  'reset_password_admin',
                          mensaje: `¿Resetear el password de "${a.nombre}"? Vas a recibir un password temporal para entregarle al cliente. El password anterior queda inválido.`,
                          payload: { user_id: a.id, _action: 'reset' },
                        })}
                        disabled={loading !== null}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Resetear password
                      </button>
                      {activos.length > 1 && (
                        <button
                          onClick={() => setConfirmar({
                            accion:  'quitar_admin',
                            mensaje: `¿Quitar a "${a.nombre}" como admin del tenant? Su cuenta queda desactivada (no se borra, podés reactivarla con SQL).`,
                            payload: { user_id: a.id, _action: 'quitar' },
                          })}
                          disabled={loading !== null}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          Quitar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  No hay administradores. Clickeá "Invitar admin" para agregar uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal invitar */}
      {invitarOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Invitar nuevo admin</h3>
            <p className="text-sm text-gray-400 mb-5">
              Se crea un usuario con rol admin del tenant. Vas a recibir un password temporal para entregarle al cliente.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Nombre completo</label>
                <input
                  type="text" value={invitarNombre} onChange={(e) => setInvitarNombre(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email" value={invitarEmail} onChange={(e) => setInvitarEmail(e.target.value)}
                  placeholder="admin@cliente.com"
                  className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setInvitarOpen(false); setInvitarNombre(''); setInvitarEmail('') }} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={invitarAdmin}
                disabled={loading === 'invitar_admin'}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition disabled:opacity-50"
              >
                {loading === 'invitar_admin' ? 'Creando...' : 'Invitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación reset/quitar */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-white mb-2">Confirmar acción</h3>
            <p className="text-sm text-gray-300 mb-5">{confirmar.mensaje}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmar(null)} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmar.accion === 'reset_password_admin') {
                    const admin = admins.find(a => a.id === confirmar.payload.user_id)
                    if (admin) resetPassword(admin)
                  } else if (confirmar.accion === 'quitar_admin') {
                    const admin = admins.find(a => a.id === confirmar.payload.user_id)
                    if (admin) quitarAdmin(admin)
                  }
                }}
                disabled={loading !== null}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal con password temporal */}
      {credencial && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {credencial.origen === 'invitar' ? 'Admin creado' : 'Password reseteado'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">Compartile estos datos al cliente:</p>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 mb-4">
              <p className="text-xs text-amber-200">
                ⚠️ Esta es la única vez que vas a ver el password. Copialo ahora.
              </p>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Email</p>
                <div className="flex items-center gap-2 rounded border bg-gray-950 border-gray-700 px-3 py-2">
                  <code className="flex-1 text-sm font-mono text-gray-200 break-all">{credencial.email}</code>
                  <button onClick={() => copiar(credencial.email, 'email')} className="text-xs text-blue-400 hover:text-blue-300">
                    {copiado === 'email' ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Password temporal</p>
                <div className="flex items-center gap-2 rounded border bg-blue-500/5 border-blue-500/30 px-3 py-2">
                  <code className="flex-1 text-base font-mono text-white font-semibold tracking-wider break-all">
                    {credencial.password_temporal}
                  </code>
                  <button onClick={() => copiar(credencial.password_temporal, 'pass')} className="text-xs text-blue-400 hover:text-blue-300">
                    {copiado === 'pass' ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              El usuario va a tener que cambiarlo en su primer ingreso.
            </p>
            <div className="flex items-center justify-end">
              <button
                onClick={() => setCredencial(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded transition"
              >
                Entendido, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
