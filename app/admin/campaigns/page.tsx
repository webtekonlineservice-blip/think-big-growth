'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Segment = 'all' | 'invited' | 'visited' | 'applied'
type Channel = 'sms' | 'email' | 'both'

interface CampaignResult {
  total: number
  sms?: { sent: number; failed: number }
  email?: { sent: number; failed: number }
}

const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All prospects (invited + visited + applied)',
  invited: 'Invited only — registered but not yet visited',
  visited: 'Visited — attended a meeting',
  applied: 'Applied — submitted application',
}

const SMS_TEMPLATES = [
  {
    label: 'Meeting reminder',
    message: 'Hi [name]! Just a reminder — Think Big St. Louis BNI meets this Thursday at 11:30 AM at Mike Duffy\'s Pub & Grill in Kirkwood, MO. Hope to see you there!',
  },
  {
    label: 'Follow-up after visit',
    message: 'Hi [name]! Great meeting you at Think Big St. Louis. We\'d love to have you in the chapter. Reply to this message or visit thinkbig.webtek.ai to learn more.',
  },
  {
    label: 'Application nudge',
    message: 'Hi [name], your BNI application is still open! Spots are limited — one per profession. Apply now at thinkbig.webtek.ai before your category fills up.',
  },
]

const EMAIL_TEMPLATES = [
  {
    label: 'Meeting reminder',
    subject: 'You\'re invited — Think Big St. Louis this Thursday',
    message: 'Hi [name],\n\nJust a friendly reminder that Think Big St. Louis BNI meets every Thursday at 11:30 AM at Mike Duffy\'s Pub & Grill in Kirkwood, MO.\n\nWe\'d love to see you there. Guests are always welcome!',
  },
  {
    label: 'Membership opportunity',
    subject: 'Your BNI seat at Think Big St. Louis may still be open',
    message: 'Hi [name],\n\nWe wanted to reach out and let you know that your professional category may still be available at Think Big St. Louis.\n\nBNI members generate real revenue through structured referrals — and with only one member per profession, there\'s no competition within the chapter.\n\nIf you\'re ready to take the next step, we\'d love to have you.',
  },
]

export default function AdminCampaignsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [error, setError] = useState('')

  const [segment, setSegment] = useState<Segment>('visited')
  const [channel, setChannel] = useState<Channel>('sms')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

  const applyTemplate = (tmpl: { label: string; message: string; subject?: string }) => {
    setMessage(tmpl.message)
    if (tmpl.subject) setSubject(tmpl.subject)
    setResult(null)
    setError('')
  }

  const handleSend = async () => {
    if (!message.trim()) { setError('Message is required.'); return }
    if ((channel === 'email' || channel === 'both') && !subject.trim()) { setError('Subject is required for email.'); return }
    if (!confirm(`Send this ${channel} campaign to all "${segment}" visitors? This cannot be undone.`)) return

    setSending(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, channel, subject, message, ctaText, ctaUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send.'); return }
      setResult(data)
    } catch {
      setError('Network error.')
    } finally {
      setSending(false)
    }
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
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <div className="w-px h-4 bg-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-white">Campaigns</h1>
            <p className="text-xs text-gray-500">Send bulk SMS or email to visitor segments</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-3 gap-8">

          {/* Composer */}
          <div className="md:col-span-2 space-y-6">

            {/* Segment + Channel */}
            <div className="card space-y-5">
              <h2 className="text-base font-semibold text-white">1. Choose Audience & Channel</h2>

              <div>
                <label className="label">Audience Segment</label>
                <select
                  className="input-field"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as Segment)}
                >
                  {(Object.keys(SEGMENT_LABELS) as Segment[]).map((s) => (
                    <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Channel</label>
                <div className="flex gap-3">
                  {(['sms', 'email', 'both'] as Channel[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        channel === c
                          ? 'bg-brand-blue border-brand-blue text-white'
                          : 'border-gray-600 text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Message composer */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-white">2. Compose Message</h2>

              {(channel === 'email' || channel === 'both') && (
                <div>
                  <label className="label">Email Subject *</label>
                  <input
                    className="input-field"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Your BNI seat at Think Big may still be open"
                  />
                </div>
              )}

              <div>
                <label className="label">
                  Message *
                  <span className="text-gray-500 font-normal ml-2 text-xs">Use [name] and [company] as placeholders</span>
                </label>
                <textarea
                  className="input-field resize-none"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi [name], ..."
                />
                {channel === 'sms' || channel === 'both' ? (
                  <p className="text-xs text-gray-500 mt-1">{message.length} characters · SMS segments: {Math.ceil(message.length / 160) || 1}</p>
                ) : null}
              </div>

              {(channel === 'email' || channel === 'both') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">CTA Button Text (optional)</label>
                    <input className="input-field" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Learn More" />
                  </div>
                  <div>
                    <label className="label">CTA URL (optional)</label>
                    <input className="input-field" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://thinkbig.webtek.ai" />
                  </div>
                </div>
              )}
            </div>

            {/* Send */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}

            {result && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-5 py-4 space-y-1">
                <p className="font-semibold">Campaign sent to {result.total} visitors</p>
                {result.sms && <p className="text-sm">SMS: {result.sms.sent} sent, {result.sms.failed} failed</p>}
                {result.email && <p className="text-sm">Email: {result.email.sent} sent, {result.email.failed} failed</p>}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending…
                </>
              ) : `Send ${channel.toUpperCase()} Campaign →`}
            </button>
          </div>

          {/* Templates sidebar */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4">SMS Templates</h3>
              <div className="space-y-2">
                {SMS_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-700 hover:border-brand-blue/50 hover:bg-brand-blue/5 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-300">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.message}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4">Email Templates</h3>
              <div className="space-y-2">
                {EMAIL_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-700 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-300">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card bg-gray-700/30 border-gray-600/50">
              <h3 className="text-sm font-semibold text-white mb-2">Tips</h3>
              <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
                <li>Use <code className="text-brand-blue">[name]</code> for first name</li>
                <li>Use <code className="text-brand-blue">[company]</code> for company</li>
                <li>SMS over 160 chars = multiple segments</li>
                <li>Email requires Resend domain verified</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
