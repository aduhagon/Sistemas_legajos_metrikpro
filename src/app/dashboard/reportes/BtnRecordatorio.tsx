'use client'

import { useState } from 'react'

export default function BtnRecordatorio({ proveedorId }: { proveedorId: string }) {
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function enviar() {
    setEstado('loading')
    try {
      const res = await fetch('/api/email/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'vencimiento_proximo', proveedor_id: proveedorId }),
      })
      const data = await res.json()
      setEstado(data.ok ? 'ok' : 'error')
    } catch {
      setEstado('error')
    }
    setTimeout(() => setEstado('idle'), 3000)
  }

  if (estado === 'ok') {
    return <span className="text-green-400 text-xs">✓ Enviado</span>
  }
  if (estado === 'error') {
    return <span className="text-red-400 text-xs">Error</span>
  }

  return (
    <button
      onClick={enviar}
      disabled={estado === 'loading'}
      title="Enviar recordatorio al proveedor"
      className="flex items-center gap-1 text-zinc-600 hover:text-zinc-300 text-xs transition-colors disabled:opacity-40">
      {estado === 'loading' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      )}
      {estado === 'loading' ? 'Enviando...' : 'Recordatorio'}
    </button>
  )
}
