'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function CambiarPasswordColaboradorPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Error al cambiar la contraseña. El link puede haber expirado.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  const inputCls = "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"

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
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-white font-medium text-xl mb-1">Nueva contraseña</h1>
          <p className="text-zinc-500 text-sm mb-6">Elegí una contraseña segura para tu cuenta.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Nueva contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  placeholder="Mínimo 8 caracteres" className={inputCls + ' pr-10'}/>
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
              {/* Indicador de fortaleza */}
              {password && (
                <div className="flex gap-1 mt-1.5">
                  {[8, 12, 16].map((min, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                      password.length >= min
                        ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : 'bg-green-400'
                        : 'bg-white/[0.08]'
                    }`}/>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Confirmar contraseña *</label>
              <input type="password" value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)} required
                placeholder="Repetí la contraseña" className={inputCls}/>
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-red-400 text-xs mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><span className="text-red-400 text-sm">{error}</span></div>}
            <button type="submit" disabled={loading || password !== passwordConfirm || password.length < 8}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
