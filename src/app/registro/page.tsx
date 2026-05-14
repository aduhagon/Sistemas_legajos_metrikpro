'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function RegistroPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    razon_social: '',
    cuit: '',
    tipo_proveedor: 'PJ',
    rubro: '',
    email: '',
    telefono: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO Sprint 1: insertar en proveedores + crear usuario Supabase Auth para proveedor
    // Por ahora simula el éxito para probar el flujo visual
    await new Promise(r => setTimeout(r, 1000))
    setSuccess(true)
    setLoading(false)
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
          <h2 className="text-white text-xl font-medium mb-2">¡Registro recibido!</h2>
          <p className="text-zinc-400 text-sm">
            Revisaremos tu solicitud y te notificaremos por email cuando esté procesada.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
              <input name="razon_social" value={form.razon_social} onChange={handleChange} required placeholder="Empresa S.A."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">CUIT *</label>
                <input name="cuit" value={form.cuit} onChange={handleChange} required placeholder="20-12345678-9"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-1.5">Tipo *</label>
                <select name="tipo_proveedor" value={form.tipo_proveedor} onChange={handleChange}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                  <option value="PJ">Persona Jurídica</option>
                  <option value="PF">Persona Física</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Rubro *</label>
              <select name="rubro" value={form.rubro} onChange={handleChange} required
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                <option value="">Seleccioná un rubro</option>
                <option value="1">Fletes</option>
                <option value="2">Intermediarios de fletes</option>
                <option value="3">Arrendamiento</option>
                <option value="4">Insumos agrícolas</option>
                <option value="5">Operadores de granos</option>
                <option value="6">Prestadores de servicios</option>
                <option value="7">Construcción de obra</option>
                <option value="8">Operadores de derivados</option>
                <option value="9">General</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Email de contacto *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="contacto@empresa.com"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">Teléfono</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+54 9 11 1234-5678"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2">
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
