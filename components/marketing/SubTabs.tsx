'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Sub-view state kept in the URL (?view=...). Links like
 * /admin/marketing/messages?view=send therefore work from anywhere, including
 * old bookmarks that are redirected here. Needs a <Suspense> ancestor.
 */
export function useView<T extends string>(def: T, allowed: readonly T[]): [T, (v: T) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('view') as T | null
  const view: T = raw && allowed.includes(raw) ? raw : def
  const setView = (v: T) => {
    const next = new URLSearchParams(params.toString())
    next.set('view', v)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
  return [view, setView]
}

export function SubTabs<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar mb-4">
      <div className="flex gap-2 w-max">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition ${
              value === t.id
                ? 'bg-brand-blue border-brand-blue text-white'
                : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
