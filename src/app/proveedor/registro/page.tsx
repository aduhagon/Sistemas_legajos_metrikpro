'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function ProveedorRegistroPage() {
  const [step, setStep] = useState<'cuenta' | 'empresa' | 'esperando'>('cuenta')
  const [rubros, setRubros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')

  const [cuenta, setCuenta] = useState({ email: '', password: '', passwordConfirm: '', nombre: '' })
  const [empresa, setEmpresa] = useState({
    razon_social: '', cuit: '', tipo_proveedor: 'PJ',
    rubro_id: '', telefono: '', notif_vencimientos: false,
  })

  useEffect(() => {
    supabase.from('rubros').select('id, codigo, nombre').eq('activo', true).order('codigo')
      .then(({ data }) => { if (data) setRubros(data) })
  }, [])

  async function handleCuenta(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (cuenta.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (cuenta.password !== cuenta.passwordConfirm) { setError('Las contraseñas no coinciden'); return }
    setStep('empresa')
  }

  async function handleEmpresa(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Guardar datos de la empresa en la base de datos hasta que confirme el email
    const datosRegistro = {
      razon_social:       empresa.razon_social,
      cuit:               empresa.cuit.replace(/[-\s]/g, ''),
      tipo_proveedor:     empresa.tipo_proveedor,
      rubro_id:           empresa.rubro_id,
      email:              cuenta.email,
      telefono:           empresa.telefono || null,
      notif_vencimientos: empresa.notif_vencimientos,
      nombre:             cuenta.nombre,
    }

    await supabase.rpc('guardar_registro_pendiente', {
      p_email: cuenta.email,
      p_datos: datosRegistro,
    })

    // Crear cuenta en Supabase Auth — manda email de confirmación
    const { error: authError } = await supabase.auth.signUp({
      email: cuenta.email,
      password: cuenta.password,
      options: {
        data: { nombre: cuenta.nombre },
        emailRedirectTo: `${window.location.origin}/auth/proveedor-callback`,
      }
    })

    if (authError) {
      sessionStorage.removeItem('registro_proveedor_pendiente')
      setError(
        authError.message === 'User already registered'
          ? 'Ya existe una cuenta con ese email. Intentá iniciar sesión.'
          : authError.message ?? 'Error al crear la cuenta'
      )
      setLoading(false)
      return
    }

    setEmailEnviado(cuenta.email)
    setStep('esperando')
    setLoading(false)
  }

  async function reenviarEmail() {
    setLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailEnviado,
      options: { emailRedirectTo: `${window.location.origin}/auth/proveedor-callback` }
    })
    setLoading(false)
    if (error) setError('Error al reenviar. Intentá de nuevo en unos minutos.')
    else setError('')
  }

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
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
            <span className="text-white font-semibold text-lg">Sistema Legajos</span>
          </div>
          <p className="text-zinc-500 text-sm">Registrá tu empresa</p>
        </div>

        {/* Progress */}
        {step !== 'esperando' && (
          <div className="flex items-center gap-2 mb-6">
            {['cuenta', 'empresa'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  step === s ? 'bg-blue-600 text-white' :
                  step === 'empresa' && s === 'cuenta' ? 'bg-green-600 text-white' :
                  'bg-white/[0.08] text-zinc-500'
                }`}>
                  {step === 'empresa' && s === 'cuenta' ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${step === s ? 'text-white' : 'text-zinc-600'}`}>
                  {s === 'cuenta' ? 'Tu cuenta' : 'Tu empresa'}
                </span>
                {i === 0 && <div className="flex-1 h-px bg-white/[0.08]"/>}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">

          {/* ── PASO 1: Cuenta ── */}
          {step === 'cuenta' && (
            <>
              <h2 className="text-white font-medium text-lg mb-1">Creá tu cuenta</h2>
              <p className="text-zinc-500 text-sm mb-6">Usarás este email y contraseña para ingresar al sistema.</p>
              <form onSubmit={handleCuenta} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Nombre completo *</label>
                  <input value={cuenta.nombre} onChange={e => setCuenta(c => ({ ...c, nombre: e.target.value }))}
                    required placeholder="Juan García" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Email *</label>
                  <input type="email" value={cuenta.email} onChange={e => setCuenta(c => ({ ...c, email: e.target.value }))}
                    required placeholder="tu@email.com" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Contraseña * (mín. 8 caracteres)</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={cuenta.password}
                      onChange={e => setCuenta(c => ({ ...c, password: e.target.value }))}
                      required placeholder="••••••••" className={inputCls + ' pr-10'}/>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showPass
                          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Confirmar contraseña *</label>
                  <input type="password" value={cuenta.passwordConfirm}
                    onChange={e => setCuenta(c => ({ ...c, passwordConfirm: e.target.value }))}
                    required placeholder="••••••••" className={inputCls}/>
                </div>
                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
                <button type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                  Continuar →
                </button>
              </form>
            </>
          )}

          {/* ── PASO 2: Empresa ── */}
          {step === 'empresa' && (
            <>
              <h2 className="text-white font-medium text-lg mb-1">Datos de tu empresa</h2>
              <p className="text-zinc-500 text-sm mb-6">Esta información quedará en tu legajo.</p>
              <form onSubmit={handleEmpresa} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Razón social *</label>
                  <input value={empresa.razon_social} onChange={e => setEmpresa(em => ({ ...em, razon_social: e.target.value }))}
                    required placeholder="Transportes García S.A." className={inputCls}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1.5">CUIT *</label>
                    <input value={empresa.cuit} onChange={e => setEmpresa(em => ({ ...em, cuit: e.target.value }))}
                      required placeholder="20-12345678-9" className={inputCls}/>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1.5">Tipo *</label>
                    <select value={empresa.tipo_proveedor} onChange={e => setEmpresa(em => ({ ...em, tipo_proveedor: e.target.value }))}
                      className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                      <option value="PJ">Persona Jurídica</option>
                      <option value="PF">Persona Física</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Rubro *</label>
                  <select value={empresa.rubro_id} onChange={e => setEmpresa(em => ({ ...em, rubro_id: e.target.value }))}
                    required className="w-full bg-[#1a1d27] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all">
                    <option value="">Seleccioná tu rubro</option>
                    {rubros.map(r => <option key={r.id} value={r.id}>{r.codigo}. {r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs mb-1.5">Teléfono</label>
                  <input value={empresa.telefono} onChange={e => setEmpresa(em => ({ ...em, telefono: e.target.value }))}
                    placeholder="+54 9 11 1234-5678" className={inputCls}/>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={empresa.notif_vencimientos}
                    onChange={e => setEmpresa(em => ({ ...em, notif_vencimientos: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border border-white/[0.2] accent-blue-500"/>
                  <div>
                    <span className="text-zinc-300 text-sm">Quiero recibir alertas de vencimiento</span>
                    <p className="text-zinc-600 text-xs mt-0.5">Te avisamos 7 días antes de que venza un documento</p>
                  </div>
                </label>
                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setStep('cuenta'); setError('') }}
                    className="px-4 py-2.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                    ← Volver
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                    {loading ? 'Enviando...' : 'Completar registro'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── ESPERANDO CONFIRMACIÓN ── */}
          {step === 'esperando' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h2 className="text-white font-medium text-xl mb-2">Revisá tu email</h2>
              <p className="text-zinc-400 text-sm mb-2">
                Te enviamos un link de confirmación a:
              </p>
              <p className="text-white font-medium mb-4">{emailEnviado}</p>
              <p className="text-zinc-500 text-sm mb-6">
                Hacé clic en el link del email para activar tu cuenta y acceder a tu legajo.
              </p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left mb-4 space-y-1">
                <p className="text-zinc-500 text-xs font-medium">¿No lo recibiste?</p>
                <p className="text-zinc-600 text-xs">Revisá la carpeta de spam o correo no deseado</p>
                <p className="text-zinc-600 text-xs">El link expira en 24 horas</p>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3"><span className="text-red-400 text-sm">{error}</span></div>}
              <button onClick={reenviarEmail} disabled={loading}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors disabled:opacity-50">
                {loading ? 'Enviando...' : 'Reenviar email de confirmación'}
              </button>
            </div>
          )}
        </div>

        {step === 'cuenta' && (
          <p className="text-center text-zinc-600 text-xs mt-6">
            ¿Ya tenés cuenta?{' '}
            <a href="/proveedor/login" className="text-blue-400 hover:text-blue-300 transition-colors">Ingresá aquí</a>
          </p>
        )}
      </div>
    </div>
  )
}
