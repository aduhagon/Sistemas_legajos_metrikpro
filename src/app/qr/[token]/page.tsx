import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export default async function QRValidacionPage({ params }: { params: { token: string } }) {
  const supabase = createClient()

  // Validar QR usando la función que ya existe en Supabase
  const { data: resultado } = await supabase
    .rpc('validar_qr', { p_qr_token: params.token })

  if (!resultado) notFound()

  const valido = resultado.valido
  const fechaVenc = resultado.fecha_venc
    ? new Date(resultado.fecha_venc).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
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
        </div>

        {/* Card resultado */}
        <div className={`rounded-2xl border p-8 text-center ${
          valido
            ? 'bg-green-500/5 border-green-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}>
          {/* Ícono */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
            valido ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            {valido ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>

          {/* Estado */}
          <h1 className={`text-2xl font-semibold mb-2 ${valido ? 'text-green-400' : 'text-red-400'}`}>
            {valido ? 'Acceso habilitado' : 'Acceso denegado'}
          </h1>

          {/* Datos del proveedor */}
          {resultado.razon_social && (
            <div className="mb-4">
              <p className="text-white text-lg font-medium">{resultado.razon_social}</p>
              <p className="text-zinc-500 text-sm">CUIT {resultado.cuit}</p>
            </div>
          )}

          {/* Motivo si está denegado */}
          {!valido && resultado.motivo && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-300 text-sm">
                {resultado.motivo === 'QR no encontrado'      ? 'QR no reconocido por el sistema' :
                 resultado.motivo === 'VENCIDA'               ? 'Habilitación vencida' :
                 resultado.motivo === 'SUSPENDIDA'            ? 'Habilitación suspendida' :
                 resultado.motivo === 'DOC_PENDIENTE'         ? 'Documentación pendiente' :
                 resultado.motivo === 'HABILITACION_VENCIDA'  ? 'Habilitación vencida' :
                 resultado.motivo}
              </p>
            </div>
          )}

          {/* Vigencia */}
          {valido && fechaVenc && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <p className="text-green-300 text-sm">Vigente hasta el {fechaVenc}</p>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Verificado el {new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>

      </div>
    </div>
  )
}
