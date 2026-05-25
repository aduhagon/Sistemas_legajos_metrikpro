// ============================================================
// /app/superadmin/tenants/[id]/TabsNav.tsx
// Navegación entre tabs vía ?tab=...
// ============================================================
'use client'

import { useRouter, useSearchParams, useParams } from 'next/navigation'

const TABS = [
  { key: 'general',  label: 'General' },
  { key: 'modulos',  label: 'Módulos' },
  { key: 'admins',   label: 'Admins' },
  { key: 'datos',    label: 'Datos del cliente' },
  { key: 'config',   label: 'Branding & SMTP' },
  { key: 'notas',    label: 'Notas' },
] as const

export default function TabsNav({ tabActiva }: { tabActiva: string }) {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sp = useSearchParams()

  function irA(tab: string) {
    const usp = new URLSearchParams(sp.toString())
    if (tab === 'general') usp.delete('tab')
    else                   usp.set('tab', tab)
    const qs = usp.toString()
    router.push(`/superadmin/tenants/${params.id}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="border-b border-gray-800 flex gap-1 overflow-x-auto">
      {TABS.map(t => {
        const activo = tabActiva === t.key
        return (
          <button
            key={t.key}
            onClick={() => irA(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              activo
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
