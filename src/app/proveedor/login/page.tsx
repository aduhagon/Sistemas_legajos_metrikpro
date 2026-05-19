'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function ProveedorLoginPage() {
  const [modo, setModo] = useState<'login' | 'recuperar'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err || !data.user) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Pequeña espera para que el token JWT se propague
    await new Promise(r => setTimeout(r, 500))

    // Verificar que es proveedor usando el access token directamente
    const { data: puData, error: puErr } = await supabase
      .from('proveedores_usuarios')
      .select('proveedor_id, rol')
      .eq('user_id', data.user.id)
      .eq('activo', true)
      .maybeSingle()

    if (puErr) {
      // Si hay error de RLS, intentar de nuevo después de otro delay
      await new Promise(r => setTimeout(r, 1000))
      const { data: puData2, error: puErr2 } = await supabase
        .from('proveedores_usuarios')
        .select('proveedor_id, rol')
        .eq('user_id', data.user.id)
        .eq('activo', true)
        .maybeSingle()

      if (puErr2 || !puData2) {
        await supabase.auth.signOut()
        setError('Esta cuenta no está asociada a ningún proveedor')
        setLoading(false)
        return
      }
    } else if (!puData) {
      await supabase.auth.signOut()
      setError('Esta cuenta no está asociada a ningún proveedor')
      setLoading(false)
      return
    }

    // Redirigir con recarga completa
    window.location.replace('/proveedor/portal')
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/proveedor-callback?type=recovery`,
    })
    if (err) {
      setError('Error al enviar el email.')
    } else {
      setMensaje('Te enviamos un link para restablecer tu contraseña.')
    }
    setLoading(false)
  }

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"

  // Detectar mensaje de éxito de cambio de contraseña
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const mostrarExito = params?.get('msg') === 'password_actualizado'

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
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
          <p className="text-zinc-500 text-sm">Portal del proveedor</p>
        </div>

        {mostrarExito && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-green-400 text-sm">✓ Contraseña actualizada. Ingresá con tu nueva contraseña.</p>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
          {modo === 'login' ? (
            <>
              <h1 className="text-white font-medium text-xl mb-2">Ingresá a tu cuenta</h1>
              <p className="text-zinc-500 text-sm mb-6">Accedé a tu legajo, documentos y carnet QR.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-sm mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required placeholder="tu@email.com" className={inputCls}/>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 text-sm">Contraseña</label>
                    <button type="button" onClick={() => { setModo('recuperar'); setError('') }}
                      className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••" className={inputCls + ' pr-10'}/>
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
                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <a href="/proveedor/registro" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  Registrarse →
                </a>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-white font-medium text-xl mb-2">Recuperar contraseña</h1>
              <p className="text-zinc-500 text-sm mb-6">Te enviamos un link a tu email.</p>
              {mensaje ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <p className="text-green-400 text-sm">{mensaje}</p>
                  <p className="text-zinc-500 text-xs mt-2">Revisá también la carpeta de spam.</p>
                </div>
              ) : (
                <form onSubmit={handleRecuperar} className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1.5">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required placeholder="tu@email.com" className={inputCls}/>
                  </div>
                  {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                    {loading ? 'Enviando...' : 'Enviar link'}
                  </button>
                </form>
              )}
              <button onClick={() => { setModo('login'); setError(''); setMensaje('') }}
                className="mt-4 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
                ← Volver al login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
