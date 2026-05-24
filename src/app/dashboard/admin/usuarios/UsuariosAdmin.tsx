// src/app/dashboard/admin/usuarios/UsuariosAdmin.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  supervisor_scope: 'todos' | 'asignados' | null
  created_at: string
}

type Establecimiento = {
  id: string
  nombre: string
  tipos_establecimiento?: { icono?: string } | null
}

const ROL_LABEL: Record<string, string> = {
  admin:           'Administrador',
  evaluador:       'Supervisor',
  operario:        'Operario',
  operador_acceso: 'Portero',
  auditor:         'Auditor',
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

// Roles que pueden tener scope de establecimientos
const ROLES_CON_SCOPE = ['evaluador', 'auditor']

const emptyForm = { nombre: '', email: '', rol: 'evaluador', supervisor_scope: 'todos' as 'todos' | 'asignados' }

export default function UsuariosAdmin({
  usuarios: usuariosInit,
  grupoId,
  miId,
}: {
  usuarios: Usuario[]
  grupoId: string
  miId: string
}) {
  const [usuarios, setUsuarios]           = useState(usuariosInit)
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])
  const [creando, setCreando]             = useState(false)
  const [editandoId, setEditandoId]       = useState<string | null>(null)
  const [form, setForm]                   = useState(emptyForm)
  const [estabsSeleccionados, setEstabsSeleccionados] = useState<string[]>([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [exito, setExito]                 = useState('')
  const [editandoRol, setEditandoRol]     = useState<string | null>(null)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  useEffect(() => {
    supabase
      .from('establecimientos')
      .select('id, nombre, tipos_establecimiento(icono)')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => { if (data) setEstablecimientos(data as Establecimiento[]) })
  }, [])

  async function cargarEstabsUsuario(userId: string) {
    const { data } = await supabase
      .from('usuario_establecimientos')
      .select('establecimiento_id')
      .eq('usuario_id', userId)
    setEstabsSeleccionados((data ?? []).map((r: any) => r.establecimiento_id))
  }

  function abrirEditar(u: Usuario) {
    setEditandoId(u.id)
    setForm({
      nombre:           u.nombre,
      email:            u.email,
      rol:              u.rol,
      supervisor_scope: u.supervisor_scope ?? 'todos',
    })
    cargarEstabsUsuario(u.id)
    setCreando(false)
    setError('')
  }

  function cancelar() {
    setCreando(false)
    setEditandoId(null)
    setForm(emptyForm)
    setEstabsSeleccionados([])
    setError('')
  }

  function toggleEstab(id: string) {
    setEstabsSeleccionados(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const necesitaScope  = ROLES_CON_SCOPE.includes(form.rol)
  const necesitaEstabs = necesitaScope && form.supervisor_scope === 'asignados'

  async function syncEstablecimientos(userId: string) {
    await supabase.from('usuario_establecimientos').delete().eq('usuario_id', userId)
    if (necesitaEstabs && estabsSeleccionados.length > 0) {
      await supabase.from('usuario_establecimientos').insert(
        estabsSeleccionados.map(eid => ({
          usuario_id:         userId,
          establecimiento_id: eid,
          grupo_id:           grupoId,
        }))
      )
    }
  }

  // ── Invitar usuario nuevo ────────────────────────────────────────────────
  async function invitar() {
    setLoading(true)
    setError('')
    setExito('')

    if (necesitaEstabs && estabsSeleccionados.length === 0) {
      setError('Seleccioná al menos un establecimiento para este rol')
      setLoading(false)
      return
    }

    const scopeValue = necesitaScope ? form.supervisor_scope : null

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

    // Actualizar supervisor_scope
    if (scopeValue !== null) {
      await supabase.from('usuarios').update({ supervisor_scope: scopeValue }).eq('id', data.user_id)
    }

    // Enviar email de recuperación
    await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    // Sincronizar establecimientos
    await syncEstablecimientos(data.user_id)

    setUsuarios(prev => [...prev, {
      id:               data.user_id,
      nombre:           form.nombre,
      email:            form.email,
      rol:              form.rol,
      activo:           true,
      supervisor_scope: scopeValue,
      created_at:       new Date().toISOString(),
    }])

    setExito(`Usuario creado. Se envió un email a ${form.email} para que defina su contraseña.`)
    setForm(emptyForm)
    setEstabsSeleccionados([])
    setCreando(false)
    setLoading(false)
  }

  // ── Guardar edición ──────────────────────────────────────────────────────
  async function guardarEdicion() {
    if (!editandoId) return
    setLoading(true)
    setError('')

    if (necesitaEstabs && estabsSeleccionados.length === 0) {
      setError('Seleccioná al menos un establecimiento')
      setLoading(false)
      return
    }

    const scopeValue = necesitaScope ? form.supervisor_scope : null

    const { data } = await supabase.rpc('actualizar_usuario_interno', {
      p_user_id: editandoId,
      p_rol:     form.rol,
      p_nombre:  form.nombre,
    })

    if (data?.ok === false) {
      setError(data?.error ?? 'Error al actualizar')
      setLoading(false)
      return
    }

    // Actualizar scope
    await supabase.from('usuarios').update({ supervisor_scope: scopeValue }).eq('id', editandoId)

    // Sincronizar establecimientos
    await syncEstablecimientos(editandoId)

    setUsuarios(prev => prev.map(u =>
      u.id === editandoId
        ? { ...u, nombre: form.nombre, rol: form.rol, supervisor_scope: scopeValue }
        : u
    ))

    setExito('Usuario actualizado correctamente')
    cancelar()
    setLoading(false)
    setTimeout(() => setExito(''), 3000)
  }

  async function toggleActivo(u: Usuario) {
    if (u.id === miId) return
    setLoading(true)
    const { data } = await supabase.rpc('actualizar_usuario_interno', {
      p_user_id: u.id,
      p_activo:  !u.activo,
    })
    if (data?.ok) {
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !u.activo } : x))
    }
    setLoading(false)
  }

  async function cambiarRol(u: Usuario, nuevoRol: string) {
    if (u.id === miId) return
    setLoading(true)
    const { data } = await supabase.rpc('actualizar_usuario_interno', {
      p_user_id: u.id,
      p_rol:     nuevoRol,
    })
    if (data?.ok) {
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, rol: nuevoRol } : x))
    }
    setEditandoRol(null)
    setLoading(false)
  }

  async function reenviarInvitacion(email: string) {
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setExito(`Email reenviado a ${email}`)
    setTimeout(() => setExito(''), 3000)
    setLoading(false)
  }

  // ── Formulario compartido (crear + editar) ───────────────────────────────
  function FormUsuario({ onSubmit, modo }: { onSubmit: () => void; modo: 'nuevo' | 'editar' }) {
    return (
      <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-6">
        <h3 className="text-sm font-medium mb-4">
          {modo === 'nuevo' ? 'Nuevo usuario interno' : `Editar — ${form.nombre}`}
        </h3>
        <form onSubmit={e => { e.preventDefault(); onSubmit() }} className="space-y-5">


          {/* Nombre + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Nombre completo *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                required placeholder="Juan García" className={inputCls}/>
            </div>
            {modo === 'nuevo' ? (
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Email *</label>
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required placeholder="juan@empresa.com" className={inputCls}/>
              </div>
            ) : (
              <div>
                <label className="block text-zinc-400 text-xs mb-1.5">Email</label>
                <p className="text-zinc-400 text-sm py-2">{form.email}</p>
              </div>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-zinc-400 text-xs mb-2">Perfil *</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(rol => (
                <label key={rol} onClick={() => setForm(f => ({ ...f, rol, supervisor_scope: 'todos' }))}
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

          {/* Scope de establecimientos — solo para evaluador/auditor */}
          {necesitaScope && (
            <div>
              <label className="block text-zinc-400 text-xs mb-2">Alcance de establecimientos</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, supervisor_scope: 'todos' }))}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    form.supervisor_scope === 'todos'
                      ? 'border-emerald-500/50 bg-emerald-500/8'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}>
                  <p className="text-white text-sm font-medium">🌐 Todos</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Ve todos los establecimientos</p>
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, supervisor_scope: 'asignados' }))}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    form.supervisor_scope === 'asignados'
                      ? 'border-amber-500/50 bg-amber-500/8'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}>
                  <p className="text-white text-sm font-medium">📍 Asignados</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Solo los que se indiquen abajo</p>
                </button>
              </div>

              {/* Multi-select establecimientos */}
              {necesitaEstabs && (
                <div>
                  <p className="text-zinc-400 text-xs mb-2">
                    Establecimientos habilitados
                    <span className="text-zinc-600 ml-1">({estabsSeleccionados.length} seleccionados)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {establecimientos.map(e => {
                      const sel = estabsSeleccionados.includes(e.id)
                      return (
                        <button key={e.id} type="button" onClick={() => toggleEstab(e.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                            sel
                              ? 'border-blue-500/40 bg-blue-500/8'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                          }`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                            sel ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                          }`}>
                            {sel && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20,6 9,17 4,12"/>
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm truncate ${sel ? 'text-white' : 'text-zinc-300'}`}>
                            {(e.tipos_establecimiento as any)?.icono} {e.nombre}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info email */}
          {modo === 'nuevo' && (
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-xs">
                Se enviará un email al usuario para que configure su contraseña de acceso.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || !form.nombre || (modo === 'nuevo' && !form.email)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              {loading
                ? 'Guardando...'
                : modo === 'nuevo'
                  ? 'Crear y enviar invitación'
                  : 'Guardar cambios'}
            </button>
            <button type="button" onClick={cancelar}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* Botón invitar */}
      {!creando && !editandoId && (
        <button onClick={() => { setCreando(true); setError(''); setExito('') }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
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

      {/* Form crear */}
      {creando && <FormUsuario onSubmit={invitar} modo="nuevo"/>}

      {/* Form editar */}
      {editandoId && <FormUsuario onSubmit={guardarEdicion} modo="editar"/>}

      {/* Lista de usuarios */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-medium">Usuarios del sistema</h3>
          <p className="text-zinc-500 text-xs mt-0.5">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {usuarios.map(u => {
            const esMiCuenta = u.id === miId
            return (
              <div key={u.id} className={`px-6 py-4 flex items-center gap-4 ${!u.activo ? 'opacity-50' : ''}`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <span className="text-zinc-300 text-sm font-medium">
                    {u.nombre.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{u.nombre}</span>
                    {esMiCuenta && <span className="text-zinc-600 text-xs">(vos)</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-zinc-500 text-xs">{u.email}</p>
                    {/* Badge scope */}
                    {ROLES_CON_SCOPE.includes(u.rol) && u.supervisor_scope === 'asignados' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                        📍 establecimientos asignados
                      </span>
                    )}
                    {ROLES_CON_SCOPE.includes(u.rol) && (u.supervisor_scope === 'todos' || !u.supervisor_scope) && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        🌐 todos los establecimientos
                      </span>
                    )}
                  </div>
                </div>

                {/* Rol — editable inline */}
                <div className="shrink-0">
                  {editandoRol === u.id && !esMiCuenta ? (
                    <div className="flex items-center gap-2">
                      <select defaultValue={u.rol}
                        onChange={e => cambiarRol(u, e.target.value)}
                        className="bg-[#1a1d27] border border-white/[0.1] rounded-lg px-2 py-1 text-white text-xs focus:outline-none">
                        {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                      </select>
                      <button onClick={() => setEditandoRol(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !esMiCuenta && setEditandoRol(u.id)}
                      disabled={esMiCuenta}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${ROL_COLOR[u.rol] ?? ROL_COLOR.operario} ${
                        !esMiCuenta ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                      }`}
                      title={esMiCuenta ? undefined : 'Clic para cambiar rol'}>
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </button>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => reenviarInvitacion(u.email)} disabled={loading}
                    title="Reenviar email de acceso"
                    className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </button>

                  {!esMiCuenta && editandoId !== u.id && (
                    <button onClick={() => abrirEditar(u)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors p-1" title="Editar usuario">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}

                  {!esMiCuenta && (
                    <button onClick={() => toggleActivo(u)} disabled={loading}
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

      {/* Leyenda */}
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
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-zinc-500 text-xs font-medium mb-2">Alcance de establecimientos</p>
          <div className="space-y-1">
            <p className="text-zinc-600 text-xs">
              <span className="text-emerald-400">🌐 Todos</span> — el Supervisor o Auditor ve todos los establecimientos del grupo
            </p>
            <p className="text-zinc-600 text-xs">
              <span className="text-amber-400">📍 Asignados</span> — solo ve los establecimientos que se le asignen explícitamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
