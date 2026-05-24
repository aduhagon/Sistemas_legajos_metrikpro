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
  vigencia_hasta: string | null
  personal_establecimientos: { establecimiento_id: string; establecimientos: { nombre: string } }[]
}

const emptyForm = {
  nombre: '', cuil: '', notas: '',
  vigencia_hasta: '',
  establecimientos: [] as string[],
}

function diasHasta(fechaStr: string): number {
  const hoy = new Date().toISOString().split('T')[0]
  const [ay, am, ad] = hoy.split('-').map(Number)
  const [by, bm, bd] = fechaStr.split('-').map(Number)
  return Math.ceil((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function formatFecha(f: string) {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR')
}

function VigenciaBadge({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="text-zinc-600 text-xs">Sin vencimiento</span>
  const dias = diasHasta(fecha)
  if (dias < 0)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Venció {formatFecha(fecha)}</span>
  if (dias === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Vence hoy</span>
  if (dias <= 7)  return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">Vence en {dias}d</span>
  if (dias <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Vence en {dias}d</span>
  return <span className="text-xs text-zinc-500">Vigente hasta {formatFecha(fecha)}</span>
}

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

  const hoyStr = new Date().toISOString().split('T')[0]
  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all placeholder:text-zinc-600"

  function abrirEditar(p: Persona) {
    setForm({
      nombre:          p.nombre,
      cuil:            p.cuil,
      notas:           p.notas ?? '',
      vigencia_hasta:  p.vigencia_hasta ?? '',
      establecimientos: p.personal_establecimientos.map(pe => pe.establecimiento_id),
    })
    setEditando(p.id)
    setCreando(false)
    setError('')
  }

  function cancelar() {
    setCreando(false); setEditando(null)
    setForm(emptyForm); setError('')
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
      const payload = {
        nombre:         form.nombre.trim(),
        cuil:           form.cuil.replace(/[-\s]/g, ''),
        notas:          form.notas.trim() || null,
        vigencia_hasta: form.vigencia_hasta || null,
        updated_at:     new Date().toISOString(),
      }

      if (personaId) {
        const { error: updErr } = await supabase
          .from('personal_habilitado').update(payload).eq('id', personaId)
        if (updErr) throw new Error(updErr.message)

        await supabase.from('personal_establecimientos').delete().eq('personal_id', personaId)
        if (form.establecimientos.length > 0) {
          await supabase.from('personal_establecimientos').insert(
            form.establecimientos.map(eid => ({ personal_id: personaId, establecimiento_id: eid }))
          )
        }
        setPersonal(prev => prev.map(p => {
          if (p.id !== personaId) return p
          return {
            ...p, ...payload,
            personal_establecimientos: form.establecimientos.map(eid => ({
              establecimiento_id: eid,
              establecimientos: { nombre: establecimientos.find(e => e.id === eid)?.nombre ?? '' },
            })),
          }
        }))
        setEditando(null)

      } else {
        const { data, error: insErr } = await supabase
          .from('personal_habilitado')
          .insert({ grupo_id: grupoId, ...payload })
          .select('id, nombre, cuil, qr_token, activo, notas, vigencia_hasta')
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

        {/* Vigencia */}
        <div>
          <label className="block text-zinc-400 text-xs mb-1.5">
            Vigencia del permiso
            <span className="text-zinc-600 ml-1">(opcional — sin fecha = sin vencimiento)</span>
          </label>
          <input
            type="date"
            value={form.vigencia_hasta}
            min={hoyStr}
            onChange={e => setForm(f => ({ ...f, vigencia_hasta: e.target.value }))}
            className={inputCls}
          />
          {form.vigencia_hasta && (
            <p className="text-zinc-500 text-xs mt-1">
              El carnet QR mostrará acceso denegado a partir del {formatFecha(form.vigencia_hasta)}
            </p>
          )}
        </div>

        {/* Establecimientos */}
        <div>
          <label className="block text-zinc-400 text-xs mb-2">Establecimientos habilitados *</label>
          {establecimientos.length === 0 ? (
            <p className="text-zinc-600 text-xs">No hay establecimientos configurados todavía.</p>
          ) : (
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

      {!creando && (
        <button onClick={() => { setCreando(true); setEditando(null); setForm(emptyForm) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar persona
        </button>
      )}

      {creando && (
        <div className="bg-white/[0.03] border border-blue-500/20 rounded-2xl p-5">
          <p className="text-sm font-medium mb-4">Nueva persona habilitada</p>
          <FormPersona onSave={() => guardar()} onCancel={cancelar}/>
        </div>
      )}

      {personal.length === 0 && !creando ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm mb-1">No hay personal registrado todavía</p>
          <p className="text-zinc-700 text-xs">Agregá las personas con acceso a los establecimientos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personal.map(p => {
            const qrUrl = `${baseUrl}/qr-personal/${p.qr_token}`
            const estabsNombres = p.personal_establecimientos.map(pe => pe.establecimientos.nombre)
            const vencido = p.vigencia_hasta ? diasHasta(p.vigencia_hasta) < 0 : false
            const porVencer = p.vigencia_hasta ? diasHasta(p.vigencia_hasta) <= 7 && !vencido : false

            return (
              <div key={p.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden transition-all ${
                vencido        ? 'border-red-500/30 opacity-70' :
                porVencer      ? 'border-orange-500/30' :
                !p.activo      ? 'border-white/[0.04] opacity-60' :
                'border-white/[0.08]'
              }`}>

                {editando === p.id ? (
                  <div className="p-5">
                    <p className="text-sm font-medium mb-4">Editar — {p.nombre}</p>
                    <FormPersona onSave={() => guardar(p.id)} onCancel={cancelar}/>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base font-semibold ${
                        vencido   ? 'bg-red-500/10 text-red-300 border border-red-500/20' :
                        porVencer ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20' :
                        'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}>
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{p.nombre}</p>
                        <p className="text-zinc-500 text-sm font-mono">CUIL {p.cuil}</p>

                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <VigenciaBadge fecha={p.vigencia_hasta}/>
                        </div>

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
                        <button onClick={() => setQrVisible(qrVisible === p.id ? null : p.id)}
                          title="Ver carnet QR"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/>
                            <line x1="14" y1="18" x2="21" y2="18"/><line x1="14" y1="21" x2="21" y2="21"/>
                          </svg>
                        </button>

                        <button onClick={() => abrirEditar(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>

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

                    {/* Panel QR */}
                    {qrVisible === p.id && (
                      <div className="border-t border-white/[0.06] px-5 py-5 bg-white/[0.01]">
                        <div className="flex items-start gap-6">
                          <div className={`rounded-xl p-3 shrink-0 ${vencido ? 'bg-white opacity-50' : 'bg-white'}`}>
                            <QRCodeSVG value={qrUrl} size={130} level="H"/>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium mb-0.5">{p.nombre}</p>
                            <p className="text-zinc-400 text-sm font-mono mb-1">CUIL {p.cuil}</p>
                            {p.vigencia_hasta && (
                              <p className={`text-xs mb-3 ${vencido ? 'text-red-400' : 'text-zinc-500'}`}>
                                {vencido ? '⚠ Permiso vencido' : `Vigente hasta ${formatFecha(p.vigencia_hasta)}`}
                              </p>
                            )}
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

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <p className="text-zinc-500 text-xs font-medium mb-1">¿Cómo funciona la vigencia?</p>
        <p className="text-zinc-600 text-xs leading-relaxed">
          La fecha de vigencia define hasta cuándo la persona puede acceder. Una vez vencida,
          el carnet QR muestra acceso denegado automáticamente. Si no se ingresa fecha, el permiso no vence.
          La tarjeta se muestra en naranja cuando vence en 7 días o menos, y en rojo cuando ya venció.
        </p>
      </div>
    </div>
  )
}
