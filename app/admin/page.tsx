'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SessionUser {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

interface Campaign {
  id: string
  name: string
  total_prospects: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_unsubscribed: number
  active: boolean
}

interface DashboardData {
  members: number
  visitors: number
  visitorsThisMonth: number
  conversionRate: number
  prospects: number
  campaigns: Campaign[]
  breakdown: {
    total: number
    withEmail: number
    emailCoverage: number
    byProfession: { name: string; count: number }[]
    bySource: { name: string; count: number }[]
  } | null
  recentVisitors: Array<{
    id: string
    first_name: string
    last_name: string
    company: string
    status: string
    created_at: string
  }>
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user: u } = await res.json()
        if (!u.is_admin) { router.push('/member'); return }
        setUser(u)

        // Fetch all dashboard data in parallel
        const [membersRes, visitorsRes, campaignsRes, prospectsRes, breakdownRes] = await Promise.all([
          fetch('/api/members'),
          fetch('/api/visitors'),
          fetch('/api/prospects/campaigns'),
          fetch('/api/prospects?limit=1'),
          fetch('/api/prospects/breakdown'),
        ])

        const members = membersRes.ok ? await membersRes.json() : []
        const visitors = visitorsRes.ok ? await visitorsRes.json() : []
        const campaigns = campaignsRes.ok ? await campaignsRes.json() : []
        const prospectsData = prospectsRes.ok ? await prospectsRes.json() : { total: 0 }
        const breakdown = breakdownRes.ok ? await breakdownRes.json() : null

        const now = new Date()
        const thisMonth = visitors.filter((v: { created_at: string }) => {
          const d = new Date(v.created_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        const converted = visitors.filter((v: { status: string }) => v.status === 'member').length

        setData({
          members: members.length,
          visitors: visitors.length,
          visitorsThisMonth: thisMonth.length,
          conversionRate: visitors.length > 0 ? Math.round((converted / visitors.length) * 100) : 0,
          prospects: prospectsData.total ?? 0,
          campaigns,
          breakdown,
          recentVisitors: visitors.slice(0, 5).map((v: { id: string; first_name: string; last_name: string; company: string; status: string; created_at: string }) => ({
            id: v.id,
            first_name: v.first_name,
            last_name: v.last_name,
            company: v.company,
            status: v.status,
            created_at: v.created_at,
          })),
        })
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-blue animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  const totalSent = data.campaigns.reduce((sum, c) => sum + c.total_sent, 0)
  const totalOpened = data.campaigns.reduce((sum, c) => sum + c.total_opened, 0)
  const totalClicked = data.campaigns.reduce((sum, c) => sum + c.total_clicked, 0)
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

  const STATUS_STYLES: Record<string, string> = {
    invited: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    visited: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
    applied: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    member: 'bg-green-500/10 text-green-400 border-green-500/20',
  }

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Top stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Members</p>
            <p className="text-3xl font-bold text-white">{data.members}</p>
            <p className="text-xs text-gray-500">Active chapter</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Visitors</p>
            <p className="text-3xl font-bold text-brand-blue">{data.visitors}</p>
            <p className="text-xs text-gray-500">{data.visitorsThisMonth} this month</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Conversion</p>
            <p className="text-3xl font-bold text-green-400">{data.conversionRate}%</p>
            <p className="text-xs text-gray-500">Visitor → Member</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Leads</p>
            <p className="text-3xl font-bold text-brand-orange">{data.prospects}</p>
            <p className="text-xs text-gray-500">Prospects scraped</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Emails Sent</p>
            <p className="text-3xl font-bold text-purple-400">{totalSent}</p>
            <p className="text-xs text-gray-500">{openRate}% open · {clickRate}% click</p>
          </div>
        </div>

        {/* Data Being Collected */}
        {data.breakdown && data.breakdown.total > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Data Being Collected
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.breakdown.total} businesses captured · {data.breakdown.withEmail} with emails ({data.breakdown.emailCoverage}% coverage)
                </p>
              </div>
              <a href="/admin/prospects" className="text-xs text-brand-blue hover:text-white transition-colors">Manage →</a>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* By profession */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">By Profession</p>
                <div className="space-y-2">
                  {data.breakdown.byProfession.slice(0, 8).map((p) => {
                    const pct = Math.round((p.count / data.breakdown!.total) * 100)
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300 truncate">{p.name}</span>
                          <span className="text-gray-500 font-medium ml-2">{p.count}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div className="bg-brand-red h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By source + email coverage */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">By Source</p>
                <div className="space-y-2 mb-6">
                  {data.breakdown.bySource.map((s) => (
                    <div key={s.name} className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg border border-gray-700/50">
                      <span className="text-xs text-gray-300 capitalize">{s.name.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-white font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>

                {/* Email coverage donut-ish bar */}
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">Email Coverage</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-800 rounded-full h-3">
                    <div className="bg-green-400 h-3 rounded-full transition-all" style={{ width: `${data.breakdown.emailCoverage}%` }} />
                  </div>
                  <span className="text-sm font-bold text-green-400">{data.breakdown.emailCoverage}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{data.breakdown.withEmail} of {data.breakdown.total} have contact emails</p>
              </div>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Outbound campaigns status */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Outbound Campaigns</h2>
              <a href="/admin/outbound" className="text-xs text-brand-blue hover:text-white transition-colors">View all →</a>
            </div>

            {data.campaigns.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-3">No campaigns yet.</p>
                <a href="/admin/outbound" className="btn-primary text-xs px-4 py-2">Create Campaign</a>
              </div>
            ) : (
              <div className="space-y-3">
                {data.campaigns.slice(0, 4).map((c) => {
                  const cOpenRate = c.total_sent > 0 ? Math.round((c.total_opened / c.total_sent) * 100) : 0
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${c.active ? 'bg-green-400' : 'bg-gray-600'}`} />
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {c.total_prospects} prospects · {c.total_sent} sent · {cOpenRate}% open
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-brand-blue font-semibold">{c.total_opened}</span>
                        <span className="text-green-400 font-semibold">{c.total_clicked}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent visitors */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Recent Visitors</h2>
              <a href="/admin/visitors" className="text-xs text-brand-blue hover:text-white transition-colors">View all →</a>
            </div>

            {data.recentVisitors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No visitors yet. Share your invite link to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentVisitors.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div>
                      <p className="text-sm font-medium text-white">{v.first_name} {v.last_name}</p>
                      <p className="text-xs text-gray-500">{v.company}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[v.status] || 'text-gray-400'}`}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Automation status */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-5">Automation Status</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-sm font-medium text-white">Visitor Follow-Up</p>
              </div>
              <p className="text-xs text-gray-400">
                Day 1 SMS · Day 7 SMS · Day 14 Email<br/>
                Runs daily at 9 AM UTC
              </p>
            </div>
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${data.campaigns.some(c => c.active) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <p className="text-sm font-medium text-white">Outbound Drip</p>
              </div>
              <p className="text-xs text-gray-400">
                3-email sequence · 10/day batch<br/>
                {data.campaigns.filter(c => c.active).length} active campaign{data.campaigns.filter(c => c.active).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <p className="text-sm font-medium text-white">Email Delivery</p>
              </div>
              <p className="text-xs text-gray-400">
                via Resend · noreply@thinkbig.webtek.ai<br/>
                Verify domain to activate
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/admin/outbound" className="card flex items-center gap-3 hover:border-brand-blue/40 transition-colors cursor-pointer py-4">
            <div className="w-9 h-9 bg-brand-blue/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Import Leads</p>
              <p className="text-gray-500 text-xs">CSV or extension</p>
            </div>
          </a>
          <a href="/admin/campaigns" className="card flex items-center gap-3 hover:border-purple-500/40 transition-colors cursor-pointer py-4">
            <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Send Campaign</p>
              <p className="text-gray-500 text-xs">SMS or email blast</p>
            </div>
          </a>
          <a href="/admin/visitors" className="card flex items-center gap-3 hover:border-brand-orange/40 transition-colors cursor-pointer py-4">
            <div className="w-9 h-9 bg-brand-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Visitor Pipeline</p>
              <p className="text-gray-500 text-xs">Manage prospects</p>
            </div>
          </a>
          <a href="/admin/analytics" className="card flex items-center gap-3 hover:border-green-500/40 transition-colors cursor-pointer py-4">
            <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Analytics</p>
              <p className="text-gray-500 text-xs">Growth metrics</p>
            </div>
          </a>
        </div>

        {/* Your invite link */}
        <div className="card border-brand-blue/30 bg-gradient-to-br from-brand-blue/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Your Invite Link</h2>
              <p className="text-sm text-gray-400">Share this to get credit for every visitor registration.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-900 text-brand-blue px-3 py-2 rounded-lg border border-gray-700">
                thinkbig.webtek.ai/invite/{user?.invite_code}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://thinkbig.webtek.ai/invite/${user?.invite_code}`)
                }}
                className="btn-primary text-xs px-3 py-2"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
