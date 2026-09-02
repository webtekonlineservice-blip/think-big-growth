'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LogEntry {
  id: string
  type: 'visitor_outreach' | 'prospect_campaign'
  channel: 'sms' | 'email'
  step: string
  to: string
  status: 'sent' | 'failed'
  error: string | null
  date: string
}

const STEP_LABELS: Record<string, string> = {
  welcome_sms: 'Welcome SMS',
  welcome_email: 'Welcome Email',
  day1_sms: 'Day 1 Follow-up SMS',
  day7_sms: 'Day 7 Follow-up SMS',
  day14_email: 'Day 14 Reminder Email',
  sequence_1: 'Outbound Email 1 — Intro',
  sequence_2: 'Outbound Email 2 — Value',
  sequence_3: 'Outbound Email 3 — Close',
}

const CHANNEL_STYLES: Record<string, string> = {
  sms: 'bg-green-500/15 text-green-400 border-green-500/30',
  email: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

export default function SendLogPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        await fetchLogs(1)
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchLogs = async (p: number) => {
    const res = await fetch(`/api/outreach-logs?page=${p}&limit=50`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setPage(p)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-indigo animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Send Log</h1>
          <p className="text-sm text-gray-500">All SMS and email messages sent by the platform</p>
        </div>
        <span className="text-sm text-gray-400">{total} total messages</span>
      </div>

      {/* Log table */}
      {logs.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-sm">No messages sent yet. They'll appear here once automations or campaigns fire.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-700">
                {['Date', 'Channel', 'Type', 'Recipient', 'Status'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`${i < logs.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-800/30`}>
                  <td className="px-4 pl-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="text-gray-600 ml-1">
                      {new Date(log.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CHANNEL_STYLES[log.channel] || 'text-gray-400'}`}>
                      {log.channel.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{STEP_LABELS[log.step] || log.step}</p>
                    <p className="text-gray-600 text-xs">
                      {log.type === 'visitor_outreach' ? 'Visitor automation'
                        : log.type === 'prospect_campaign' ? 'Outbound campaign'
                        : log.type === 'member_announcement' ? 'Member announcement'
                        : log.type === 'test_email' ? 'Test email'
                        : 'Email'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.to}</td>
                  <td className="px-4 pr-6 py-3">
                    {log.status === 'sent' ? (
                      <span className="text-green-400 text-xs font-medium">✓ Sent</span>
                    ) : (
                      <span className="text-red-400 text-xs font-medium" title={log.error || ''}>✗ Failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1}
            className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={logs.length < 50}
            className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
