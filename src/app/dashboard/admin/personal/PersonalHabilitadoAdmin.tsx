// src/app/dashboard/admin/personal/PersonalHabilitadoAdmin.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { QRCodeSVG } from 'qrcode.react'

type Establecimiento = { id: string; nombre: string }
type Persona = {
  id: string
  nombre: string
  cuil: string
  qr_token: string
  activo: boolean
  notas: string | null
  personal_establecimientos: { establecimiento_id: string; establecimientos: { nombre: string } }[]
}

const emptyForm = { nombre: '', cuil: '', notas: '', establecimientos: [] as string[] }

export default function PersonalHabilitadoAdmin({
  personal: personalInit,
  establecimientos,
  grupoId,
}: {
  personal: Persona[]
  establecimientos: Establecimiento[]
  grupoId: string
}) {
  const [personal, setPersonal]   = useState(personalInit)
  const [creando, setCreando]     = useState(false)
  const [editando, setEditando]   = useState<string | null>(null)
  const [form, setForm]           = useState(emptyForm)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [qrVisible, setQrVisible] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://sistemas-legajos-metrikpro.vercel.app'

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  function abrirEditar(p: Persona) {
    setForm({
      nombre:          p.nombre,
      cuil:            p.cuil,
      notas:           p.notas ?? '',
      establecimientos: p.personal_establecimientos.map(pe => pe.establecimiento_id),
    })
    setEditando(p.id)
    setCreando(false)
    setError('')
  }

  function cancelar() {
    setCreando(false)
    setEditando(null)
    setForm(emptyForm)
    setError('')
  }

  function toggleEstab(id: string) {
    setForm(f => ({
      ...f,
      establecimientos: f.establecimientos.includes(id)
        ? f.establecimientos.filter(e => e !== id)
        : [...f.establecimientos, id],
    }))
  }

  async function guardar(personaId?: string) {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.cuil.trim())   { setError('El CUIL es obligatorio'); return }
    setLoading(true); setError('')

    try {
      if (personaId) {
        // Actualizar datos básicos
        const { error: updErr } = await supabase
          .from('personal_habilitado')
          .update({
            nombre:     form.nombre.trim(),
            cuil:       form.cuil.replace(/[-\s]/g, ''),
            notas:      form.notas.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', personaId)
        if (updErr) throw new Error(updErr.message)

        // Reemplazar establecimientos
        await supabase.from('personal_establecimientos').delete().eq('personal_id', personaId)
        if (form.establecimientos.length > 0) {
          await supabase.from('personal_establecimientos').insert(
            form.establecimientos.map(eid => ({ personal_id: personaId, establecimiento_id: eid }))
          )
        }

        // Actualizar estado local
        setPersonal(prev => prev.map(p => {
          if (p.id !== personaId) return p
          return {
            ...p,
            nombre: form.nombre.trim(),
            cuil:   form.cuil.replace(/[-\s]/g, ''),
            notas:  form.notas.trim() || null,
            personal_establecimientos: form.establecimientos.map(eid => ({
              establecimiento_id: eid,
              establecimientos: { nombre: establecimientos.find(e => e.id === eid)?.nombre ?? '' },
            })),
          }
        }))
        setEditando(null)

      } else {
        // Crear nueva persona
        const { data, error: insErr } = await supabase
          .from('personal_habilitado')
          .insert({
            grupo_id: grupoId,
            nombre:   form.nombre.trim(),
            cuil:     form.cuil.replace(/[-\s]/g, ''),
            notas:    form.notas.trim() || null,
          })
          .select('id, nombre, cuil, qr_token, activo, notas')
          .single()
        if (insErr) throw new Error(insErr.message)

        if (form.establecimientos.length > 0) {
          await supabase.from('personal_establecimientos').insert(
            form.establecimientos.map(eid => ({ personal_id: data.id, establecimiento_id: eid }))
          )
        }

        setPersonal(prev => [{
          ...data,
          personal_establecimientos: form.establecimientos.map(eid => ({
            establecimiento_id: eid,
            establecimientos: { nombre: establecimientos.find(e => e.id === eid)?.nombre ?? '' },
          })),
        }, ...prev])
        setCreando(false)
      }

      setForm(emptyForm)
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActivo(p: Persona) {
    setLoading(true)
    await supabase.from('personal_habilitado')
      .update({ activo: !p.activo, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    setPersonal(prev => prev.map(x => x.id === p.id ? { ...x, activo: !p.activo } : x))
    setLoading(false)
  }

  // ── Form reutilizable ─────────────────────────────────────────────────────
  function FormPersona({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Nombre completo *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Juan García" autoFocus className={inputCls}/>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">CUIL *</label>
            <input value={form.cuil} onChange={e => setForm(f => ({ ...f, cuil: e.target.value }))}
              placeholder="20-12345678-9" className={inputCls}/>
          </div>
        </div>

        <div>
          <label className="block text-zinc-400 text-xs mb-2">Establecimientos habilitados *</label>
          <div className="grid grid-cols-2 gap-2">
            {establecimientos.map(e => {
              const sel = form.establecimientos.includes(e.id)
              return (
                <label key={e.id} onClick={() => toggleEstab(e.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    sel ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                    sel ? 'bg-blue-600 border-blue-500' : 'bg-white/[0.05] border-white/[0.2]'
                  }`}>
                    {sel && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${sel ? 'text-blue-300' : 'text-zinc-400'}`}>{e.nombre}</span>
                </label>
              )
            })}
          </div>
          {establecimientos.length === 0 && (
            <p className="text-zinc-600 text-xs">No hay establecimientos configurados todavía.</p>
          )}
        </div>

        <div>
          <label className="block text-zinc-400 text-xs mb-1.5">Notas (opcional)</label>
          <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Rol, área, observaciones..." className={inputCls}/>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onSave} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors px-3 py-2">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* Botón agregar */}
      {!creando && (
        <button onClick={() => { setCreando(true); setEditando(null); setForm(emptyForm) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar persona
        </button>
      )}

      {/* Form crear */}
      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5">
          <p className="text-sm font-medium mb-4">Nueva persona habilitada</p>
          <FormPersona onSave={() => guardar()} onCancel={cancelar}/>
        </div>
      )}

      {/* Lista */}
      {personal.length === 0 && !creando ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm mb-1">No hay personal registrado todavía</p>
          <p className="text-zinc-700 text-xs">Agregá las personas que tienen acceso a los establecimientos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personal.map(p => {
            const qrUrl = `${baseUrl}/qr-personal/${p.qr_token}`
            const estabsNombres = p.personal_establecimientos.map(pe => pe.establecimientos.nombre)
            return (
              <div key={p.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden ${p.activo ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>

                {editando === p.id ? (
                  <div className="p-5">
                    <p className="text-sm font-medium mb-4">Editar — {p.nombre}</p>
                    <FormPersona onSave={() => guardar(p.id)} onCancel={cancelar}/>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="px-5 py-4 flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-base font-semibold text-blue-300">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{p.nombre}</p>
                        <p className="text-zinc-500 text-sm font-mono">CUIL {p.cuil}</p>
                        {estabsNombres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {estabsNombres.map(n => (
                              <span key={n} className="text-xs bg-white/[0.05] border border-white/[0.08] text-zinc-400 px-2 py-0.5 rounded-full">
                                {n}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.notas && <p className="text-zinc-600 text-xs mt-1">{p.notas}</p>}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Ver QR */}
                        <button onClick={() => setQrVisible(qrVisible === p.id ? null : p.id)}
                          title="Ver carnet QR"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/>
                            <line x1="14" y1="18" x2="21" y2="18"/><line x1="14" y1="21" x2="21" y2="21"/>
                          </svg>
                        </button>

                        {/* Editar */}
                        <button onClick={() => abrirEditar(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>

                        {/* Activo/Inactivo */}
                        <button onClick={() => toggleActivo(p)} disabled={loading}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            p.activo
                              ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                              : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                          }`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>
                    </div>

                    {/* Panel QR expandible */}
                    {qrVisible === p.id && (
                      <div className="border-t border-white/[0.06] px-5 py-5 bg-white/[0.01]">
                        <div className="flex items-start gap-6">
                          {/* QR */}
                          <div className="bg-white rounded-xl p-3 shrink-0">
                            <QRCodeSVG value={qrUrl} size={130} level="H"/>
                          </div>

                          {/* Info carnet */}
                          <div className="flex-1">
                            <p className="text-white font-medium mb-0.5">{p.nombre}</p>
                            <p className="text-zinc-400 text-sm font-mono mb-3">CUIL {p.cuil}</p>
                            <p className="text-zinc-500 text-xs mb-1">URL del carnet:</p>
                            <p className="text-zinc-600 text-xs font-mono break-all mb-3">{qrUrl}</p>
                            <div className="flex gap-2">
                              <a href={qrUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 px-3 py-1.5 rounded-lg transition-all">
                                Abrir carnet →
                              </a>
                              <button onClick={() => navigator.clipboard.writeText(qrUrl)}
                                className="text-xs bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-300 px-3 py-1.5 rounded-lg transition-all">
                                Copiar URL
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <p className="text-zinc-500 text-xs font-medium mb-1">¿Cómo funciona el carnet QR?</p>
        <p className="text-zinc-600 text-xs leading-relaxed">
          Cada persona tiene un QR único. Al escanearlo, el portero ve el nombre y CUIL para verificar identidad,
          junto con los establecimientos habilitados. Si la persona está inactiva, el carnet muestra acceso denegado.
        </p>
      </div>
    </div>
  )
}
