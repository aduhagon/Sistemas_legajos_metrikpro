'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

type Config = {
  grupo_id: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_from_name: string
  smtp_from_email: string
  notif_evaluador_email: string
} | null

export default function ConfigForm({ config }: { config: Config }) {
  const [form, setForm] = useState({
    smtp_host:             config?.smtp_host             ?? 'smtp.gmail.com',
    smtp_port:             config?.smtp_port             ?? 587,
    smtp_user:             config?.smtp_user             ?? '',
    smtp_password:         '',   // siempre vacío al cargar — nunca exponemos el valor cifrado
    smtp_from_name:        config?.smtp_from_name        ?? 'Sistema Legajos',
    smtp_from_email:       config?.smtp_from_email       ?? '',
    notif_evaluador_email: config?.notif_evaluador_email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ok: boolean; msg: string} | null>(null)
  const [showPass, setShowPass] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setSaved(false)
    setTestResult(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // 1. Guardar campos no sensibles directo en la tabla
    await supabase
      .from('grupos_config')
      .update({
        smtp_host:             form.smtp_host,
        smtp_port:             Number(form.smtp_port),
        smtp_user:             form.smtp_user,
        smtp_from_name:        form.smtp_from_name,
        smtp_from_email:       form.smtp_from_email,
        notif_evaluador_email: form.notif_evaluador_email,
        updated_at:            new Date().toISOString(),
      })
      .eq('grupo_id', config?.grupo_id)

    // 2. Si ingresaron una nueva contraseña, cifrarla vía fn_smtp_set_password
    if (form.smtp_password.trim()) {
      await supabase.rpc('fn_smtp_set_password', {
        p_grupo_id: config?.grupo_id,
        p_password: form.smtp_password,
      })
      // Limpiar el campo después de guardar
      setForm(f => ({ ...f, smtp_password: '' }))
    }

    setSaving(false)
    setSaved(true)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      // El test lo maneja el server — él descifra la contraseña desde Vault
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_host:             form.smtp_host,
          smtp_port:             form.smtp_port,
          smtp_user:             form.smtp_user,
          smtp_from_name:        form.smtp_from_name,
          smtp_from_email:       form.smtp_from_email,
          notif_evaluador_email: form.notif_evaluador_email,
          grupo_id:              config?.grupo_id,
          // solo enviar password si el usuario lo ingresó explícitamente
          ...(form.smtp_password.trim() ? { smtp_password: form.smtp_password } : {}),
        }),
      })
      const data = await res.json()
      setTestResult(data.ok
        ? { ok: true,  msg: `Email de prueba enviado a ${form.notif_evaluador_email}` }
        : { ok: false, msg: data.error ?? 'Error desconocido' }
      )
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Sección SMTP */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
        <h2 className="text-sm font-medium mb-1">Servidor de email saliente (SMTP)</h2>
        <p className="text-zinc-500 text-xs mb-5">
          Para Gmail: usá <span className="text-zinc-300">smtp.gmail.com</span> puerto 587 y una{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors">App Password</a> de Google.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="col-span-2">
            <label className="block text-zinc-400 text-xs mb-1.5">Servidor SMTP</label>
            <input name="smtp_host" value={form.smtp_host} onChange={handleChange}
              placeholder="smtp.gmail.com"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Puerto</label>
            <input name="smtp_port" value={form.smtp_port} onChange={handleChange} type="number"
              placeholder="587"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Usuario (email)</label>
            <input name="smtp_user" value={form.smtp_user} onChange={handleChange} type="email"
              placeholder="tucuenta@gmail.com"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">
              Contraseña / App Password
              {config?.smtp_user && (
                <span className="ml-2 text-green-400 text-xs">● cifrada</span>
              )}
            </label>
            <div className="relative">
              <input name="smtp_password" value={form.smtp_password} onChange={handleChange}
                type={showPass ? 'text' : 'password'}
                placeholder={config?.smtp_user ? 'Dejar vacío para mantener la actual' : 'xxxx xxxx xxxx xxxx'}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all pr-8" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPass
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Nombre del remitente</label>
            <input name="smtp_from_name" value={form.smtp_from_name} onChange={handleChange}
              placeholder="Sistema Legajos"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">Email remitente</label>
            <input name="smtp_from_email" value={form.smtp_from_email} onChange={handleChange} type="email"
              placeholder="tucuenta@gmail.com"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
          </div>
        </div>
      </div>

      {/* Sección notificaciones */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
        <h2 className="text-sm font-medium mb-1">Notificaciones</h2>
        <p className="text-zinc-500 text-xs mb-5">Email que recibe las alertas de legajos nuevos y eventos del sistema.</p>
        <div>
          <label className="block text-zinc-400 text-xs mb-1.5">Email del evaluador / administrador</label>
          <input name="notif_evaluador_email" value={form.notif_evaluador_email} onChange={handleChange} type="email"
            placeholder="evaluador@empresa.com"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
        </div>
        <div className="mt-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-medium mb-2">Emails que se envían automáticamente</p>
          <ul className="space-y-1.5 text-xs text-zinc-500">
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"/><span>Nuevo legajo recibido → al evaluador</span></li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"/><span>Legajo aprobado → al proveedor</span></li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"/><span>Legajo rechazado → al proveedor</span></li>
          </ul>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 border ${
          testResult.ok
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <span className="text-sm">{testResult.ok ? '✓' : '✗'} {testResult.msg}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors">
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={handleTest}
          disabled={testing || !form.smtp_user || !form.notif_evaluador_email}
          className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-zinc-300 font-medium rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-40">
          {testing ? 'Enviando...' : 'Enviar email de prueba'}
        </button>
      </div>

    </form>
  )
}
