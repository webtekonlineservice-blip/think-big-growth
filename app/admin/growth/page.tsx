'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Markdown from '@/components/Markdown'
import {
  TrendingUp, Sparkles, RefreshCw, Send, Users, Megaphone,
  Target, Share2, CheckCircle2, Loader2, AlertTriangle, ArrowRight,
} from 'lucide-react'

// ─── Types (mirror lib/growthAI.ts & lib/growthSnapshot.ts) ────────────────────
interface StaleVisitor { id: string; name: string; email: string; phone: string; company: string; status: string; daysSince: number }
interface Snapshot {
  chapterName: string
  members: { total: number }
  visitors: { total: number; invited: number; visited: number; applied: number; becameMembers: number; newThisMonth: number; staleNoFollowup: StaleVisitor[] }
  seats: { openProfessions: string[]; withReadyProspects: { profession: string; prospectsReady: number }[] }
  prospects: { total: number; neverContacted: number; inSequence: number; converted: number }
  momentum: { lastScrapeAt: string | null; daysSinceLastScrape: number | null; outreachLast7Days: number; scrapesLast30Days: number }
  signals: string[]
}
interface GrowthAction {
  type: 'sms_segment' | 'email_segment' | 'outreach_prospects' | 'social_post' | 'manual'
  target?: string; channels?: string[]; draft?: string; subject?: string; socialType?: string; platform?: string
}
interface GrowthMove { id: string; priority: 'high' | 'medium' | 'low'; title: string; why: string; impact: string; action: GrowthAction }
interface GrowthPlan { headline: string; summary: string; moves: GrowthMove[] }
interface ChatMsg { role: 'user' | 'assistant'; content: string }

const CARD = 'bg-gray-800/60 border border-gray-700 rounded-xl'
const BTN_PRIMARY = 'flex items-center justify-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-50'
const BTN_GHOST = 'flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50'

const PRIORITY_STYLE: Record<string, string> = {
  high: 'border-red-500/40 bg-red-500/5',
  medium: 'border-brand-blue/40 bg-brand-blue/5',
  low: 'border-gray-700 bg-gray-800/40',
}
const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  low: 'bg-gray-700 text-gray-400 border-gray-600',
}
const ACTION_ICON: Record<string, typeof Users> = {
  sms_segment: Users, email_segment: Megaphone, outreach_prospects: Target, social_post: Share2, manual: CheckCircle2,
}

