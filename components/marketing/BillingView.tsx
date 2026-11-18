'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  Radio, MessageSquare, Mail, Phone, CheckCircle2, XCircle,
  Send, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Users, Calendar, Megaphone, FileText,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Member {
  id: string; name: string; phone: string; email: string
  company: string; role: string; photo?: string
}
interface Speaker { id: string; date: string; name: string; member_id: string | null }
interface SendLog {
  id: string; recipient_name: string; channel: string; type: string
  to: string; subject?: string; body: string; test: boolean
  status: 'sent' | 'failed'; error?: string; sent_at: string
}

const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const CARD = 'bg-gray-800/60 border border-gray-700 rounded-xl'
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`
const today = () => new Date().toISOString().split('T')[0]
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[m-1]} ${d}`
}

const CHANNEL_STYLE: Record<string, string> = {
  sms: 'bg-green-500/15 text-green-400',
  whatsapp: 'bg-emerald-500/15 text-emerald-400',
  email: 'bg-brand-blue/15 text-brand-blue',
}
const TYPE_LABEL: Record<string, string> = {
  member_invoice: 'Invoice',
  meeting_reminder: 'Meeting Reminder',
  chapter_announcement: 'Announcement',
  visitor_followup: 'Visitor Follow-up',
  test: 'Test',
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [tab, setTab] = useState<'invoice' | 'reminder' | 'announce' | 'log'>('invoice')
  const [members, setMembers] = useState<Member[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [logs, setLogs] = useState<SendLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [m, sp, lg] = await Promise.all([
      fetch('/api/members', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/treasurer/speakers', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/marketing/logs?limit=50', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ])
    setMembers(m)
    setSpeakers(sp)
    setLogs(lg)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchAll().finally(() => setLoading(false))
  }, [user, fetchAll])

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const TABS = [
    { id: 'invoice' as const, label: 'Member Invoice', Icon: FileText },
    { id: 'reminder' as const, label: 'Meeting Reminder', Icon: Calendar },
    { id: 'announce' as const, label: 'Announcement', Icon: Megaphone },
    { id: 'log' as const, label: 'Send Log', Icon: FileText },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-blue" /> Marketing
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Member invoices · meeting reminders · chapter announcements</p>
        <div className="mt-3 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400">
            <strong>Test mode is on by default.</strong> All sends route to <strong>webtekdigitalai@gmail.com</strong> / <strong>+13149223810</strong> until you turn it off. Always test before going live.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-full sm:w-fit mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <t.Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden text-xs">{t.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {tab === 'invoice'  && <InvoiceTab members={members} onSent={fetchAll} />}
      {tab === 'reminder' && <ReminderTab members={members} speakers={speakers} onSent={fetchAll} />}
      {tab === 'announce' && <AnnounceTab members={members} onSent={fetchAll} />}
      {tab === 'log'      && <LogTab logs={logs} onRefresh={fetchAll} />}
    </div>
  )
}

