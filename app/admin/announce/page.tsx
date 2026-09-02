'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AnnouncePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [members, setMembers] = useState<{ name: string; email: string }[]>([])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        setTestEmail(user.email)
        // Load members with real emails for the "send all" count
        const mr = await fetch('/api/members')
        if (mr.ok) {
          const all = await mr.json()
          setMembers(all.filter((m: { email: string }) =>
            m.email && !m.email.includes('thinkbig.local') && !m.email.includes('placeholder')))
        }
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

  const sendTest = async () => {
    setSending(true); setResult(null)
    const res = await fetch('/api/members/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, to: testEmail }),
    })
    const data = await res.json()
    setResult(res.ok
      ? { ok: true, msg: `Test sent to ${data.sent_to}. Check your inbox.` }
      : { ok: false, msg: data.error || 'Failed to send.' })
    setSending(false)
  }

  const sendAll = async () => {
    if (!confirm(`Send the announcement to all ${members.length} members with real emails? This cannot be undone.`)) return
    setSending(true); setResult(null)
    const res = await fetch('/api/members/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    const data = await res.json()
    setResult(res.ok
      ? { ok: true, msg: `Sent to ${data.sent} members (${data.failed} failed).` }
      : { ok: false, msg: data.error || 'Failed to send.' })
    setSending(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-red animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">📣 Chapter Announcement</h1>
        <p className="text-sm text-gray-500">Send the platform showcase email to members. Always test first, then send to everyone.</p>
      </div>

      {/* What gets sent */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white">What this sends</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          A branded email introducing the Think Big Growth platform — what it does, each member's
          personal invite link, and a "Yes, I'm Interested" call to action. Sent from
          <span className="text-brand-indigo-light"> noreply@webtek.ai</span>.
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 bg-gray-800 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            {members.length} members with valid emails
          </span>
        </div>
      </div>

      {/* Test send */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">1. Send a Test First</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="input-field flex-1"
            placeholder="your@email.com"
          />
          <button onClick={sendTest} disabled={sending || !testEmail} className="btn-secondary px-5 disabled:opacity-50 whitespace-nowrap">
            {sending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>

      {/* Send all */}
      <div className="card space-y-4 border-brand-red/30">
        <h2 className="text-sm font-semibold text-white">2. Send to All Members</h2>
        <p className="text-sm text-gray-400">Once the test looks good, send to all {members.length} members.</p>
        <button onClick={sendAll} disabled={sending} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
          {sending ? 'Sending…' : `Send to ${members.length} Members →`}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl px-5 py-4 text-sm ${result.ok ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {result.ok ? '✓ ' : '✗ '}{result.msg}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Every send is logged in the <a href="/admin/send-log" className="text-brand-indigo-light hover:underline">Send Log</a>.
      </p>
    </div>
  )
}
