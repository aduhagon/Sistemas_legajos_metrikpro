// src/app/cambiar-password/page.tsx
// Página de cambio de contraseña post-reset
// El usuario llega acá después de hacer clic en el email de recovery

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [password, setPassword]       = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const [ok, setOk]                   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setOk(true)
      // Redirigir al login después de 2 segundos
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Error al cambiar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">S</div>
          <h1 className="text-white text-xl font-semibold">Cambiar contraseña</h1>
          <p className="text-zinc-500 text-sm mt-1">Ingresá tu nueva contraseña</p>
        </div>

        {ok ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
            <p className="text-green-400 font-medium mb-1">✓ Contraseña actualizada</p>
            <p className="text-zinc-500 text-sm">Redirigiendo al login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-sm mb-1.5 block">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1.5 block">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repetí la contraseña"
                required
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={guardando || !password || !confirmar}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