// ─── Test mode toggle ─────────────────────────────────────────────────────────
function TestToggle({ test, onChange }: { test: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer border text-sm ${test ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <input type="checkbox" checked={test} onChange={(e) => onChange(e.target.checked)} className="accent-yellow-500 mt-0.5" />
      <span>
        <span className={`font-semibold ${test ? 'text-yellow-400' : 'text-red-400'}`}>
          {test ? '🧪 Test mode ON — sends to admin only' : '🔴 Live mode — sends to real recipients'}
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">
          {test ? 'All messages route to webtekdigitalai@gmail.com / +13149223810. Safe to test.' : 'Messages will be sent to real members. Confirm before sending.'}
        </span>
      </span>
    </label>
  )
}

// ─── Result banner ────────────────────────────────────────────────────────────
function ResultBanner({ result }: { result: { ok?: boolean; error?: string; message?: string } | null }) {
  if (!result) return null
  return result.ok
    ? <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400"><CheckCircle2 className="w-4 h-4" /> {result.message || 'Sent successfully.'}</div>
    : <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400"><XCircle className="w-4 h-4" /> {result.error || 'Send failed.'}</div>
}

// ─── Invoice Tab ──────────────────────────────────────────────────────────────
function InvoiceTab({ members, onSent }: { members: Member[]; onSent: () => Promise<void> }) {
  const [memberId, setMemberId] = useState('')
  const [channels, setChannels] = useState<string[]>(['sms', 'email'])
  const [test, setTest] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; message?: string; details?: unknown } | null>(null)

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])

  const send = async () => {
    if (!memberId) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/marketing/invoice', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, channels, test }),
      })
      const data = await res.json()
      if (res.ok) {
        const sentChannels = Object.entries(data.results || {})
          .filter(([, r]: [string, unknown]) => (r as { ok: boolean }).ok)
          .map(([ch]) => ch).join(', ')
        const failedChannels = Object.entries(data.results || {})
          .filter(([, r]: [string, unknown]) => !(r as { ok: boolean }).ok)
          .map(([ch, r]) => `${ch}: ${(r as { error?: string }).error}`)
        setResult({
          ok: sentChannels.length > 0,
          message: `${test ? '[TEST] ' : ''}Sent to ${data.member} via ${sentChannels || 'none'}. Balance: ${data.balance >= 0 ? '$' + data.balance.toFixed(2) : 'Credit'}${failedChannels.length ? `\nFailed: ${failedChannels.join(', ')}` : ''}`,
          details: data,
        })
        await onSent()
      } else {
        setResult({ ok: false, error: data.error })
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) })
    } finally {
      setSending(false)
    }
  }

  const member = members.find(m => m.id === memberId)

  return (
    <div className="space-y-4">
      <div className={CARD + ' p-4 space-y-4'}>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-brand-blue" /> Send Member Invoice</h3>
        <p className="text-xs text-gray-500">Sends the member their current balance, recent charges, and payment instructions.</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Member</label>
          <select value={memberId} onChange={e => setMemberId(e.target.value)} className={INPUT}>
            <option value="">— pick a member —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} · {m.company}</option>)}
          </select>
        </div>

        {member && (
          <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-3 py-2 text-xs">
            {member.photo
              ? <img src={member.photo} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-700 shrink-0" />
              : <div className="w-9 h-9 rounded-full bg-brand-red/20 flex items-center justify-center text-xs font-bold text-brand-red shrink-0">
                  {member.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                </div>
            }
            <div>
              <p className="text-gray-200 font-medium">{member.name}</p>
              <p className="text-gray-500">
                {member.phone ? <span className="mr-2">📱 {member.phone}</span> : <span className="text-red-400 mr-2">No phone</span>}
                {member.email && !member.email.includes('@member.thinkbig')
                  ? <span>✉️ {member.email}</span>
                  : <span className="text-red-400">No real email</span>
                }
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-2">Channels</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'sms', label: 'SMS', Icon: MessageSquare, color: 'green' },
              { id: 'email', label: 'Email', Icon: Mail, color: 'blue' },
              { id: 'whatsapp', label: 'WhatsApp', Icon: Phone, color: 'emerald' },
            ].map(({ id, label, Icon, color }) => (
              <button key={id} onClick={() => toggleChannel(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  channels.includes(id)
                    ? `bg-${color}-500/15 border-${color}-500/40 text-${color}-400`
                    : 'bg-gray-900 border-gray-700 text-gray-500'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        <TestToggle test={test} onChange={setTest} />
        <ResultBanner result={result} />

        <button onClick={send} disabled={sending || !memberId || channels.length === 0}
          className="flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-40">
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : test ? 'Send Test Invoice' : `Send Invoice to ${member?.name?.split(' ')[0] || 'Member'}`}
        </button>
      </div>

      {/* Quick send all owing members */}
      <div className={CARD + ' p-4 space-y-3'}>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-orange-400" /> Bulk Invoice (coming soon)</h3>
        <p className="text-xs text-gray-500">Send invoices to all members with an outstanding balance in one click. Available after you've confirmed the individual invoice flow works correctly.</p>
      </div>
    </div>
  )
}

// ─── Reminder Tab ─────────────────────────────────────────────────────────────
function ReminderTab({ members, speakers, onSent }: { members: Member[]; speakers: Speaker[]; onSent: () => Promise<void> }) {
  const [channels, setChannels] = useState<string[]>(['sms'])
  const [test, setTest] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null)
  const [speakerOverride, setSpeakerOverride] = useState('')
  const [dateOverride, setDateOverride] = useState(today())

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])

  // Find speaker for the chosen date
  const assignedSpeaker = speakers.find(s => s.date === dateOverride)
  const speakerMember = members.find(m => m.id === assignedSpeaker?.member_id)
  const speakerName = assignedSpeaker?.name && assignedSpeaker.name !== 'Speaker Name'
    ? assignedSpeaker.name : speakerOverride || undefined
  const speakerCompany = speakerMember?.company

  const send = async () => {
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/marketing/reminder', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels, speakerName, speakerCompany, date: longDate(dateOverride), test }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({
          ok: true,
          message: `${test ? '[TEST] ' : ''}Reminder sent! ${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped (no phone).`,
        })
        await onSent()
      } else {
        setResult({ ok: false, error: data.error })
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={CARD + ' p-4 space-y-4'}>
      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-blue" /> Weekly Meeting Reminder</h3>
      <p className="text-xs text-gray-500">Sends a meeting reminder text to all members. Includes the speaker name and date if assigned.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Meeting Date</label>
          <input type="date" value={dateOverride} onChange={e => setDateOverride(e.target.value)}
            onClick={e => e.currentTarget.showPicker?.()}
            className={`${INPUT} cursor-pointer`} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Speaker</label>
          {assignedSpeaker && assignedSpeaker.name !== 'Speaker Name' ? (
            <div className="flex items-center gap-2 text-sm">
              {speakerMember?.photo && <img src={speakerMember.photo} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-700" />}
              <span className="text-green-400 font-medium">✓ {assignedSpeaker.name}</span>
            </div>
          ) : (
            <input value={speakerOverride} onChange={e => setSpeakerOverride(e.target.value)}
              placeholder="Enter speaker name (optional)" className={INPUT} />
          )}
        </div>
      </div>

      {/* Message preview */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Preview</p>
        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
{`📅 Think Big St. Louis — ${longDate(dateOverride)}
Thursdays 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood${speakerName ? `\n🎤 Featured speaker: ${speakerName}${speakerCompany ? ` (${speakerCompany})` : ''}` : ''}

See you there! 💪`}
        </pre>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-2">Channels</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'sms', label: 'SMS', Icon: MessageSquare },
            { id: 'whatsapp', label: 'WhatsApp', Icon: Phone },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => toggleChannel(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                channels.includes(id) ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-500'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Will send to <strong className="text-gray-300">{members.filter(m => m.phone).length}</strong> members with a phone number
        {' '}({members.filter(m => !m.phone).length} skipped — no phone).
      </div>

      <TestToggle test={test} onChange={setTest} />
      <ResultBanner result={result} />

      <button onClick={send} disabled={sending || channels.length === 0}
        className="flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-40">
        <Send className="w-4 h-4" />
        {sending ? 'Sending…' : test ? 'Send Test Reminder' : `Send to ${members.filter(m => m.phone).length} Members`}
      </button>
    </div>
  )
}

// ─── Announce Tab ─────────────────────────────────────────────────────────────
function AnnounceTab({ members, onSent }: { members: Member[]; onSent: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<string[]>(['sms'])
  const [test, setTest] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null)

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])

  const send = async () => {
    if (!message.trim()) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/marketing/announce', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, channels, test }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `${test ? '[TEST] ' : ''}${data.sent} sent, ${data.failed} failed.` })
        await onSent()
      } else {
        setResult({ ok: false, error: data.error })
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={CARD + ' p-4 space-y-4'}>
      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-brand-blue" /> Chapter Announcement</h3>
      <p className="text-xs text-gray-500">Send a custom message to all members. Meeting details are appended automatically.</p>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
          placeholder="e.g. Reminder: chapter dues increase to $5/week starting November 1. See Patrick with questions."
          className={INPUT} />
        <p className="text-xs text-gray-600 mt-1">{message.length} chars · Meeting details (venue + time) are appended automatically.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-2">Channels</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'sms', label: 'SMS', Icon: MessageSquare },
            { id: 'whatsapp', label: 'WhatsApp', Icon: Phone },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => toggleChannel(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                channels.includes(id) ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-500'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <TestToggle test={test} onChange={setTest} />
      <ResultBanner result={result} />

      <button onClick={send} disabled={sending || !message.trim() || channels.length === 0}
        className="flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-40">
        <Send className="w-4 h-4" />
        {sending ? 'Sending…' : test ? 'Send Test Announcement' : `Send to ${members.filter(m => m.phone).length} Members`}
      </button>
    </div>
  )
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────
function LogTab({ logs, onRefresh }: { logs: SendLog[]; onRefresh: () => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Send Log</h3>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {logs.length === 0
        ? <p className="text-sm text-gray-500 text-center py-12">No sends logged yet.</p>
        : logs.map(l => (
          <div key={l.id} className={CARD + ' overflow-hidden'}>
            <button onClick={() => setExpanded(expanded === l.id ? null : l.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition text-left">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${CHANNEL_STYLE[l.channel] || 'bg-gray-700 text-gray-300'}`}>
                  {l.channel}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{l.recipient_name}</p>
                  <p className="text-xs text-gray-500">{TYPE_LABEL[l.type] || l.type} · {new Date(l.sent_at).toLocaleString()}{l.test ? ' · TEST' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {l.status === 'sent'
                  ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />
                }
                {expanded === l.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </button>
            {expanded === l.id && (
              <div className="border-t border-gray-700 px-4 py-3 space-y-2 bg-gray-900/40">
                <p className="text-xs text-gray-500">To: <span className="text-gray-300">{l.to}</span></p>
                {l.subject && <p className="text-xs text-gray-500">Subject: <span className="text-gray-300">{l.subject}</span></p>}
                {l.error && <p className="text-xs text-red-400">Error: {l.error}</p>}
                <pre className="text-xs text-gray-400 whitespace-pre-wrap bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">{l.body}</pre>
              </div>
            )}
          </div>
        ))
      }
    </div>
  )
}
