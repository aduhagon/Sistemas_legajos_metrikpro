'use client'

import { useState } from 'react'

export default function AccionesRapidasLegajo({
  proveedorId,
  proveedorEmail,
  qrToken,
}: {
  proveedorId: string
  proveedorEmail: string
  qrToken: string | null
}) {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado]   = useState(false)

  async function enviarRecordatorio() {
    setEnviando(true)
    try {
      const res = await fetch('/api/email/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'vencimiento_proximo', proveedor_id: proveedorId }),
      })
      const data = await res.json()
      if (data.ok) { setEnviado(true); setTimeout(() => setEnviado(false), 3000) }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Ver QR */}
      {qrToken && (
        <a
          href={`/qr/${qrToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/>
            <line x1="14" y1="14" x2="21" y2="14"/><line x1="21" y1="18" x2="21" y2="21"/>
            <line x1="18" y1="21" x2="21" y2="21"/>
          </svg>
          Ver QR
        </a>
      )}

      {/* Enviar recordatorio */}
      <button
        onClick={enviarRecordatorio}
        disabled={enviando}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all disabled:opacity-40">
        {enviando ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        )}
        {enviado ? '✓ Enviado' : enviando ? 'Enviando...' : 'Recordatorio'}
      </button>
    </div>
  )
}
