'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Share2, Mail, Target, TrendingUp, ScrollText, Radio } from 'lucide-react'

const TABS = [
  { href: '/admin/marketing/social', label: 'Social', Icon: Share2 },
  { href: '/admin/marketing/messages', label: 'Messages', Icon: Mail },
  { href: '/admin/marketing/outreach', label: 'Outreach', Icon: Target },
  { href: '/admin/marketing/advisor', label: 'Advisor', Icon: TrendingUp },
  { href: '/admin/marketing/activity', label: 'Activity', Icon: ScrollText },
]

/**
 * Marketing hub. One place for everything that reaches people outside the
 * weekly meeting. The pages inside still carry their own "← Dashboard" links,
 * which the arbitrary-variant class below hides (the sidebar already covers it).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-7xl mx-auto">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-blue" /> Marketing
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Social posts · messages · outreach · growth advisor · activity</p>

        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mt-4 overflow-x-auto no-scrollbar border-b border-gray-800">
          <div className="flex gap-1 w-max">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                    active ? 'border-brand-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-200'
                  }`}
                >
                  <t.Icon className="w-4 h-4" /> {t.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="[&_a[href='/admin']]:hidden">
        <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>{children}</Suspense>
      </div>
    </div>
  )
}
