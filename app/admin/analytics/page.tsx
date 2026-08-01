'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Analytics {
  totals: {
    visitors: number
    members: number
    conversionRate: number
    thisMonthVisitors: number
    lastMonthVisitors: number
  }
  byStatus: Record<string, number>
  funnel: { stage: string; count: number }[]
  monthlyTrend: { label: string; count: number }[]
  topInviters: { id: string; name: string; company: string; total: number; converted: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  invited: 'bg-yellow-500',
  visited: 'bg-brand-blue',
  applied: 'bg-purple-500',
  member: 'bg-green-500',
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }

        const r = await fetch('/api/analytics')
        if (r.ok) setData(await r.json())
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

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

  if (!data) return null

  const { totals, byStatus, funnel, monthlyTrend, topInviters } = data
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.count), 1)
  const maxFunnel = funnel[0]?.count || 1

  const monthDelta = totals.lastMonthVisitors > 0
    ? Math.round(((totals.thisMonthVisitors - totals.lastMonthVisitors) / totals.lastMonthVisitors) * 100)
    : null

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">Analytics</h1>
              <p className="text-xs text-gray-500">Think Big St. Louis · Chapter Growth</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Visitors', value: totals.visitors, color: 'text-white' },
            { label: 'Total Members', value: totals.members, color: 'text-green-400' },
            { label: 'Conversion Rate', value: `${totals.conversionRate}%`, color: 'text-brand-blue' },
            { label: 'This Month', value: totals.thisMonthVisitors, color: 'text-brand-orange', sub: monthDelta !== null ? `${monthDelta >= 0 ? '+' : ''}${monthDelta}% vs last month` : undefined },
            { label: 'Last Month', value: totals.lastMonthVisitors, color: 'text-gray-300' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-xs text-gray-500">{s.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Status breakdown */}
          <div className="card">
            <h2 className="text-base font-semibold text-white mb-6">Visitors by Status</h2>
            <div className="space-y-4">
              {(['invited', 'visited', 'applied', 'member'] as const).map((s) => {
                const count = byStatus[s] ?? 0
                const pct = totals.visitors > 0 ? Math.round((count / totals.visitors) * 100) : 0
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-300 capitalize">{s}</span>
                      <span className="text-sm font-semibold text-white">{count} <span className="text-gray-500 font-normal text-xs">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${STATUS_COLORS[s]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Conversion funnel */}
          <div className="card">
            <h2 className="text-base font-semibold text-white mb-6">Conversion Funnel</h2>
            <div className="space-y-3">
              {funnel.map((f, i) => {
                const pct = Math.round((f.count / maxFunnel) * 100)
                const colors = ['bg-yellow-500', 'bg-brand-blue', 'bg-purple-500', 'bg-green-500']
                return (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{f.stage}</span>
                      <span className="text-sm font-semibold text-white">{f.count}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-700 ${colors[i]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Each stage shows cumulative count — visitors move down the funnel as they progress.
            </p>
          </div>
        </div>

        {/* Monthly trend */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-6">New Visitors — Last 6 Months</h2>
          {monthlyTrend.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {monthlyTrend.map((m) => {
                const h = Math.round((m.count / maxTrend) * 100)
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">{m.count}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                      <div
                        className="w-full bg-brand-blue rounded-t-md transition-all duration-700 min-h-[4px]"
                        style={{ height: `${Math.max(h, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 text-center">{m.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top inviters */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-base font-semibold text-white">Top Inviters</h2>
            <p className="text-xs text-gray-500 mt-0.5">Members ranked by visitors invited</p>
          </div>
          {topInviters.length === 0 ? (
            <p className="px-6 py-10 text-gray-500 text-sm">No invite data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {['#', 'Member', 'Company', 'Invited', 'Converted', 'Conv. Rate'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topInviters.map((inv, i) => {
                  const rate = inv.total > 0 ? Math.round((inv.converted / inv.total) * 100) : 0
                  return (
                    <tr key={inv.id} className={`${i < topInviters.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-700/20`}>
                      <td className="px-6 py-3 text-gray-500 text-xs font-mono">#{i + 1}</td>
                      <td className="px-6 py-3 text-white font-medium">{inv.name}</td>
                      <td className="px-6 py-3 text-gray-400 text-sm">{inv.company || '—'}</td>
                      <td className="px-6 py-3 text-brand-blue font-semibold">{inv.total}</td>
                      <td className="px-6 py-3 text-green-400 font-semibold">{inv.converted}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold ${rate >= 50 ? 'text-green-400' : rate >= 25 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
