// src/app/qr-personal/[token]/page.tsx
// Carnet QR público para personal habilitado
// Muestra nombre + CUIL para verificación en puerta

import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export default async function QRPersonalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createClient()

  const { data: resultado } = await supabase.rpc('validar_qr_personal', {
    p_qr_token: token,
  })

  if (!resultado) notFound()

  const valido   = resultado.valido
  const nombre   = resultado.nombre
  const cuil     = resultado.cuil
  const motivo   = resultado.motivo
  const establecimientos: { id: string; nombre: string }[] = resultado.establecimientos ?? []

  const motivoLabel: Record<string, string> = {
    PERSONA_INACTIVA:              'Persona dada de baja — sin acceso habilitado',
    ESTABLECIMIENTO_NO_HABILITADO: 'No habilitado para este establecimiento',
    'QR no reconocido':            'QR no reconocido por el sistema',
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight">Sistema Legajos</span>
          </div>
          <p className="text-zinc-500 text-xs mt-1">Personal habilitado</p>
        </div>

        {/* Card principal */}
        <div className={`rounded-2xl border p-8 text-center ${
          valido
            ? 'bg-green-500/5 border-green-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}>

          {/* Ícono de estado */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
            valido ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            {valido ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>

          {/* Estado */}
          <h1 className={`text-xl font-semibold mb-5 ${valido ? 'text-green-400' : 'text-red-400'}`}>
            {valido ? 'Acceso habilitado' : 'Acceso denegado'}
          </h1>

          {/* Datos de la persona — siempre visibles si existen */}
          {nombre && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4 mb-4 text-left">
              <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wide font-medium">Nombre</p>
              <p className="text-white text-xl font-semibold">{nombre}</p>
              {cuil && (
                <>
                  <p className="text-zinc-500 text-xs mt-3 mb-1 uppercase tracking-wide font-medium">CUIL</p>
                  <p className="text-zinc-200 text-lg font-mono tracking-widest">{cuil}</p>
                </>
              )}
            </div>
          )}

          {/* Establecimientos habilitados */}
          {valido && establecimientos.length > 0 && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-left">
              <p className="text-green-400 text-xs font-medium mb-2 uppercase tracking-wide">
                Habilitado en
              </p>
              <ul className="space-y-1">
                {establecimientos.map(e => (
                  <li key={e.id} className="text-green-300 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>
                    {e.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Motivo de rechazo */}
          {!valido && motivo && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-2">
              <p className="text-red-300 text-sm">
                {motivoLabel[motivo] ?? motivo}
              </p>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Verificado el{' '}
          {new Date().toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
