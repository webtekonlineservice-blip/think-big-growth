'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

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
  const [user, setUser] = useState<User | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [stats, setStats] = useState<Stats>({ totalMembers: 0, visitorsThisMonth: 0, conversionRate: 0 })
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [smsModal, setSmsModal] = useState<{ open: boolean; visitorId: string; phone: string } | null>(null)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)

  const fetchAdminData = useCallback(async () => {
    try {
      const [membersRes, visitorsRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/visitors'),
      ])
      if (membersRes.ok) {
        const members = await membersRes.json()
        const now = new Date()
        const thisMonth = visitors.filter((v) => {
          const d = new Date(v.created_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        const converted = visitors.filter((v) => v.status === 'member').length
        setStats({
          totalMembers: members.length,
          visitorsThisMonth: thisMonth.length,
          conversionRate: visitors.length > 0 ? Math.round((converted / visitors.length) * 100) : 0,
        })
      }
      if (visitorsRes.ok) {
        const data = await visitorsRes.json()
        setVisitors(data)
      }
    } catch {
      // Non-fatal
    }
  }, [visitors])

  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/member/login')
        return
      }
      setUser(u)
      // Check admin claim via ID token
      const token = await u.getIdTokenResult()
      if (!token.claims.admin) {
        router.push('/member')
        return
      }
      setIsAdmin(true)
      await fetchAdminData()
      setLoading(false)
    })
    return unsub
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
    const auth = getFirebaseAuth()
    await signOut(auth)
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

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">Think Big St. Louis · {user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
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