export default function GrowthPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [tab, setTab] = useState<'plan' | 'chat'>('plan')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [plan, setPlan] = useState<GrowthPlan | null>(null)
  const [loadingSnap, setLoadingSnap] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState('')

  // Load snapshot immediately (cheap, no AI). Plan is generated on demand.
  const loadSnapshot = useCallback(async () => {
    setLoadingSnap(true)
    try {
      const res = await fetch('/api/growth/snapshot', { credentials: 'include' })
      if (res.ok) setSnapshot(await res.json())
    } finally {
      setLoadingSnap(false)
    }
  }, [])

  useEffect(() => { if (user) loadSnapshot() }, [user, loadSnapshot])

  const generatePlan = async () => {
    setLoadingPlan(true)
    setError('')
    try {
      const res = await fetch('/api/growth/plan', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to generate plan.'); return }
      setSnapshot(data.snapshot)
      setPlan(data.plan)
    } catch {
      setError('Network error generating plan.')
    } finally {
      setLoadingPlan(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-blue" /> Growth Advisor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your AI co-pilot for filling seats and booking visitors</p>
        </div>
        <Link href="/admin" className="text-gray-400 hover:text-white text-sm shrink-0 pt-1">
          <span className="sm:hidden">←</span><span className="hidden sm:inline">← Dashboard</span>
        </Link>
      </div>

      {/* Snapshot strip */}
      <SnapshotStrip snapshot={snapshot} loading={loadingSnap} onRefresh={loadSnapshot} />

      {/* Tabs */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 my-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-max sm:w-fit">
          {([['plan', 'Weekly Plan', Sparkles], ['chat', 'Ask the Advisor', Megaphone]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === id ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {tab === 'plan' ? (
        <PlanTab plan={plan} loading={loadingPlan} onGenerate={generatePlan} snapshot={snapshot} />
      ) : (
        <ChatTab />
      )}
    </div>
  )
}

// ─── Snapshot strip ─────────────────────────────────────────────────────────
function SnapshotStrip({ snapshot, loading, onRefresh }: { snapshot: Snapshot | null; loading: boolean; onRefresh: () => void }) {
  const stats = snapshot ? [
    { label: 'Members', value: snapshot.members.total },
    { label: 'Open seats', value: snapshot.seats.openProfessions.length, accent: snapshot.seats.openProfessions.length > 0 ? 'text-brand-blue' : 'text-gray-200' },
    { label: 'Visitors (mo)', value: snapshot.visitors.newThisMonth },
    { label: 'Need follow-up', value: snapshot.visitors.staleNoFollowup.length, accent: snapshot.visitors.staleNoFollowup.length > 0 ? 'text-red-400' : 'text-gray-200' },
    { label: 'Uncontacted leads', value: snapshot.prospects.neverContacted },
  ] : []

  return (
    <div className={CARD + ' p-4'}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Chapter snapshot</h2>
        <button onClick={onRefresh} className="text-gray-500 hover:text-white transition" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading && !snapshot ? (
        <p className="text-sm text-gray-500">Loading live numbers…</p>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-gray-900/50 rounded-lg px-3 py-2.5">
                <p className={`text-xl font-bold ${s.accent || 'text-gray-200'}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {snapshot.signals.length > 0 && (
            <ul className="mt-3 space-y-1">
              {snapshot.signals.slice(0, 4).map((sig, i) => (
                <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                  <span className="text-brand-blue mt-0.5">•</span> {sig}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">No data.</p>
      )}
    </div>
  )
}

// ─── Plan tab ────────────────────────────────────────────────────────────────
function PlanTab({ plan, loading, onGenerate, snapshot }: { plan: GrowthPlan | null; loading: boolean; onGenerate: () => void; snapshot: Snapshot | null }) {
  if (loading) {
    return (
      <div className={CARD + ' p-8 text-center'}>
        <Loader2 className="w-6 h-6 text-brand-blue animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Analyzing your chapter and building this week&apos;s growth plan…</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className={CARD + ' p-8 text-center'}>
        <Sparkles className="w-8 h-8 text-brand-blue mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">Generate this week&apos;s growth plan</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
          The advisor reads your live chapter data and recommends 3–5 prioritized moves to book more visitors and fill open seats. Nothing sends without your approval.
        </p>
        <button onClick={onGenerate} className={BTN_PRIMARY + ' mx-auto'}>
          <Sparkles className="w-4 h-4" /> Generate plan
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={CARD + ' p-4'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">{plan.headline}</h3>
            <p className="text-sm text-gray-400 mt-1">{plan.summary}</p>
          </div>
          <button onClick={onGenerate} className={BTN_GHOST + ' shrink-0'} title="Regenerate">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {plan.moves.map((m) => <MoveCard key={m.id} move={m} snapshot={snapshot} />)}
    </div>
  )
}

// ─── Move card with Approve action ─────────────────────────────────────────────
function MoveCard({ move, snapshot }: { move: GrowthMove; snapshot: Snapshot | null }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const Icon = ACTION_ICON[move.action.type] || CheckCircle2
  const a = move.action

  // Resolve the audience into live contacts for a segment send (test-first).
  const sendTest = async () => {
    setSending(true)
    setResult('')
    try {
      const channels = (a.channels && a.channels.length ? a.channels : ['sms']).filter((c) => ['sms', 'whatsapp', 'email'].includes(c))
      const res = await fetch('/api/segments/send', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [{ id: 'test', name: 'Test', email: 'webtekdigitalai@gmail.com', phone: '+13149223810' }],
          channels, message: a.draft || move.title, subject: a.subject || move.title, test: true,
        }),
      })
      const data = await res.json()
      setResult(res.ok ? `✓ Test ${channels.join(' + ')} sent to you` : `✗ ${data.error || 'Failed'}`)
    } catch {
      setResult('✗ Network error')
    } finally {
      setSending(false)
    }
  }

  // Deep links that carry the draft into the existing tools for a full send.
  const campaignsHref = `/admin/campaigns?draft=${encodeURIComponent(a.draft || '')}&audience=${a.type === 'outreach_prospects' ? 'prospects' : 'visitors'}`
  const socialHref = `/admin/treasurer?tab=social`

  const isSegment = a.type === 'sms_segment' || a.type === 'email_segment' || a.type === 'outreach_prospects'

  return (
    <div className={`${CARD} border ${PRIORITY_STYLE[move.priority]} p-4`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-900/70 border border-gray-700 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-brand-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-white">{move.title}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${PRIORITY_BADGE[move.priority]}`}>{move.priority}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{move.why}</p>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> {move.impact}</p>

          {a.draft && (
            <div className="mt-3 bg-gray-900/60 border border-gray-700 rounded-lg p-3">
              {a.subject && <p className="text-xs text-gray-500 mb-1">Subject: <span className="text-gray-300">{a.subject}</span></p>}
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{a.draft}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {isSegment && (
              <>
                <button onClick={sendTest} disabled={sending} className={BTN_GHOST}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Test to me
                </button>
                <Link href={campaignsHref} className={BTN_PRIMARY}>
                  Open in Campaigns <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
            {a.type === 'social_post' && (
              <Link href={socialHref} className={BTN_PRIMARY}>
                <Share2 className="w-4 h-4" /> Create the post
              </Link>
            )}
            {a.type === 'manual' && (
              <span className="text-xs text-gray-500">Manual action — no automated send.</span>
            )}
            {result && <span className={`text-xs ${result.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{result}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Chat tab ────────────────────────────────────────────────────────────────
const SUGGESTED = [
  'Who should I invite this week?',
  'Draft 5 texts to our open-seat prospects',
  'Why are we not growing?',
  'What should I post on social this week?',
]

function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || sending) return
    const history = messages.slice()
    setMessages((m) => [...m, { role: 'user', content: q }])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/growth/chat', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: res.ok ? data.reply : `⚠️ ${data.error || 'Failed'}` }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Network error.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={CARD + ' flex flex-col h-[60vh]'}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Megaphone className="w-8 h-8 text-brand-blue mb-3" />
            <p className="text-sm text-gray-400 mb-4 max-w-sm">Ask the advisor anything about growing the chapter. It answers from your live data.</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-xs border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-800 hover:text-white transition">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-brand-blue text-white whitespace-pre-wrap' : 'bg-gray-900/70 border border-gray-700 text-gray-200'}`}>
              {m.role === 'user' ? m.content : <Markdown content={m.content} />}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-900/70 border border-gray-700 rounded-2xl px-4 py-2.5">
              <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-700 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input) }}
          placeholder="Ask the Growth Advisor…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
        />
        <button onClick={() => send(input)} disabled={sending || !input.trim()} className={BTN_PRIMARY}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
