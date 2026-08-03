'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SessionUser {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

interface Visitor {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  business_type: string
  status: 'invited' | 'visited' | 'applied' | 'member'
  referral_source: string
  invited_by: string
  created_at: string
}

interface Stats {
  totalMembers: number
  visitorsThisMonth: number
  conversionRate: number
}

const STATUS_STYLES: Record<Visitor['status'], string> = {
  invited: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  visited: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  applied: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  member: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [stats, setStats] = useState<Stats>({ totalMembers: 0, visitorsThisMonth: 0, conversionRate: 0 })
  const [loading, setLoading] = useState(true)
  const [smsModal, setSmsModal] = useState<{ open: boolean; visitorId: string; phone: string } | null>(null)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)

  const fetchAdminData = useCallback(async (allVisitors: Visitor[]) => {
    try {
      const membersRes = await fetch('/api/members')
      if (membersRes.ok) {
        const members = await membersRes.json()
        const now = new Date()
        const thisMonth = allVisitors.filter((v) => {
          const d = new Date(v.created_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        const converted = allVisitors.filter((v) => v.status === 'member').length
        setStats({
          totalMembers: members.length,
          visitorsThisMonth: thisMonth.length,
          conversionRate: allVisitors.length > 0
            ? Math.round((converted / allVisitors.length) * 100)
            : 0,
        })
      }
    } catch {
      // Non-fatal
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) {
          router.push('/member/login')
          return
        }
        const { user: sessionUser } = await res.json() as { user: SessionUser }

        if (!sessionUser.is_admin) {
          router.push('/member')
          return
        }

        setUser(sessionUser)

        // Fetch visitors first so stats can use the fresh data
        const visitorsRes = await fetch('/api/visitors')
        if (visitorsRes.ok) {
          const data: Visitor[] = await visitorsRes.json()
          setVisitors(data)
          await fetchAdminData(data)
        }
      })
      .catch(() => {
        router.push('/member/login')
      })
      .finally(() => setLoading(false))
  }, [router, fetchAdminData])

  const handleStatusChange = async (id: string, status: Visitor['status']) => {
    try {
      await fetch(`/api/visitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setVisitors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status } : v))
      )
    } catch {
      // Non-fatal
    }
  }

  const handleSendSms = async () => {
    if (!smsModal || !smsMessage.trim()) return
    setSmsSending(true)
    try {
      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: smsModal.phone, message: smsMessage }),
      })
      setSmsModal(null)
      setSmsMessage('')
    } catch {
      // Non-fatal
    } finally {
      setSmsSending(false)
    }
  }

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-blue animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">Think Big St. Louis · {user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {[
                { label: 'Overview', href: '/admin' },
                { label: 'Visitors', href: '/admin/visitors' },
                { label: 'Members', href: '/admin/members' },
                { label: 'Campaigns', href: '/admin/campaigns' },
                { label: 'Outbound', href: '/admin/outbound' },
                { label: 'Analytics', href: '/admin/analytics' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="w-px h-4 bg-gray-700" />
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Total Members</p>
            <p className="text-4xl font-bold text-white">{stats.totalMembers}</p>
            <p className="text-xs text-gray-500">Active chapter members</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Visitors This Month</p>
            <p className="text-4xl font-bold text-brand-orange">{stats.visitorsThisMonth}</p>
            <p className="text-xs text-gray-500">New visitor registrations</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Conversion Rate</p>
            <p className="text-4xl font-bold text-green-400">{stats.conversionRate}%</p>
            <p className="text-xs text-gray-500">Visitors who became members</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/admin/visitors" className="card flex items-center gap-4 hover:border-brand-blue/40 transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-brand-blue/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Visitor Pipeline</p>
              <p className="text-gray-500 text-xs">Manage all visitors, status &amp; notes</p>
            </div>
          </a>
          <a href="/admin/members" className="card flex items-center gap-4 hover:border-brand-orange/40 transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-brand-orange/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Member Management</p>
              <p className="text-gray-500 text-xs">Add, edit, and manage member accounts</p>
            </div>
          </a>
          <a href="/admin/campaigns" className="card flex items-center gap-4 hover:border-purple-500/40 transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Campaigns</p>
              <p className="text-gray-500 text-xs">Send bulk SMS & email to segments</p>
            </div>
          </a>
          <a href="/admin/analytics" className="card flex items-center gap-4 hover:border-green-500/40 transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Analytics</p>
              <p className="text-gray-500 text-xs">Pipeline, conversion rate & top inviters</p>
            </div>
          </a>
        </div>

        {/* Visitors table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">All Visitors</h2>
            <span className="text-sm text-gray-400">{visitors.length} total</span>
          </div>

          {visitors.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm">No visitors yet.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-700">
                    {['Name', 'Company', 'Business Type', 'Contact', 'Referred By', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v, i) => (
                    <tr
                      key={v.id}
                      className={`${i < visitors.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-700/20 transition-colors`}
                    >
                      <td className="px-4 pl-6 py-3 text-white font-medium">
                        {v.first_name} {v.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{v.company}</td>
                      <td className="px-4 py-3 text-gray-400">{v.business_type}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-300 text-xs">{v.email}</p>
                        <p className="text-gray-500 text-xs">{v.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{v.invited_by || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={v.status}
                          onChange={(e) => handleStatusChange(v.id, e.target.value as Visitor['status'])}
                          className={`text-xs font-medium border rounded-full px-2.5 py-0.5 bg-transparent cursor-pointer ${STATUS_STYLES[v.status]}`}
                        >
                          <option value="invited">Invited</option>
                          <option value="visited">Visited</option>
                          <option value="applied">Applied</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="px-4 pr-6 py-3">
                        <button
                          onClick={() => setSmsModal({ open: true, visitorId: v.id, phone: v.phone })}
                          className="text-xs text-brand-blue hover:text-white transition-colors"
                        >
                          Send SMS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* SMS Modal */}
      {smsModal?.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-1">Send SMS</h3>
            <p className="text-sm text-gray-400 mb-4">To: {smsModal.phone}</p>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={4}
              placeholder="Type your message…"
              className="input-field resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSmsModal(null); setSmsMessage('') }}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSms}
                disabled={smsSending || !smsMessage.trim()}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {smsSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
