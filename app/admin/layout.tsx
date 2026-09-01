'use client'
'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Users, UserCircle, Send, Mail,
  FlaskConical, BarChart3, ScrollText, Target, LogOut, Menu,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', Icon: LayoutDashboard },
  { label: 'Visitors', href: '/admin/visitors', Icon: Users },
  { label: 'Members', href: '/admin/members', Icon: UserCircle },
  { label: 'Prospects', href: '/admin/prospects', Icon: Target },
  { label: 'Outbound', href: '/admin/outbound', Icon: Send },
  { label: 'Campaigns', href: '/admin/campaigns', Icon: Mail },
  { label: 'Email Test', href: '/admin/email-test', Icon: FlaskConical },
  { label: 'Analytics', href: '/admin/analytics', Icon: BarChart3 },
  { label: 'Send Log', href: '/admin/send-log', Icon: ScrollText },
]

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-950 border-r border-gray-800 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
            <Image
              src="/logo.png"
              alt="Webtek.ai"
              width={100}
              height={32}
              className="object-contain transition-all duration-300 group-hover:brightness-110"
            />
          </Link>
          {/* Close button (mobile only) */}
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="px-5 pt-3 text-[10px] text-gray-600 uppercase tracking-widest">Command Center</p>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-red/15 text-white border border-brand-red/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <item.Icon className={`w-5 h-5 ${isActive ? 'text-brand-red' : 'text-gray-500'}`} strokeWidth={1.75} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-2">
          <a
            href="/api/auth/logout"
            onClick={async (e) => {
              e.preventDefault()
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/'
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign Out
          </a>
          <p className="px-3 text-[10px] text-gray-700">v0.01 beta</p>
        </div>
      </aside>
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Image src="/logo.png" alt="Webtek.ai" width={80} height={26} className="object-contain" />
        <div className="w-6" /> {/* spacer */}
      </div>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
