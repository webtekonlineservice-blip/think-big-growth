'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SessionUser { id: string; email: string; name: string; is_admin: boolean }

interface Visitor {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  business_type: string
  referral_source: string
  invited_by: string | null
  status: 'invited' | 'visited' | 'applied' | 'member'
  visit_date: string | null
  notes: string
  created_at: string
}

const STATUS_STYLES: Record<Visitor['status'], string> = {
  invited:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  visited:  'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  applied:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  member:   'bg-green-500/10 text-green-400 border-green-500/20',
}

const ALL_STATUSES = ['all', 'invited', 'visited', 'applied', 'member'] as const
type FilterStatus = typeof ALL_STATUSES[number]

export default function AdminVisitorsPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')

  // Notes / visit-date drawer
  const [drawer, setDrawer] = useState<Visitor | null>(null)
  const [drawerNotes, setDrawerNotes] = useState('')
  const [drawerVisitDate, setDrawerVisitDate] = useState('')
  const [drawerSaving, setDrawerSaving] = useState(false)

  // SMS modal
  const [smsModal, setSmsModal] = useState<{ phone: string; name: string } | null>(null)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)

  const fetchVisitors = useCallback(async () => {
    const res = await fetch('/api/visitors')
    if (res.ok) setVisitors(await res.json())
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user: u } = await res.json()
        if (!u.is_admin) { router.push('/member'); return }
        setUser(u)
        await fetchVisitors()
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router, fetchVisitors])

  const filtered = useMemo(() => {
    return visitors.filter((v) => {
      const matchStatus = statusFilter === 'all' || v.status === statusFilter
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        `${v.first_name} ${v.last_name}`.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.company.toLowerCase().includes(q) ||
        v.phone.includes(q)
      return matchStatus && matchSearch
    })
  }, [visitors, statusFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visitors.length }
    for (const s of ['invited', 'visited', 'applied', 'member']) {
      c[s] = visitors.filter((v) => v.status === s).length
    }
    return c
  }, [visitors])

  const handleStatusChange = async (id: string, status: Visitor['status']) => {
    await fetch(`/api/visitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)))
  }

  const openDrawer = (v: Visitor) => {
    setDrawer(v)
    setDrawerNotes(v.notes ?? '')
    setDrawerVisitDate(v.visit_date ? v.visit_date.slice(0, 10) : '')
  }

  const saveDrawer = async () => {
    if (!drawer) return
    setDrawerSaving(true)
    const updates: Record<string, unknown> = { notes: drawerNotes }
    if (drawerVisitDate) updates.visit_date = new Date(drawerVisitDate).toISOString()
    await fetch(`/api/visitors/${drawer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setVisitors((prev) =>
      prev.map((v) =>
        v.id === drawer.id
          ? { ...v, notes: drawerNotes, visit_date: drawerVisitDate ? new Date(drawerVisitDate).toISOString() : null }
          : v
      )
    )
    setDrawerSaving(false)
    setDrawer(null)
  }

  const handleSendSms = async () => {
    if (!smsModal || !smsMessage.trim()) return
    setSmsSending(true)
    await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: smsModal.phone, message: smsMessage }),
    })
    setSmsSending(false)
    setSmsModal(null)
    setSmsMessage('')
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">Visitors Pipeline</h1>
              <p className="text-xs text-gray-500">Think Big St. Louis · {user?.email}</p>
            </div>
          </div>
          <span className="text-sm text-gray-400">{visitors.length} total visitors</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1.5 text-xs opacity-70">{counts[s]}</span>
            </button>
          ))}

          {/* Search */}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="input-field text-sm py-1.5 w-64"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-gray-400 text-sm">No visitors match your filters.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-700">
                  {['Name', 'Company', 'Contact', 'Referral', 'Visit Date', 'Status', 'Notes', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`${i < filtered.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-700/20 transition-colors`}
                  >
                    <td className="px-4 pl-6 py-3 text-white font-medium whitespace-nowrap">
                      {v.first_name} {v.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-sm">{v.company}</p>
                      <p className="text-gray-500 text-xs">{v.business_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-xs">{v.email}</p>
                      <p className="text-gray-500 text-xs">{v.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.referral_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {v.visit_date
                        ? new Date(v.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span className="text-gray-600">Not set</span>}
                    </td>
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
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-gray-500 text-xs truncate">{v.notes || <span className="text-gray-700">—</span>}</p>
                    </td>
                    <td className="px-4 pr-6 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openDrawer(v)} className="text-xs text-brand-blue hover:text-white transition-colors whitespace-nowrap">
                          Edit Notes
                        </button>
                        <button
                          onClick={() => setSmsModal({ phone: v.phone, name: `${v.first_name} ${v.last_name}` })}
                          className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
                        >
                          SMS
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Notes / Visit Date Drawer */}
      {drawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-1">
              {drawer.first_name} {drawer.last_name}
            </h3>
            <p className="text-sm text-gray-400 mb-5">{drawer.company}</p>

            <div className="space-y-4">
              <div>
                <label className="label">Visit Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={drawerVisitDate}
                  onChange={(e) => setDrawerVisitDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Setting a visit date triggers the Day 1 / Day 7 SMS follow-up automation.
                </p>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                  placeholder="Add notes about this visitor…"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setDrawer(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveDrawer} disabled={drawerSaving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                {drawerSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-1">Send SMS</h3>
            <p className="text-sm text-gray-400 mb-4">To: {smsModal.name} · {smsModal.phone}</p>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={4}
              placeholder="Type your message…"
              className="input-field resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setSmsModal(null); setSmsMessage('') }} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSendSms} disabled={smsSending || !smsMessage.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {smsSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
