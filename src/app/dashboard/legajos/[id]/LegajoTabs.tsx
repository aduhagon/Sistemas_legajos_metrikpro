'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Tab = 'documentos' | 'equipos' | 'auditorias' | 'historial'

const TABS: { key: Tab; label: string }[] = [
  { key: 'documentos', label: 'Documentos' },
  { key: 'equipos',    label: 'Equipos'    },
  { key: 'auditorias', label: 'Auditorías' },
  { key: 'historial',  label: 'Historial'  },
]

export default function LegajoTabs({
  tabActivo,
  badgeDocsPendientes,
  badgeEquiposPendientes,
  badgeAuditoriasPendientes,
}: {
  tabActivo: Tab
  badgeDocsPendientes: number
  badgeEquiposPendientes: number
  badgeAuditoriasPendientes: number
}) {
  const router   = useRouter()
  const pathname = usePathname()

  function irA(tab: Tab) {
    router.push(`${pathname}?tab=${tab}`)
  }

  function badge(tab: Tab) {
    if (tab === 'documentos' && badgeDocsPendientes > 0)
      return <span className="ml-1.5 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{badgeDocsPendientes}</span>
    if (tab === 'equipos' && badgeEquiposPendientes > 0)
      return <span className="ml-1.5 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{badgeEquiposPendientes}</span>
    if (tab === 'auditorias' && badgeAuditoriasPendientes > 0)
      return <span className="ml-1.5 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">{badgeAuditoriasPendientes}</span>
    return null
  }

  return (
    <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => irA(t.key)}
          className={`flex items-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tabActivo === t.key
              ? 'bg-white/[0.08] text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}>
          {t.label}
          {badge(t.key)}
        </button>
      ))}
    </div>
  )
}
