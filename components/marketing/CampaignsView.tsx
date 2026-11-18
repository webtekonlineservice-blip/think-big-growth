'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Link from 'next/link'
import {
  Users, Filter, Send, CheckCircle2, XCircle,
  AlertTriangle, Plus, Trash2, ChevronDown, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Segment = 'all' | 'invited' | 'visited' | 'applied'
type Channel = 'sms' | 'email' | 'both'

interface CampaignResult {
  total: number
  sms?: { sent: number; failed: number }
  email?: { sent: number; failed: number }
}

type RuleField =
  // Visitors
  | 'status' | 'days_since_visit_gte' | 'days_since_visit_lte' | 'has_visit_date'
  | 'days_since_created_gte' | 'has_phone' | 'has_email' | 'not_contacted_in_days'
  // Members
  | 'role_contains'
  // Prospects
  | 'sequence_step_gte' | 'sequence_step_eq' | 'opened_any' | 'clicked_any'
  | 'opened_step1_not_clicked' | 'prospect_status'

type Audience = 'visitors' | 'members' | 'prospects'

interface Rule { id: string; field: RuleField; value: string }

interface PreviewContact {
  id: string; name: string; email: string; phone?: string
  company?: string; status?: string; role?: string
  sequence_step?: number; opened_count?: number; visit_date?: string | null
}

const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const BTN = 'flex items-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-40'
const CARD = 'bg-gray-800/60 border border-gray-700 rounded-xl p-4'

// ─── Quick Send (legacy) ──────────────────────────────────────────────────────
const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All visitors (invited + visited + applied)',
  invited: 'Invited — registered but not yet visited',
  visited: 'Visited — attended a meeting',
  applied: 'Applied — submitted application',
}

const SMS_TEMPLATES = [
  { label: 'Meeting reminder', message: "Hi [name]! Think Big St. Louis meets this Thursday at 11:30 AM at Mike Duffy's in Kirkwood. Hope to see you there!" },
  { label: 'Follow-up after visit', message: "Hi [name]! Great meeting you at Think Big St. Louis. We'd love to have you in the chapter. Reply to learn more." },
  { label: 'Application nudge', message: "Hi [name], your BNI spot is still open! One per profession — apply at thinkbig.webtek.ai before it fills." },
]
const EMAIL_TEMPLATES = [
  { label: 'Meeting reminder', subject: "You're invited — Think Big St. Louis this Thursday", message: "Hi [name],\n\nJust a reminder — Think Big St. Louis BNI meets every Thursday at 11:30 AM at Mike Duffy's in Kirkwood, MO.\n\nGuests are always welcome!" },
  { label: 'Membership opportunity', subject: 'Your BNI seat may still be open', message: "Hi [name],\n\nYour professional category may still be available at Think Big St. Louis. BNI members generate real revenue through structured referrals — and with only one member per profession, there's no competition within the chapter." },
]

