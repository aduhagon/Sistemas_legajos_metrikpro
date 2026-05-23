'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  created_at: string
}

// Mapeo de roles internos → nombres amigables
const ROL_LABEL: Record<string, string> = {
  admin:            'Administrador',
  evaluador:        'Supervisor',
  operario:         'Operario',
  operador_acceso:  'Portero',
  auditor:          'Auditor',
}

const ROL_DESC: Record<string, string> = {
  admin:           'Configuración, usuarios, legajos y reportes',
  evaluador:       'Legajos, aprobación y reportes',
  operario:        'Revisión y aprobación de documentos',
  operador_acceso: 'Solo escaneo QR en punto de acceso',
  auditor:         'Auditorías en campo con soporte offline',
}

const ROL_COLOR: Record<string, string> = {
  admin:           'bg-purple-500/10 text-purple-400 border-purple-500/20',
  evaluador:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  operario:        'bg-teal-500/10 text-teal-400 border-teal-500/20',
  operador_acceso: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  auditor:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const ROLES = ['admin', 'evaluador', 'operario', 'operador_acceso', 'auditor']

const emptyForm = { nombre: '', email: '', rol: 'evaluador' }

export default function UsuariosAdmin({
  usuarios: usuariosInit,
  grupoId,
  miId,
}: {
  usuarios: Usuario[]
  grupoId: string
  miId: string
}) {
  const [usuarios, setUsuarios] = useState(usuariosInit)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [editandoRol, setEditandoRol] = useState<string | null>(null)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setExito('')

    const { data, error: rpcErr } = await supabase.rpc('invitar_usuario_interno', {
      p_grupo_id: grupoId,
      p_email:    form.email,
      p_nombre:   form.nombre,
      p_rol:      form.rol,
    })

    if (rpcErr || data?.ok === false) {
      setError(data?.error ?? rpcErr?.message ?? 'Error al crear el usuario')
      setLoading(false)
      return
    }

    // Enviar email de recuperación para que defina su contraseña
    await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    setUsuarios(prev => [...prev, {
      id:         data.user_id,
      nombre:     form.nombre,
      email:      form.email,
      rol:        form.rol,
      activo:     true,
      created_at: new Date().toISOString(),
    }])

    setExito(`Usuario creado. Se envió un email a ${form.email} para que defina su contraseña.`)
    setForm(emptyForm)
    setCreando(false)
    setLoading(false)
  }

  async function toggleActivo(usuario: Usuario) {
    if (usuario.id === miId) return // no puede desactivarse a sí mismo
    setLoading(true)
    const { data } = await supabase.rpc('actualizar_usuario_interno', {
      p_user_id: usuario.id,
      p_activo:  !usuario.activo,
    })
    if (data?.ok) {
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, activo: !u.activo } : u))
    }
    setLoading(false)
  }

  async function cambiarRol(usuario: Usuario, nuevoRol: string) {
    if (usuario.id === miId) return // no puede cambiar su propio rol
    setLoading(true)
    const { data } = await supabase.rpc('actualizar_usuario_interno', {
      p_user_id: usuario.id,
      p_rol:     nuevoRol,
    })
    if (data?.ok) {
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, rol: nuevoRol } : u))
    }
    setEditandoRol(null)
    setLoading(false)
  }

  async function reenviarInvitacion(email: string) {
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setExito(`Email de configuración reenviado a ${email}`)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* Botón invitar */}
      {!creando && (
        <button onClick={() => { setCreando(true); setError(''); setExito('') }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Invitar usuario
        </button>
      )}

      {/* Feedback */}
      {exito && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm">✓ {exito}</p>
        </div>
      )}

      {/* Form invitar */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-6">
          <h3 className="text-sm font-medium mb-4">Nuevo usuario interno</h3>
          <form onSubmit={invitar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Nombre completo *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required placeholder="Juan García" className={inputCls}/>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required placeholder="juan@empresa.com" className={inputCls}/>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs mb-2">Perfil *</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(rol => (
                  <label key={rol} onClick={() => setForm(f => ({ ...f, rol }))}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.rol === rol
                        ? 'border-blue-500/40 bg-blue-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      form.rol === rol ? 'border-blue-400' : 'border-zinc-600'
                    }`}>
                      {form.rol === rol && <div className="w-2 h-2 rounded-full bg-blue-400"/>}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{ROL_LABEL[rol]}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{ROL_DESC[rol]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-xs">
                Se enviará un email al usuario para que configure su contraseña de acceso al sistema.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading || !form.nombre || !form.email}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
                {loading ? 'Creando...' : 'Crear y enviar invitación'}
              </button>
              <button type="button" onClick={() => { setCreando(false); setForm(emptyForm); setError('') }}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-medium">Usuarios activos</h3>
          <p className="text-zinc-500 text-xs mt-0.5">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} en el sistema</p>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {usuarios.map(u => {
            const esMiCuenta = u.id === miId
            return (
              <div key={u.id} className={`px-6 py-4 flex items-center gap-4 ${!u.activo ? 'opacity-50' : ''}`}>

                {/* Avatar inicial */}
                <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <span className="text-zinc-300 text-sm font-medium">
                    {u.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{u.nombre}</span>
                    {esMiCuenta && (
                      <span className="text-zinc-600 text-xs">(vos)</span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">{u.email}</p>
                </div>

                {/* Rol — editable */}
                <div className="shrink-0">
                  {editandoRol === u.id && !esMiCuenta ? (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={u.rol}
                        onChange={e => cambiarRol(u, e.target.value)}
                        className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-2 py-1 text-white text-xs focus:outline-none">
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROL_LABEL[r]}</option>
                        ))}
                      </select>
                      <button onClick={() => setEditandoRol(null)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !esMiCuenta && setEditandoRol(u.id)}
                      disabled={esMiCuenta}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${ROL_COLOR[u.rol] ?? ROL_COLOR.operario} ${
                        !esMiCuenta ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                      }`}
                      title={esMiCuenta ? 'No podés cambiar tu propio rol' : 'Clic para cambiar rol'}>
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </button>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Reenviar invitación */}
                  <button
                    onClick={() => reenviarInvitacion(u.email)}
                    disabled={loading}
                    title="Reenviar email de acceso"
                    className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </button>

                  {/* Activar/desactivar */}
                  {!esMiCuenta && (
                    <button
                      onClick={() => toggleActivo(u)}
                      disabled={loading}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        u.activo
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                          : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                      }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda de perfiles */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-zinc-500 text-xs font-medium mb-3 uppercase tracking-wide">Perfiles disponibles</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(rol => (
            <div key={rol} className="flex items-start gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${ROL_COLOR[rol]}`}>
                {ROL_LABEL[rol]}
              </span>
              <p className="text-zinc-600 text-xs">{ROL_DESC[rol]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
