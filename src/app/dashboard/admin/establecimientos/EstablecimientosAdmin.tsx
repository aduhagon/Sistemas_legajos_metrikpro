'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

type Tipo = { id: string; nombre: string; icono: string }
type Rubro = { id: string; codigo: number; nombre: string }
type Establecimiento = {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  modo_acceso: string
  activo: boolean
  lat_centro: number | null
  lng_centro: number | null
  radio_metros: number
  qr_token: string
  tipos_establecimiento: { id: string; nombre: string; icono: string } | null
  establecimientos_rubros: { rubro_id: string; rubros: { id: string; nombre: string; codigo: number } }[]
}

const MODOS = [
  { value: 'OPERADOR',  label: 'Operador escanea QR del proveedor', desc: 'El portero usa el panel de acceso' },
  { value: 'PROVEEDOR', label: 'Proveedor escanea QR del establecimiento', desc: 'QR fijo en la entrada' },
  { value: 'AMBOS',     label: 'Ambos modos habilitados', desc: 'Flexible según la situación' },
]

const emptyForm = {
  nombre: '', descripcion: '', direccion: '',
  tipo_id: '', modo_acceso: 'AMBOS',
  lat_centro: '', lng_centro: '', radio_metros: '100',
}

export default function EstablecimientosAdmin({
  establecimientos: est0, tipos, rubros, grupoId
}: {
  establecimientos: Establecimiento[]
  tipos: Tipo[]
  rubros: Rubro[]
  grupoId: string
}) {
  const router = useRouter()
  const [establecimientos, setEstablecimientos] = useState(est0)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState<string | null>(null)

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
  const selectCls = "w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"

  function abrirEditar(e: Establecimiento) {
    setForm({
      nombre: e.nombre, descripcion: e.descripcion ?? '',
      direccion: e.direccion ?? '',
      tipo_id: e.tipos_establecimiento?.id ?? '',
      modo_acceso: e.modo_acceso,
      lat_centro: e.lat_centro?.toString() ?? '',
      lng_centro: e.lng_centro?.toString() ?? '',
      radio_metros: e.radio_metros?.toString() ?? '100',
    })
    setEditando(e.id)
    setCreando(false)
  }

  async function guardar(estabId?: string) {
    setLoading(true)
    const payload = {
      grupo_id:     grupoId,
      nombre:       form.nombre,
      descripcion:  form.descripcion || null,
      direccion:    form.direccion || null,
      tipo_id:      form.tipo_id || null,
      modo_acceso:  form.modo_acceso,
      lat_centro:   form.lat_centro ? parseFloat(form.lat_centro) : null,
      lng_centro:   form.lng_centro ? parseFloat(form.lng_centro) : null,
      radio_metros: parseInt(form.radio_metros) || 100,
    }

    if (estabId) {
      await supabase.from('establecimientos').update(payload).eq('id', estabId)
    } else {
      await supabase.from('establecimientos').insert(payload)
    }

    setCreando(false)
    setEditando(null)
    setForm(emptyForm)
    setLoading(false)
    router.refresh()
  }

  async function toggleActivo(e: Establecimiento) {
    setLoading(true)
    await supabase.from('establecimientos').update({ activo: !e.activo }).eq('id', e.id)
    setEstablecimientos(prev => prev.map(x => x.id === e.id ? { ...x, activo: !e.activo } : x))
    setLoading(false)
  }

  async function toggleRubro(estabId: string, rubroId: string, habilitado: boolean) {
    if (habilitado) {
      await supabase.from('establecimientos_rubros').delete()
        .eq('establecimiento_id', estabId).eq('rubro_id', rubroId)
    } else {
      await supabase.from('establecimientos_rubros').insert({ establecimiento_id: estabId, rubro_id: rubroId })
    }
    router.refresh()
  }

  function getRubrosHabilitados(e: Establecimiento) {
    return e.establecimientos_rubros?.map(r => r.rubro_id) ?? []
  }

  const qrBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sistemas-legajos-metrikpro.vercel.app'

  return (
    <div className="space-y-3">

      {/* Botón crear */}
      {!creando && (
        <button onClick={() => { setCreando(true); setEditando(null); setForm(emptyForm) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo establecimiento
        </button>
      )}

      {/* Form crear */}
      {creando && (
        <FormEstablecimiento
          form={form} setForm={setForm} tipos={tipos}
          onSave={() => guardar()} onCancel={() => setCreando(false)}
          loading={loading} inputCls={inputCls} selectCls={selectCls}
          titulo="Nuevo establecimiento"
        />
      )}

      {/* Lista */}
      {establecimientos.map(e => {
        const rubrosHab = getRubrosHabilitados(e)
        const tipo = e.tipos_establecimiento

        return (
          <div key={e.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden ${e.activo ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <button onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                className="text-zinc-400 hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${abierto === e.id ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {tipo && <span className="text-lg">{tipo.icono}</span>}
                  <span className="text-white font-medium">{e.nombre}</span>
                  {tipo && <span className="text-zinc-600 text-xs">{tipo.nombre}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    e.modo_acceso === 'OPERADOR'  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    e.modo_acceso === 'PROVEEDOR' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}>
                    {e.modo_acceso === 'OPERADOR' ? 'Operador' : e.modo_acceso === 'PROVEEDOR' ? 'Proveedor' : 'Ambos modos'}
                  </span>
                </div>
                {e.direccion && <p className="text-zinc-600 text-xs mt-0.5">{e.direccion}</p>}
                <p className="text-zinc-700 text-xs mt-0.5">
                  {rubrosHab.length} rubro{rubrosHab.length !== 1 ? 's' : ''} habilitado{rubrosHab.length !== 1 ? 's' : ''}
                  {e.lat_centro && ` · GPS configurado`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* QR fijo del establecimiento */}
                {(e.modo_acceso === 'PROVEEDOR' || e.modo_acceso === 'AMBOS') && (
                  <button onClick={() => setShowQR(showQR === e.id ? null : e.id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" title="Ver QR del establecimiento">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/>
                      <line x1="14" y1="14" x2="21" y2="14"/><line x1="21" y1="18" x2="21" y2="21"/>
                      <line x1="18" y1="21" x2="21" y2="21"/>
                    </svg>
                  </button>
                )}
                <button onClick={() => abrirEditar(e)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => toggleActivo(e)} disabled={loading}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    e.activo
                      ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                  }`}>
                  {e.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>

            {/* QR del establecimiento */}
            {showQR === e.id && (
              <div className="px-5 pb-4 border-t border-white/[0.06]">
                <div className="flex items-start gap-6 pt-4">
                  <div className="bg-white rounded-xl p-3 shrink-0">
                    <QRCodeSVG value={`${qrBaseUrl}/entrada/${e.qr_token}`} size={120} level="H"/>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium mb-1">QR de entrada — {e.nombre}</p>
                    <p className="text-zinc-500 text-xs mb-2">Imprimí este QR y colocalo en el punto de acceso. El proveedor lo escanea con su celular para registrar el ingreso.</p>
                    <p className="text-zinc-700 text-xs font-mono">{qrBaseUrl}/entrada/{e.qr_token}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form editar */}
            {editando === e.id && (
              <div className="border-t border-white/[0.06] px-5 py-4">
                <FormEstablecimiento
                  form={form} setForm={setForm} tipos={tipos}
                  onSave={() => guardar(e.id)} onCancel={() => setEditando(null)}
                  loading={loading} inputCls={inputCls} selectCls={selectCls}
                  titulo="Editar establecimiento"
                />
              </div>
            )}

            {/* Detalle expandido — rubros */}
            {abierto === e.id && editando !== e.id && (
              <div className="border-t border-white/[0.06] px-5 py-4">
                <div className="mb-4">
                  <p className="text-sm font-medium mb-3">Rubros habilitados para ingresar</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {rubros.map(r => {
                      const hab = rubrosHab.includes(r.id)
                      return (
                        <label key={r.id} className="flex items-center gap-2 cursor-pointer group">
                          <button onClick={() => toggleRubro(e.id, r.id, hab)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                              hab ? 'bg-blue-600 border-blue-500' : 'bg-white/[0.05] border-white/[0.2] hover:border-blue-500/50'
                            }`}>
                            {hab && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20,6 9,17 4,12"/>
                              </svg>
                            )}
                          </button>
                          <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                            <span className="text-zinc-600 text-xs font-mono mr-1">{r.codigo}.</span>
                            {r.nombre}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Info GPS */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-zinc-500 text-xs font-medium mb-2">Configuración GPS</p>
                  {e.lat_centro && e.lng_centro ? (
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-zinc-400 text-xs">Centro: {e.lat_centro}, {e.lng_centro}</p>
                        <p className="text-zinc-400 text-xs">Radio: {e.radio_metros} metros</p>
                      </div>
                      <a href={`https://maps.google.com/?q=${e.lat_centro},${e.lng_centro}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                        Ver en mapa →
                      </a>
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-xs">Sin coordenadas GPS configuradas — el perímetro no se validará</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {establecimientos.length === 0 && !creando && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm mb-3">No hay establecimientos configurados todavía</p>
          <button onClick={() => setCreando(true)}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Crear el primero →
          </button>
        </div>
      )}
    </div>
  )
}

function FormEstablecimiento({ form, setForm, tipos, onSave, onCancel, loading, inputCls, selectCls, titulo }: any) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f: any) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function usarGPSActual() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setForm((f: any) => ({
        ...f,
        lat_centro: pos.coords.latitude.toFixed(7),
        lng_centro: pos.coords.longitude.toFixed(7),
      }))
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-white">{titulo}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-zinc-400 text-xs mb-1">Nombre *</label>
          <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Campo La Esperanza" className={inputCls}/>
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">Tipo</label>
          <select name="tipo_id" value={form.tipo_id} onChange={handleChange} className={selectCls}>
            <option value="">Sin tipo</option>
            {tipos.map((t: any) => <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">Modo de acceso *</label>
          <select name="modo_acceso" value={form.modo_acceso} onChange={handleChange} className={selectCls}>
            <option value="OPERADOR">Operador escanea QR del proveedor</option>
            <option value="PROVEEDOR">Proveedor escanea QR del establecimiento</option>
            <option value="AMBOS">Ambos modos</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-zinc-400 text-xs mb-1">Dirección</label>
          <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Ruta 8 Km 200, Córdoba" className={inputCls}/>
        </div>
      </div>

      {/* GPS */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-zinc-400 text-xs">Coordenadas GPS del centro</label>
          <button type="button" onClick={usarGPSActual}
            className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            Usar mi ubicación actual
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input name="lat_centro" value={form.lat_centro} onChange={handleChange}
            placeholder="Latitud (-34.123456)" className={inputCls}/>
          <input name="lng_centro" value={form.lng_centro} onChange={handleChange}
            placeholder="Longitud (-63.123456)" className={inputCls}/>
          <div className="relative">
            <input name="radio_metros" value={form.radio_metros} onChange={handleChange}
              placeholder="Radio (metros)" type="number" className={inputCls}/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">m</span>
          </div>
        </div>
        <p className="text-zinc-700 text-xs mt-1">Si no configurás GPS, el perímetro no se validará pero igual se registrará el acceso</p>
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={loading || !form.nombre}
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
