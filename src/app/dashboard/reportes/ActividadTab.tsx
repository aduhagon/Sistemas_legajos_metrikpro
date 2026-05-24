'use client'

import Link from 'next/link'

type EventoActividad = {
  id: string
  accion: string
  entidad: string
  entidad_id: string | null
  user_id: string | null
  datos_json: any
  created_at: string
  usuario_nombre: string | null
  proveedor_nombre: string | null
  proveedor_id: string | null
  doc_nombre: string | null
}

// Traduce cada combinación accion+entidad a texto de negocio
function describir(ev: EventoActividad): {
  icono: string
  color: string
  bgColor: string
  texto: React.ReactNode
} {
  const actor = ev.usuario_nombre ?? 'Sistema'
  const proveedor = ev.proveedor_nombre
  const doc = ev.doc_nombre

  // Link al legajo si hay proveedor_id
  const linkProveedor = ev.proveedor_id
    ? <Link href={`/dashboard/legajos/${ev.proveedor_id}`}
        className="font-medium text-white hover:text-blue-300 transition-colors">
        {proveedor}
      </Link>
    : <span className="font-medium text-white">{proveedor ?? '—'}</span>

  switch (ev.accion) {
    case 'APROBADO':
      if (ev.entidad === 'proveedores') return {
        icono: '✓', color: 'text-green-400', bgColor: 'bg-green-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> aprobó el legajo de {linkProveedor}</>,
      }
      if (ev.entidad === 'documentos_legajo') return {
        icono: '✓', color: 'text-green-400', bgColor: 'bg-green-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> aprobó <span className="text-zinc-300">{doc ?? 'un documento'}</span>{proveedor && <> de {linkProveedor}</>}</>,
      }
      if (ev.entidad === 'documentos_equipo') return {
        icono: '✓', color: 'text-green-400', bgColor: 'bg-green-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> aprobó doc. de equipo{proveedor && <> de {linkProveedor}</>}</>,
      }
      break

    case 'RECHAZADO':
      if (ev.entidad === 'proveedores') return {
        icono: '✗', color: 'text-red-400', bgColor: 'bg-red-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> rechazó el legajo de {linkProveedor}</>,
      }
      if (ev.entidad === 'documentos_legajo') return {
        icono: '✗', color: 'text-red-400', bgColor: 'bg-red-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> rechazó <span className="text-zinc-300">{doc ?? 'un documento'}</span>{proveedor && <> de {linkProveedor}</>}</>,
      }
      break

    case 'PRESENTACION':
      return {
        icono: '↑', color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        texto: <>
          {linkProveedor} cargó <span className="text-zinc-300">{doc ?? 'un documento'}</span>
          {ev.datos_json?.primera_presentacion && <span className="text-zinc-600 ml-1">(primera vez)</span>}
        </>,
      }

    case 'REGISTRO_PROVEEDOR':
      return {
        icono: '+', color: 'text-blue-400', bgColor: 'bg-blue-500/10',
        texto: <>{linkProveedor ?? <span className="text-zinc-300">Nuevo proveedor</span>} se registró en el sistema</>,
      }

    case 'REGISTRO_EQUIPO':
      return {
        icono: '🚗', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10',
        texto: <>
          {linkProveedor ?? <span className="text-zinc-300">Un proveedor</span>} registró un equipo
          {ev.datos_json?.dominio && <span className="text-zinc-500 ml-1 font-mono text-xs">({ev.datos_json.dominio})</span>}
        </>,
      }

    case 'VISITA_REGISTRADA':
      return {
        icono: '📋', color: 'text-purple-400', bgColor: 'bg-purple-500/10',
        texto: <>
          <span className="text-zinc-400">{actor}</span> registró una visita de auditoría
          {ev.datos_json?.resultado && (
            <span className={`ml-1 text-xs ${
              ev.datos_json.resultado === 'CONFORME' ? 'text-green-400' :
              ev.datos_json.resultado === 'URGENTE' ? 'text-red-400' : 'text-yellow-400'
            }`}>— {ev.datos_json.resultado.toLowerCase()}</span>
          )}
        </>,
      }

    case 'VISITA_APROBADA':
      return {
        icono: '✓', color: 'text-green-400', bgColor: 'bg-green-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> aprobó una visita de auditoría</>,
      }

    case 'VISITA_RECHAZADA':
      return {
        icono: '✗', color: 'text-red-400', bgColor: 'bg-red-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> rechazó una visita de auditoría</>,
      }

    case 'SUSPENDIDO':
      return {
        icono: '⏸', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10',
        texto: <><span className="text-zinc-400">{actor}</span> suspendió a {linkProveedor}</>,
      }

    case 'CRON_VENCIMIENTOS':
    case 'CRON_VENCIMIENTOS_EQUIPOS': {
      const venc = ev.datos_json?.vencidos ?? 0
      const porV = ev.datos_json?.porVencer ?? ev.datos_json?.por_vencer ?? 0
      return {
        icono: '⏰', color: 'text-zinc-600', bgColor: 'bg-zinc-500/5',
        texto: <>
          <span className="text-zinc-600">Cron de vencimientos</span>
          {(venc > 0 || porV > 0) && (
            <span className="text-zinc-600 ml-1">
              — {venc > 0 && `${venc} vencido${venc !== 1 ? 's' : ''}`}
              {venc > 0 && porV > 0 && ', '}
              {porV > 0 && `${porV} por vencer`}
            </span>
          )}
        </>,
      }
    }
  }

  // Fallback para acciones no mapeadas
  return {
    icono: '·', color: 'text-zinc-600', bgColor: 'bg-zinc-500/10',
    texto: <span className="text-zinc-600">{ev.accion.replace(/_/g, ' ').toLowerCase()}</span>,
  }
}

export default function ActividadTab({ actividad }: { actividad: EventoActividad[] }) {
  if (actividad.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-zinc-500 text-sm">Sin actividad registrada</p>
      </div>
    )
  }

  // Agrupar eventos consecutivos del mismo actor+acción en la misma sesión (±5 min)
  const grupos: EventoActividad[][] = []
  for (const ev of actividad) {
    const ultimo = grupos[grupos.length - 1]
    const ultimoEv = ultimo?.[ultimo.length - 1]
    const mismaSesion =
      ultimoEv &&
      ultimoEv.user_id === ev.user_id &&
      ultimoEv.accion === ev.accion &&
      ultimoEv.entidad === ev.entidad &&
      Math.abs(new Date(ultimoEv.created_at).getTime() - new Date(ev.created_at).getTime()) < 5 * 60 * 1000

    if (mismaSesion) {
      ultimo.push(ev)
    } else {
      grupos.push([ev])
    }
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {grupos.map((grupo, gi) => {
        const ev = grupo[0]
        const desc = describir(ev)
        const esBatch = grupo.length > 1
        const esCron = ev.accion.startsWith('CRON_')

        return (
          <div key={ev.id} className={`px-5 py-3 flex items-start gap-3 ${esCron ? 'opacity-40' : ''}`}>
            {/* Ícono */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-medium ${desc.bgColor} ${desc.color}`}>
              {desc.icono}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">
                {desc.texto}
              </p>
              {/* Badge de batch */}
              {esBatch && (
                <span className="inline-block mt-0.5 text-xs text-zinc-600 bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {grupo.length} acciones similares agrupadas
                </span>
              )}
            </div>

            {/* Fecha */}
            <span className="text-zinc-700 text-xs shrink-0 mt-0.5">
              {new Date(ev.created_at).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
