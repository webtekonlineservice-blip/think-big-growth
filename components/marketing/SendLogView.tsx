'use client'

import { useState, useEffect } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Link from 'next/link'

interface LogEntry {
  id: string
  type: 'visitor_outreach' | 'prospect_campaign' | 'member_announcement' | 'test_email'
  channel: 'sms' | 'email'
  step: string
  to: string
  status: 'sent' | 'failed'
  error: string | null
  date: string
  campaign_name: string | null
  invite_code: string | null
  credited_to: string | null
  prospect_name: string | null
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

const TYPE_LABELS: Record<string, string> = {
  visitor_outreach: 'Visitor automation',
  prospect_campaign: 'Outbound campaign',
  member_announcement: 'Member announcement',
  test_email: 'Test email',
}

const CHANNEL_STYLES: Record<string, string> = {
  sms: 'bg-green-500/15 text-green-400 border-green-500/30',
  email: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

export default function SendLogPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchLogs(1).finally(() => setLoading(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLogs = async (p: number) => {
    const res = await fetch(`/api/outreach-logs?page=${p}&limit=50`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setPage(p)
    }
  }

  // Send a preview of this email step to the admin's own inbox
  const handlePreview = async (log: LogEntry) => {
    const stepNum = parseInt(log.step.replace('sequence_', ''))
    if (!stepNum) return
    setPreviewing(log.id)
    setPreviewResult(null)
    try {
      const res = await fetch('/api/email-preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: undefined, // uses session email server-side
          step: stepNum,
          test_name: log.prospect_name || 'Sample Prospect',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreviewResult(`Preview sent to your inbox (step ${stepNum})`)
      } else {
        setPreviewResult(data.error || 'Preview failed.')
      }
    } catch {
      setPreviewResult('Network error.')
    }
    setPreviewing(null)
  }

  if (authLoading || loading) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm shrink-0">
            <span className="sm:hidden">←</span><span className="hidden sm:inline">← Dashboard</span>
          </Link>
          <div className="w-px h-4 bg-gray-700 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">Send Log</h1>
            <p className="text-sm text-gray-500 truncate">All SMS and email messages sent by the platform</p>
          </div>
        </div>
        <span className="text-xs sm:text-sm text-gray-400 shrink-0 whitespace-nowrap">{total.toLocaleString()} total</span>
      </div>

      {previewResult && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-4 py-3 text-sm">
          {previewResult}
        </div>
      )}

      {/* Log table */}
      {logs.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-sm">No messages sent yet.</p>
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${CHANNEL_STYLES[log.channel] || 'text-gray-400'}`}>
                  {log.channel.toUpperCase()}
                </span>
                {log.status === 'sent'
                  ? <span className="text-green-400 text-xs font-medium">✓ Sent</span>
                  : <span className="text-red-400 text-xs font-medium" title={log.error || ''}>✗ Failed</span>}
              </div>
              <p className="text-white text-sm font-medium mt-2">{STEP_LABELS[log.step] || log.step}</p>
              <p className="text-gray-600 text-xs">{log.campaign_name || TYPE_LABELS[log.type] || 'Email'}</p>
              <p className="text-gray-300 text-xs font-mono mt-1.5 break-all">{log.to}</p>
              {log.prospect_name && <p className="text-gray-500 text-xs">{log.prospect_name}</p>}
              {log.credited_to && <p className="text-brand-indigo text-xs font-medium mt-1">Credited: {log.credited_to}</p>}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                <span className="text-gray-500 text-xs">
                  {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' · '}
                  {new Date(log.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                {log.channel === 'email' && log.step.startsWith('sequence_') && (
                  <button
                    onClick={() => handlePreview(log)}
                    disabled={previewing === log.id}
                    className="text-xs text-brand-blue hover:text-white transition-colors disabled:opacity-40"
                  >
                    {previewing === log.id ? 'Sending…' : 'Preview →'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-700">
                {['Date', 'Channel', 'Type', 'Recipient', 'Credited To', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`${i < logs.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-800/30`}>
                  {/* Date */}
                  <td className="px-4 pl-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="text-gray-600 ml-1">
                      {new Date(log.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </td>
                  {/* Channel */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CHANNEL_STYLES[log.channel] || 'text-gray-400'}`}>
                      {log.channel.toUpperCase()}
                    </span>
                  </td>
                  {/* Type / step */}
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{STEP_LABELS[log.step] || log.step}</p>
                    <p className="text-gray-600 text-xs">
                      {log.campaign_name || TYPE_LABELS[log.type] || 'Email'}
                    </p>
                  </td>
                  {/* Recipient */}
                  <td className="px-4 py-3">
                    <p className="text-gray-300 text-xs font-mono">{log.to}</p>
                    {log.prospect_name && (
                      <p className="text-gray-500 text-xs">{log.prospect_name}</p>
                    )}
                  </td>
                  {/* Credited to (invite code / member) */}
                  <td className="px-4 py-3">
                    {log.credited_to ? (
                      <div>
                        <p className="text-brand-indigo text-xs font-medium">{log.credited_to}</p>
                        {log.invite_code && log.invite_code !== log.credited_to && (
                          <p className="text-gray-600 text-xs font-mono">{log.invite_code}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    {log.status === 'sent' ? (
                      <span className="text-green-400 text-xs font-medium">✓ Sent</span>
                    ) : (
                      <span className="text-red-400 text-xs font-medium" title={log.error || ''}>✗ Failed</span>
                    )}
                  </td>
                  {/* Preview */}
                  <td className="px-4 pr-6 py-3">
                    {log.channel === 'email' && log.step.startsWith('sequence_') && (
                      <button
                        onClick={() => handlePreview(log)}
                        disabled={previewing === log.id}
                        className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                        title="Send a preview of this email to your inbox"
                      >
                        {previewing === log.id ? 'Sending…' : 'Preview →'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