// ─── Rule configs per audience ────────────────────────────────────────────────
const VISITOR_RULES: { field: RuleField; label: string; type: 'select' | 'number' | 'text'; options?: { value: string; label: string }[] }[] = [
  { field: 'status', label: 'Status is', type: 'select', options: [
    { value: 'invited', label: 'Invited' },
    { value: 'visited', label: 'Visited' },
    { value: 'applied', label: 'Applied' },
    { value: 'not_member', label: 'Not yet a member' },
  ]},
  { field: 'has_visit_date', label: 'Has visit date', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { field: 'days_since_visit_gte', label: 'Visited at least N days ago', type: 'number' },
  { field: 'days_since_visit_lte', label: 'Visited within last N days', type: 'number' },
  { field: 'days_since_created_gte', label: 'Registered at least N days ago', type: 'number' },
  { field: 'not_contacted_in_days', label: 'Not contacted in last N days', type: 'number' },
  { field: 'has_phone', label: 'Has phone number', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { field: 'has_email', label: 'Has email', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
]

const MEMBER_RULES: typeof VISITOR_RULES = [
  { field: 'has_phone', label: 'Has phone number', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { field: 'has_email', label: 'Has real email', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { field: 'role_contains', label: 'Role/profession contains', type: 'text' },
]

const PROSPECT_RULES: typeof VISITOR_RULES = [
  { field: 'sequence_step_gte', label: 'Email step at least', type: 'number' },
  { field: 'sequence_step_eq', label: 'Exactly on email step', type: 'number' },
  { field: 'opened_any', label: 'Has opened any email', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (never opened)' }] },
  { field: 'clicked_any', label: 'Has clicked any link', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (never clicked)' }] },
  { field: 'opened_step1_not_clicked', label: 'Opened step 1 but never clicked (high intent)', type: 'select', options: [{ value: 'yes', label: 'Yes — find these' }] },
]

const RULES_BY_AUDIENCE: Record<Audience, typeof VISITOR_RULES> = {
  visitors: VISITOR_RULES,
  members: MEMBER_RULES,
  prospects: PROSPECT_RULES,
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminCampaignsPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [view, setView] = useState<'quick' | 'builder'>('quick')

  useEffect(() => { if (!user) return }, [user])

  if (authLoading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <div className="w-px h-4 bg-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-white">Campaigns</h1>
            <p className="text-xs text-gray-500">Send to segments of visitors, members, or prospects</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-fit mb-6">
          <button onClick={() => setView('quick')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition ${view === 'quick' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
            <Send className="w-4 h-4" /> Quick Send
          </button>
          <button onClick={() => setView('builder')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition ${view === 'builder' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
            <Filter className="w-4 h-4" /> Segment Builder
          </button>
        </div>

        {view === 'quick'   && <QuickSend />}
        {view === 'builder' && <SegmentBuilder />}
      </main>
    </div>
  )
}

// ─── Quick Send ───────────────────────────────────────────────────────────────
function QuickSend() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [error, setError] = useState('')
  const [segment, setSegment] = useState<Segment>('visited')
  const [channel, setChannel] = useState<Channel>('sms')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')

  const applyTemplate = (tmpl: { label: string; message: string; subject?: string }) => {
    setMessage(tmpl.message); if (tmpl.subject) setSubject(tmpl.subject); setResult(null); setError('')
  }

  const handleSend = async () => {
    if (!message.trim()) { setError('Message is required.'); return }
    if ((channel === 'email' || channel === 'both') && !subject.trim()) { setError('Subject is required.'); return }
    if (!confirm(`Send this ${channel} campaign to all "${segment}" visitors?`)) return
    setSending(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, channel, subject, message, ctaText, ctaUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send.'); return }
      setResult(data)
    } catch { setError('Network error.') }
    finally { setSending(false) }
  }

  const templates = channel === 'email' || channel === 'both' ? EMAIL_TEMPLATES : SMS_TEMPLATES

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className={CARD + ' space-y-4'}>
          <h2 className="text-sm font-semibold text-white">Audience & Channel</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Segment</label>
            <select className={INPUT} value={segment} onChange={(e) => setSegment(e.target.value as Segment)}>
              {(Object.keys(SEGMENT_LABELS) as Segment[]).map((s) => (
                <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel</label>
            <div className="flex gap-2">
              {(['sms', 'email', 'both'] as Channel[]).map((c) => (
                <button key={c} onClick={() => setChannel(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${channel === c ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                  {c === 'both' ? 'Both' : c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={CARD + ' space-y-4'}>
          <h2 className="text-sm font-semibold text-white">Message</h2>
          {(channel === 'email' || channel === 'both') && (
            <div><label className="block text-xs text-gray-500 mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT} placeholder="Email subject…" /></div>
          )}
          <div><label className="block text-xs text-gray-500 mb-1">Message <span className="text-gray-600">([name], [company] supported)</span></label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={INPUT} />
          </div>
          {(channel === 'email' || channel === 'both') && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">CTA Text</label><input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Visit Think Big →" className={INPUT} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">CTA URL</label><input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" className={INPUT} /></div>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {result && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
              ✓ Sent to {result.total} visitors.
              {result.sms && ` SMS: ${result.sms.sent} sent, ${result.sms.failed} failed.`}
              {result.email && ` Email: ${result.email.sent} sent, ${result.email.failed} failed.`}
            </div>
          )}
          <button onClick={handleSend} disabled={sending} className={BTN}>
            <Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send Campaign'}
          </button>
        </div>
      </div>

      {/* Templates sidebar */}
      <div className={CARD + ' space-y-3 h-fit'}>
        <h3 className="text-sm font-semibold text-white">Templates</h3>
        {templates.map((t) => (
          <button key={t.label} onClick={() => applyTemplate(t)}
            className="w-full text-left p-3 bg-gray-900 border border-gray-700 rounded-lg hover:border-gray-500 transition text-xs text-gray-300">
            <p className="font-medium text-white mb-1">{t.label}</p>
            <p className="truncate text-gray-500">{t.message.slice(0, 60)}…</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Segment Builder ──────────────────────────────────────────────────────────
function SegmentBuilder() {
  const [audience, setAudience] = useState<Audience>('visitors')
  const [rules, setRules] = useState<Rule[]>([])
  const [preview, setPreview] = useState<{ total: number; contacts: PreviewContact[]; rules: string[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [channels, setChannels] = useState<string[]>(['sms'])
  const [test, setTest] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null)
  const [expandPreview, setExpandPreview] = useState(false)

  const addRule = () => {
    const firstField = RULES_BY_AUDIENCE[audience][0]
    const defaultValue = firstField.options?.[0]?.value ?? ''
    setRules((r) => [...r, { id: Math.random().toString(36).slice(2), field: firstField.field, value: defaultValue }])
  }

  const updateRule = (id: string, patch: Partial<Rule>) =>
    setRules((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x))

  const removeRule = (id: string) => setRules((r) => r.filter((x) => x.id !== id))

  const runPreview = useCallback(async () => {
    setPreviewing(true); setPreview(null); setSendResult(null)
    try {
      const res = await fetch('/api/segments/preview', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: { audience, rules: rules.map((r) => ({ field: r.field, value: r.value })) } }),
      })
      const data = await res.json()
      if (res.ok) setPreview(data)
    } finally { setPreviewing(false) }
  }, [audience, rules])

  // Auto-preview on change
  useEffect(() => {
    const t = setTimeout(runPreview, 600)
    return () => clearTimeout(t)
  }, [runPreview])

  const toggleChannel = (ch: string) =>
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch])

  const handleSend = async () => {
    if (!preview?.contacts.length) return
    if (!message.trim()) { setSendResult({ ok: false, error: 'Message is required.' }); return }
    setSending(true); setSendResult(null)
    try {
      const res = await fetch('/api/segments/send', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: preview.contacts, channels, message, subject, test }),
      })
      const data = await res.json()
      setSendResult({
        ok: data.ok,
        message: data.ok
          ? `${test ? '[TEST] ' : ''}${data.sent} sent · ${data.failed} failed · ${data.skipped} skipped`
          : data.error,
      })
    } finally { setSending(false) }
  }

  const ruleConfigs = RULES_BY_AUDIENCE[audience]
  const totalLabel = preview ? `${preview.total} contact${preview.total !== 1 ? 's' : ''}` : '…'

  return (
    <div className="space-y-4">
      {/* Audience picker */}
      <div className={CARD + ' space-y-3'}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-brand-blue" /> Audience</h2>
        <div className="flex gap-2 flex-wrap">
          {(['visitors', 'members', 'prospects'] as Audience[]).map((a) => (
            <button key={a} onClick={() => { setAudience(a); setRules([]) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition capitalize ${
                audience === a ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400 hover:text-white'
              }`}>{a}</button>
          ))}
        </div>
      </div>

      {/* Rule builder */}
      <div className={CARD + ' space-y-3'}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Filter className="w-4 h-4 text-brand-blue" /> Filter Rules <span className="text-gray-600 font-normal">(all rules must match)</span></h2>
          <button onClick={addRule} className="flex items-center gap-1 text-xs text-brand-blue hover:underline"><Plus className="w-3.5 h-3.5" /> Add rule</button>
        </div>

        {rules.length === 0 && (
          <p className="text-xs text-gray-600 py-2">No rules — will match ALL {audience}. Add rules to narrow the segment.</p>
        )}

        {rules.map((rule) => {
          const cfg = ruleConfigs.find((r) => r.field === rule.field)
          return (
            <div key={rule.id} className="flex items-center gap-2 flex-wrap">
              <select value={rule.field} onChange={(e) => {
                const newField = e.target.value as RuleField
                const newCfg = ruleConfigs.find((r) => r.field === newField)
                updateRule(rule.id, { field: newField, value: newCfg?.options?.[0]?.value ?? '' })
              }} className={`${INPUT} flex-1 min-w-[180px]`}>
                {ruleConfigs.map((r) => <option key={r.field} value={r.field}>{r.label}</option>)}
              </select>

              {cfg?.type === 'select' ? (
                <select value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} className={`${INPUT} w-40`}>
                  {cfg.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : cfg?.type === 'number' ? (
                <input type="number" min="1" value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className={`${INPUT} w-24`} placeholder="days" />
              ) : (
                <input type="text" value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className={`${INPUT} w-40`} placeholder="value" />
              )}

              <button onClick={() => removeRule(rule.id)} className="text-gray-600 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          )
        })}
      </div>

      {/* Live preview */}
      <div className={CARD + ' space-y-2'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Preview</h2>
            {previewing && <RefreshCw className="w-3.5 h-3.5 text-gray-500 animate-spin" />}
            {preview && !previewing && (
              <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full font-semibold">{totalLabel}</span>
            )}
          </div>
          {preview && preview.contacts.length > 0 && (
            <button onClick={() => setExpandPreview((v) => !v)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
              {expandPreview ? 'Collapse' : `Show ${Math.min(preview.contacts.length, 10)}`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandPreview ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {preview && (
          <>
            {/* Rule summary */}
            <div className="flex flex-wrap gap-1.5">
              {preview.rules.map((r) => (
                <span key={r} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>

            {/* Contact list (expandable) */}
            {expandPreview && preview.contacts.length > 0 && (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-500 px-3 py-2">Name</th>
                      <th className="text-left text-gray-500 px-3 py-2 hidden sm:table-cell">Company</th>
                      <th className="text-left text-gray-500 px-3 py-2">Phone</th>
                      <th className="text-left text-gray-500 px-3 py-2 hidden sm:table-cell">Email</th>
                      <th className="text-left text-gray-500 px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.contacts.slice(0, 10).map((c) => (
                      <tr key={c.id} className="border-b border-gray-800/50">
                        <td className="px-3 py-2 text-gray-200 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{c.company || '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{c.phone || '—'}</td>
                        <td className="px-3 py-2 text-gray-400 hidden sm:table-cell truncate max-w-[140px]">{c.email || '—'}</td>
                        <td className="px-3 py-2"><span className="text-gray-500">{c.status || c.role || `step ${c.sequence_step ?? 0}`}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.total > 10 && <p className="text-xs text-gray-600 px-3 py-2">+ {preview.total - 10} more not shown</p>}
              </div>
            )}

            {preview.total === 0 && (
              <p className="text-xs text-yellow-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> No contacts match these rules.</p>
            )}
          </>
        )}
      </div>

      {/* Send */}
      {preview && preview.total > 0 && (
        <div className={CARD + ' space-y-4'}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Send className="w-4 h-4 text-brand-blue" /> Send to {totalLabel}</h2>

          {/* Channels */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Channels</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'sms', label: 'SMS' },
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'email', label: 'Email' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => toggleChannel(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    channels.includes(id) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {channels.includes('email') && (
            <div><label className="block text-xs text-gray-500 mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT} placeholder="Email subject…" /></div>
          )}

          <div><label className="block text-xs text-gray-500 mb-1">Message <span className="text-gray-600">([name], [company] supported)</span></label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={INPUT} placeholder="Write your message…" />
          </div>

          {/* Test toggle */}
          <label className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer border text-sm ${test ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} className="accent-yellow-500 mt-0.5" />
            <span>
              <span className={`font-semibold ${test ? 'text-yellow-400' : 'text-red-400'}`}>
                {test ? '🧪 Test mode — sends to admin only' : '🔴 Live mode — sends to real contacts'}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {test ? 'Routes to webtekdigitalai@gmail.com / +13149223810.' : `Will send to ${preview.total} real contacts.`}
              </span>
            </span>
          </label>

          {sendResult && (
            sendResult.ok
              ? <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3"><CheckCircle2 className="w-4 h-4 shrink-0" />{sendResult.message}</div>
              : <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3"><XCircle className="w-4 h-4 shrink-0" />{sendResult.error}</div>
          )}

          <button onClick={handleSend} disabled={sending || !message.trim() || channels.length === 0} className={BTN}>
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : test ? 'Send Test' : `Send to ${preview.total} Contacts`}
          </button>
        </div>
      )}
    </div>
  )
}
