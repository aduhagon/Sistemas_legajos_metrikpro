'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

type Rubro = { id: string; codigo: number; nombre: string }
type DocRequerido = { id: string; codigo: string; nombre: string; tipo_vigencia: string; obligatorio: boolean }

export default function RegistroPage() {
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [docsRequeridos, setDocsRequeridos] = useState<DocRequerido[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    razon_social: '',
    cuit: '',
    tipo_proveedor: 'PJ',
    rubro_id: '',
    email: '',
    telefono: '',
  })

  // Cargar rubros al montar
  useEffect(() => {
    supabase
      .from('rubros')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('codigo')
      .then(({ data }) => { if (data) setRubros(data) })
  }, [])

  // Cargar documentos requeridos cuando cambia el rubro o tipo_proveedor
  useEffect(() => {
    if (!form.rubro_id) { setDocsRequeridos([]); return }

    const esPF = form.tipo_proveedor === 'PF'
    const esPJ = form.tipo_proveedor === 'PJ'

    supabase
      .from('documentos_requeridos')
      .select('id, codigo, nombre, tipo_vigencia, obligatorio')
      .eq('activo', true)
      .eq(esPF ? 'aplica_persona_fisica' : 'aplica_persona_juridica', true)
      .order('codigo')
      .then(({ data }) => { if (data) setDocsRequeridos(data) })
  }, [form.rubro_id, form.tipo_proveedor])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: errFn } = await supabase.rpc('registrar_proveedor', {
        p_razon_social:   form.razon_social,
        p_cuit:           form.cuit.replace(/[-\s]/g, ''),
        p_tipo_proveedor: form.tipo_proveedor,
        p_rubro_id:       form.rubro_id || null,
        p_email:          form.email,
        p_telefono:       form.telefono || null,
      })

      if (errFn) throw new Error(errFn.message)
      if (data?.error) throw new Error(data.error)

      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const vigenciaLabel: Record<string, string> = {
    PERMANENTE: 'Permanente',
    ANUAL: 'Anual',
    MENSUAL: 'Mensual',
  }

  if (success) {
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
          {docsRequeridos.length > 0 && (
            <div className="mt-6 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-left">
              <p className="text-zinc-400 text-xs font-medium mb-3 uppercase tracking-wide">
                Documentos que deberás presentar ({docsRequeridos.length})
              </p>
              <ul className="space-y-2">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Razón social *</label>
              <input
                name="razon_social" value={form.razon_social} onChange={handleChange} required
                placeholder="Empresa S.A."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT *</label>
                <input
                  name="cuit" value={form.cuit} onChange={handleChange} required
                  placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">Tipo *</label>
                <select
                  name="tipo_proveedor" value={form.tipo_proveedor} onChange={handleChange}
                  className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
                >
                  <option value="PJ">Persona Jurídica</option>
                  <option value="PF">Persona Física</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Rubro *</label>
              <select
                name="rubro_id" value={form.rubro_id} onChange={handleChange} required
                className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              >
                <option value="">Seleccioná un rubro</option>
                {rubros.map(r => (
                  <option key={r.id} value={r.id}>{r.codigo}. {r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Documentos requeridos dinámicos */}
            {docsRequeridos.length > 0 && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 text-xs font-medium mb-2.5 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Documentos requeridos para este rubro ({docsRequeridos.length})
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

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Email de contacto *</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange} required
                placeholder="contacto@empresa.com"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Teléfono</label>
              <input
                name="telefono" value={form.telefono} onChange={handleChange}
                placeholder="+54 9 11 1234-5678"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
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