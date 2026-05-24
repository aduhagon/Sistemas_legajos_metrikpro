// src/app/registro/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type Rubro = { id: string; codigo: number; nombre: string }
type DocRequerido = { id: string; codigo: string; nombre: string; tipo_vigencia: string; obligatorio: boolean }

export default function RegistroPage() {
  const [rubros, setRubros]               = useState<Rubro[]>([])
  const [docsRequeridos, setDocsRequeridos] = useState<DocRequerido[]>([])
  const [loading, setLoading]             = useState(false)
  const [success, setSuccess]             = useState(false)
  const [error, setError]                 = useState('')
  const [form, setForm]                   = useState({
    razon_social:       '',
    cuit:               '',
    tipo_proveedor:     'PJ',
    rubro_ids:          [] as string[],   // ← multi-rubro
    email:              '',
    telefono:           '',
    notif_vencimientos: false,
  })

  useEffect(() => {
    supabase
      .from('rubros')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('codigo')
      .then(({ data }) => { if (data) setRubros(data) })
  }, [])

  // Cargar docs requeridos de todos los rubros seleccionados
  useEffect(() => {
    if (form.rubro_ids.length === 0) { setDocsRequeridos([]); return }
    const esPF = form.tipo_proveedor === 'PF'

    supabase
      .from('documentos_requeridos')
      .select('id, codigo, nombre, tipo_vigencia, obligatorio')
      .eq('activo', true)
      .eq(esPF ? 'aplica_persona_fisica' : 'aplica_persona_juridica', true)
      .order('codigo')
      .then(({ data }) => { if (data) setDocsRequeridos(data) })
  }, [form.rubro_ids, form.tipo_proveedor])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const value = e.target.type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value
    setForm(f => ({ ...f, [e.target.name]: value }))
  }

  function toggleRubro(id: string) {
    setForm(f => ({
      ...f,
      rubro_ids: f.rubro_ids.includes(id)
        ? f.rubro_ids.filter(r => r !== id)
        : [...f.rubro_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.rubro_ids.length === 0) {
      setError('Seleccioná al menos un rubro')
      return
    }
    setLoading(true)
    setError('')

    try {
      // Registrar con el primer rubro como campo legacy, los demás via proveedor_rubros
      const { data, error: errFn } = await supabase.rpc('registrar_proveedor', {
        p_razon_social:       form.razon_social,
        p_cuit:               form.cuit.replace(/[-\s]/g, ''),
        p_tipo_proveedor:     form.tipo_proveedor,
        p_rubro_id:           form.rubro_ids[0] || null,
        p_email:              form.email,
        p_telefono:           form.telefono || null,
        p_notif_vencimientos: form.notif_vencimientos,
      })

      if (errFn) throw new Error(errFn.message)
      if (data?.error) throw new Error(data.error)

      // Si hay rubros adicionales, insertarlos en proveedor_rubros
      if (data?.proveedor_id && form.rubro_ids.length > 1) {
        // El primer rubro ya fue insertado vía la RPC que llama a registrar_proveedor
        // Agregar los rubros adicionales
        const rubrosAdicionales = form.rubro_ids.slice(1)
        const { data: prov } = await supabase
          .from('proveedores')
          .select('grupo_id')
          .eq('id', data.proveedor_id)
          .single()

        if (prov) {
          await supabase.from('proveedor_rubros').insert(
            rubrosAdicionales.map(rid => ({
              proveedor_id: data.proveedor_id,
              rubro_id:     rid,
              grupo_id:     prov.grupo_id,
            }))
          )
        }
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const vigenciaLabel: Record<string, string> = {
    PERMANENTE: 'Permanente',
    ANUAL:      'Anual',
    MENSUAL:    'Mensual',
  }

  if (success) {
    const rubrosSeleccionados = rubros.filter(r => form.rubro_ids.includes(r.id))
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <h2 className="text-white text-xl font-medium mb-3">¡Solicitud recibida!</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-2">
            Tu solicitud de alta fue registrada correctamente.
          </p>
          <p className="text-zinc-500 text-sm">
            Te notificaremos a <span className="text-zinc-300">{form.email}</span> cuando sea procesada.
          </p>
          {rubrosSeleccionados.length > 0 && (
            <div className="mt-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-left">
              <p className="text-zinc-400 text-xs font-medium mb-2">Rubros registrados</p>
              <div className="flex flex-wrap gap-1.5">
                {rubrosSeleccionados.map(r => (
                  <span key={r.id} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full">
                    {r.codigo}. {r.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
          {docsRequeridos.length > 0 && (
            <div className="mt-3 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-left">
              <p className="text-zinc-400 text-xs font-medium mb-2">Documentos a presentar ({docsRequeridos.length})</p>
              <ul className="space-y-1.5">
                {docsRequeridos.map(doc => (
                  <li key={doc.id} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </span>
                    <div>
                      <span className="text-zinc-300 text-xs">{doc.nombre}</span>
                      <span className="text-zinc-600 text-xs ml-2">({vigenciaLabel[doc.tipo_vigencia]})</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight text-lg">Sistema Legajos</span>
          </div>
          <p className="text-zinc-500 text-sm">Registro de proveedor / contratista</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
          <h1 className="text-white font-medium text-xl mb-6">Alta de empresa</h1>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Razón social */}
            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Razón social *</label>
              <input name="razon_social" value={form.razon_social} onChange={handleChange} required
                placeholder="Empresa S.A."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
            </div>

            {/* CUIT + Tipo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT *</label>
                <input name="cuit" value={form.cuit} onChange={handleChange} required
                  placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">Tipo *</label>
                <select name="tipo_proveedor" value={form.tipo_proveedor} onChange={handleChange}
                  className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                  <option value="PJ">Persona Jurídica</option>
                  <option value="PF">Persona Física</option>
                </select>
              </div>
            </div>

            {/* ── Rubros multi-select ── */}
            <div>
              <label className="block text-zinc-400 text-sm mb-2">
                Rubro(s) *
                <span className="text-zinc-600 ml-1 font-normal">
                  ({form.rubro_ids.length} seleccionado{form.rubro_ids.length !== 1 ? 's' : ''})
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {rubros.map(r => {
                  const sel = form.rubro_ids.includes(r.id)
                  return (
                    <button key={r.id} type="button" onClick={() => toggleRubro(r.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        sel
                          ? 'border-blue-500/50 bg-blue-500/8'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
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
                      <div className="min-w-0">
                        <p className={`text-sm ${sel ? 'text-white' : 'text-zinc-300'}`}>{r.nombre}</p>
                        <p className="text-zinc-600 text-xs">#{r.codigo}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Chips de seleccionados */}
              {form.rubro_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.rubro_ids.map(rid => {
                    const r = rubros.find(x => x.id === rid)
                    if (!r) return null
                    return (
                      <span key={rid} className="inline-flex items-center gap-1 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full">
                        {r.nombre}
                        <button type="button" onClick={() => toggleRubro(rid)} className="hover:text-white ml-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Docs requeridos dinámicos */}
            {docsRequeridos.length > 0 && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 text-xs font-medium mb-2.5 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Documentos requeridos para estos rubros ({docsRequeridos.length})
                </p>
                <ul className="space-y-1.5">
                  {docsRequeridos.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between">
                      <span className="text-zinc-300 text-xs">{doc.nombre}</span>
                      <span className="text-zinc-500 text-xs">{vigenciaLabel[doc.tipo_vigencia]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Email de contacto *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                placeholder="contacto@empresa.com"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Teléfono</label>
              <input name="telefono" value={form.telefono} onChange={handleChange}
                placeholder="+54 9 11 1234-5678"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"/>
            </div>

            {/* Notificaciones */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" name="notif_vencimientos" checked={form.notif_vencimientos}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 rounded border border-white/[0.2] bg-white/[0.05] accent-blue-500 cursor-pointer"/>
              <div>
                <span className="text-zinc-300 text-sm">Quiero recibir alertas de vencimiento por email</span>
                <p className="text-zinc-600 text-xs mt-0.5">Te avisaremos 7 días antes de que venza cada documento</p>
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || form.rubro_ids.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2">
              {loading ? 'Enviando...' : 'Enviar solicitud de alta'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-6">
          ¿Ya tenés cuenta?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">Iniciar sesión</a>
        </p>
      </div>
    </div>
  )
}
