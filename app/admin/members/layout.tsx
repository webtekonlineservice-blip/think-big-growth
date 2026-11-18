'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/members', label: 'Members', exact: true },
  { href: '/admin/members/seats', label: 'Seats', exact: false },
]

/** Members hub: the roster plus the seat tracker, side by side. */
export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div>
      <div className="px-4 sm:px-6 pt-3 border-b border-gray-800">
        <div className="flex gap-1 max-w-7xl mx-auto">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  active ? 'border-brand-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-200'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="[&_a[href='/admin']]:hidden">{children}</div>
    </div>
  )
}
