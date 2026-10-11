'use client'

import { useState, useEffect } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Link from 'next/link'
import {
  Users, UserCircle, DollarSign, Target, Mail, CheckSquare,
  Calendar, AlertTriangle, ArrowRight, TrendingUp, Megaphone,
  Radio, Wallet, BarChart3, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashData {
  // Chapter
  memberCount: number
  // Visitors
  totalVisitors: number
  visitorsThisMonth: number
  conversionRate: number
  pendingVisitors: number          // invited/visited but not applied
  // Treasurer
  totalOwed: number
  membersOwing: number
  startingBalance: number
  recentLedger: { name: string; balance: number; photo?: string }[]
  // Outbound
  totalProspects: number
  totalSent: number
  openRate: number
  activeCampaigns: number
  // Seats
  seatsFilled: number
  seatsActive: number
  seatsOpen: number
  // Speaker
  nextMeeting: { date: string; speaker: string; speakerCompany?: string; speakerPhoto?: string } | null
  // Marketing sends (last 7 days)
  recentSends: number
  // Social posts
  scheduledPosts: number
}

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`
const TODAY = new Date().toISOString().split('T')[0]

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAdminAuth()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = async () => {
    try {
      const [
        membersRes, visitorsRes, speakersRes, ledgerRes, txRes,
        seatsRes, prospectsRes, campaignsRes, socialRes, mktLogsRes,
        settingsRes,
      ] = await Promise.all([
        fetch('/api/members', { credentials: 'include' }),
        fetch('/api/visitors', { credentials: 'include' }),
        fetch('/api/treasurer/speakers', { credentials: 'include' }),
        fetch('/api/treasurer/ledger', { credentials: 'include' }),
        fetch('/api/treasurer/transactions', { credentials: 'include' }),
        fetch('/api/seats', { credentials: 'include' }),
        fetch('/api/prospects?limit=1', { credentials: 'include' }),
        fetch('/api/prospects/campaigns', { credentials: 'include' }),
        fetch('/api/treasurer/social', { credentials: 'include' }),
        fetch('/api/marketing/logs?limit=100', { credentials: 'include' }),
        fetch('/api/treasurer/settings', { credentials: 'include' }),
      ])

      const members = membersRes.ok ? await membersRes.json() : []
      const visitors = visitorsRes.ok ? await visitorsRes.json() : []
      const speakers: { date: string; name: string; member_id: string | null }[] = speakersRes.ok ? await speakersRes.json() : []
      const ledger: { member_name: string; type: string; amount: number }[] = ledgerRes.ok ? await ledgerRes.json() : []
      const txs: { type: string; amount: number; sent_at?: string; date: string }[] = txRes.ok ? await txRes.json() : []
      const seatsJson = seatsRes.ok ? await seatsRes.json() : {}
      const seatsArr: { status: string }[] = Array.isArray(seatsJson) ? seatsJson : (seatsJson.seats ?? [])
      const prospectsData = prospectsRes.ok ? await prospectsRes.json() : { total: 0 }
      const campaigns: { active: boolean; total_sent: number; total_opened: number }[] = campaignsRes.ok ? await campaignsRes.json() : []
      const social: { status: string; date: string }[] = socialRes.ok ? await socialRes.json() : []
      const mktLogs: { sent_at: string }[] = mktLogsRes.ok ? await mktLogsRes.json() : []
      const settings = settingsRes.ok ? await settingsRes.json() : {}

      // ── Treasurer balances ──
      const balanceByMember = new Map<string, number>()
      for (const e of ledger) {
        const cur = balanceByMember.get(e.member_name) ?? 0
        if (e.type === 'charge' || e.type === 'opening') balanceByMember.set(e.member_name, cur + e.amount)
        else if (e.type === 'payment') balanceByMember.set(e.member_name, cur - e.amount)
      }
      const totalOwed = Array.from(balanceByMember.values()).filter(b => b > 0).reduce((s, b) => s + b, 0)
      const membersOwing = Array.from(balanceByMember.values()).filter(b => b > 0).length

      const recentLedger = members
        .map((m: { id: string; name: string; photo?: string }) => ({ name: m.name, balance: balanceByMember.get(m.name) ?? 0, photo: m.photo }))
        .filter((m: { balance: number }) => m.balance > 0)
        .sort((a: { balance: number }, b: { balance: number }) => b.balance - a.balance)
        .slice(0, 5)

      // ── Outbound ──
      const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0)
      const totalOpened = campaigns.reduce((s, c) => s + c.total_opened, 0)
      const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
      const activeCampaigns = campaigns.filter(c => c.active).length

      // ── Seats ──
      const seatsFilled = seatsArr.filter(s => s.status === 'filled').length
      const seatsActive = seatsArr.filter(s => s.status === 'active').length
      const seatsOpen = seatsArr.filter(s => s.status === 'open').length

      // ── Visitors ──
      const now = new Date()
      const visitorsThisMonth = visitors.filter((v: { created_at: string }) => {
        const d = new Date(v.created_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
      const converted = visitors.filter((v: { status: string }) => v.status === 'member').length
      const conversionRate = visitors.length > 0 ? Math.round((converted / visitors.length) * 100) : 0
      const pendingVisitors = visitors.filter((v: { status: string }) => v.status === 'invited' || v.status === 'visited').length

      // ── Next meeting / speaker ──
      const upcomingSpeakers = speakers.filter(s => s.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1)
      const nextSpeaker = upcomingSpeakers[0]
      const speakerMember = nextSpeaker ? members.find((m: { id: string; company?: string; photo?: string }) => m.id === nextSpeaker.member_id) : null
      const nextMeeting = nextSpeaker && nextSpeaker.name !== 'Speaker Name'
        ? { date: nextSpeaker.date, speaker: nextSpeaker.name, speakerCompany: speakerMember?.company, speakerPhoto: speakerMember?.photo }
        : null

      // ── Marketing sends last 7 days ──
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
      const recentSends = mktLogs.filter(l => l.sent_at > sevenDaysAgo).length

      // ── Scheduled social posts ──
      const scheduledPosts = social.filter(p => p.status === 'scheduled' && p.date >= TODAY).length

      setData({
        memberCount: members.length,
        totalVisitors: visitors.length,
        visitorsThisMonth,
        conversionRate,
        pendingVisitors,
        totalOwed,
        membersOwing,
        startingBalance: settings.startingBalance ?? 3201.49,
        recentLedger,
        totalProspects: prospectsData.total ?? 0,
        totalSent,
        openRate,
        activeCampaigns,
        seatsFilled,
        seatsActive,
        seatsOpen,
        nextMeeting,
        recentSends,
        scheduledPosts,
      })
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true)
    await load()
  }

  if (authLoading || loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Command Center</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── THIS THURSDAY ─────────────────────────────────────────────────── */}
      <NextMeetingCard nextMeeting={data.nextMeeting} />

      {/* ── KEY STATS  2×2 grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Members" value={data.memberCount.toString()}
          sub="Active chapter" color="text-white"
          Icon={UserCircle} href="/admin/members"
        />
        <StatTile
          label="Visitors" value={data.totalVisitors.toString()}
          sub={`${data.visitorsThisMonth} this month`} color="text-brand-blue"
          Icon={Users} href="/admin/visitors"
          badge={data.pendingVisitors > 0 ? `${data.pendingVisitors} pending` : undefined}
          badgeColor="yellow"
        />
        <StatTile
          label="Outstanding" value={money(data.totalOwed)}
          sub={`${data.membersOwing} member${data.membersOwing !== 1 ? 's' : ''} owe`}
          color="text-red-400" Icon={Wallet} href="/admin/treasurer"
          badge={data.totalOwed > 0 ? 'Needs attention' : undefined}
          badgeColor="red"
        />
        <StatTile
          label="Seats Filled" value={`${data.seatsFilled}/34`}
          sub={`${data.seatsActive} active · ${data.seatsOpen} open`}
          color="text-brand-red" Icon={CheckSquare} href="/admin/seats"
        />
      </div>

      {/* ── NEEDS ATTENTION ───────────────────────────────────────────────── */}
      {(data.recentLedger.length > 0 || data.pendingVisitors > 0) && (
        <NeedsAttention ledger={data.recentLedger} pendingVisitors={data.pendingVisitors} />
      )}

      {/* ── QUICK ACTIONS ─────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── OUTBOUND & MARKETING ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatusStrip
          title="Outbound Campaigns"
          Icon={Target}
          href="/admin/outbound"
          items={[
            { label: 'Prospects', value: data.totalProspects.toLocaleString(), color: 'text-brand-orange' },
            { label: 'Emails Sent', value: data.totalSent.toLocaleString(), color: 'text-purple-400' },
            { label: 'Open Rate', value: `${data.openRate}%`, color: 'text-green-400' },
            { label: 'Active', value: data.activeCampaigns.toString(), color: 'text-brand-blue' },
          ]}
        />
        <StatusStrip
          title="Marketing"
          Icon={Radio}
          href="/admin/marketing"
          items={[
            { label: 'Sends (7d)', value: data.recentSends.toString(), color: 'text-green-400' },
            { label: 'Scheduled Posts', value: data.scheduledPosts.toString(), color: 'text-brand-blue' },
            { label: 'Conversion', value: `${data.conversionRate}%`, color: 'text-purple-400' },
          ]}
        />
      </div>

      {/* ── SECONDARY STATS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Campaigns" value={data.activeCampaigns} sub="active" color="text-purple-400" />
        <MiniStat label="Visitors (mo)" value={data.visitorsThisMonth} sub="this month" color="text-brand-blue" />
        <MiniStat label="Open Rate" value={`${data.openRate}%`} sub="outbound email" color="text-green-400" />
        <MiniStat label="Open Seats" value={data.seatsOpen} sub="recruiting" color="text-brand-red" />
      </div>

      {/* ── CHAPTER HEALTH BAR ────────────────────────────────────────────── */}
      <ChapterHealth data={data} />

    </div>
  )
}

// ─── Next Meeting Card ────────────────────────────────────────────────────────
function NextMeetingCard({ nextMeeting }: { nextMeeting: DashData['nextMeeting'] }) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dateStr = nextMeeting?.date
    ? (() => { const [y,m,d] = nextMeeting.date.split('-').map(Number); return `${MONTHS[m-1]} ${d}, ${y}` })()
    : 'Next Thursday'

  return (
    <div className="bg-gradient-to-br from-brand-red/20 to-brand-red/5 border border-brand-red/30 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
            <span className="text-xs font-semibold text-brand-red uppercase tracking-widest">This Thursday</span>
          </div>
          <p className="text-base font-bold text-white">{dateStr}</p>
          <p className="text-xs text-gray-400 mt-0.5">11:30 AM · Mike Duffy's Pub & Grill, Kirkwood</p>
          {nextMeeting && (
            <div className="flex items-center gap-2 mt-3">
              {nextMeeting.speakerPhoto
                ? <img src={nextMeeting.speakerPhoto} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-brand-red/30 flex items-center justify-center text-xs font-bold text-brand-red shrink-0">
                    {nextMeeting.speaker.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
              }
              <div>
                <p className="text-sm font-semibold text-white">🎤 {nextMeeting.speaker}</p>
                {nextMeeting.speakerCompany && <p className="text-xs text-gray-500">{nextMeeting.speakerCompany}</p>}
              </div>
            </div>
          )}
          {!nextMeeting && (
            <Link href="/admin/treasurer" className="inline-flex items-center gap-1 text-xs text-brand-red mt-2 hover:underline">
              <Calendar className="w-3.5 h-3.5" /> Assign speaker →
            </Link>
          )}
        </div>
        <Link href="/admin/treasurer" className="shrink-0 text-xs text-gray-500 hover:text-white transition flex items-center gap-1">
          <Calendar className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color, Icon, href, badge, badgeColor }: {
  label: string; value: string; sub: string; color: string
  Icon: React.ElementType; href: string; badge?: string; badgeColor?: 'red' | 'yellow' | 'green'
}) {
  const badgeStyles = { red: 'bg-red-500/15 text-red-400', yellow: 'bg-yellow-500/15 text-yellow-400', green: 'bg-green-500/15 text-green-400' }
  return (
    <Link href={href} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition active:scale-[0.98] block">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <p className={`text-3xl font-black ${color} leading-none`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
      {badge && (
        <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyles[badgeColor || 'yellow']}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

// ─── Needs Attention ──────────────────────────────────────────────────────────
function NeedsAttention({ ledger, pendingVisitors }: {
  ledger: { name: string; balance: number; photo?: string }[]
  pendingVisitors: number
}) {
  return (
    <div className="bg-gray-800/60 border border-yellow-500/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-yellow-500/5">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
        <h3 className="text-sm font-semibold text-white">Needs Attention</h3>
      </div>
      <div className="divide-y divide-gray-700/50">
        {/* Members owing */}
        {ledger.map((m) => (
          <Link key={m.name} href="/admin/treasurer"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition">
            <div className="flex items-center gap-3">
              {m.photo
                ? <img src={m.photo} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-brand-red/20 flex items-center justify-center text-xs font-bold text-brand-red shrink-0">
                    {m.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
              }
              <div>
                <p className="text-sm text-gray-200 font-medium">{m.name}</p>
                <p className="text-xs text-gray-500">Unpaid balance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-red-400">{money(m.balance)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
            </div>
          </Link>
        ))}
        {/* Pending visitors */}
        {pendingVisitors > 0 && (
          <Link href="/admin/visitors"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-200 font-medium">{pendingVisitors} visitors pending</p>
                <p className="text-xs text-gray-500">Invited or visited — not yet applied</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActions() {
  const actions = [
    { label: 'Weekly Bill', href: '/admin/treasurer', icon: DollarSign, color: 'bg-brand-blue text-white' },
    { label: 'Send Reminder', href: '/admin/marketing', icon: Radio, color: 'bg-green-600 text-white' },
    { label: 'Invoice Member', href: '/admin/marketing', icon: Wallet, color: 'bg-brand-red text-white' },
    { label: 'New Visitor', href: '/admin/visitors', icon: Users, color: 'bg-purple-600 text-white' },
    { label: 'Social Post', href: '/admin/treasurer', icon: Megaphone, color: 'bg-pink-600 text-white' },
    { label: 'View Report', href: '/admin/treasurer', icon: BarChart3, color: 'bg-gray-700 text-white' },
  ]
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-3 gap-px bg-gray-700">
        {actions.map(({ label, href, icon: Icon, color }) => (
          <Link key={label} href={href}
            className="flex flex-col items-center gap-2 py-4 px-2 bg-gray-800/60 hover:bg-gray-700/60 transition active:scale-[0.97]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Status Strip ─────────────────────────────────────────────────────────────
function StatusStrip({ title, Icon, href, items }: {
  title: string
  Icon: React.ElementType
  href: string
  items: { label: string; value: string; color: string }[]
}) {
  return (
    <Link href={href} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition block">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-600" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900/60 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}

// ─── Mini Stat ────────────────────────────────────────────────────────────────
function MiniStat({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
    </div>
  )
}

// ─── Chapter Health Bar ───────────────────────────────────────────────────────
function ChapterHealth({ data }: { data: DashData }) {
  const metrics = [
    {
      label: 'Seats filled',
      value: data.seatsFilled,
      max: 34,
      color: 'bg-brand-red',
      pct: Math.round((data.seatsFilled / 34) * 100),
    },
    {
      label: 'Email open rate',
      value: data.openRate,
      max: 100,
      color: 'bg-green-500',
      pct: data.openRate,
      suffix: '%',
    },
    {
      label: 'Visitor conversion',
      value: data.conversionRate,
      max: 100,
      color: 'bg-brand-blue',
      pct: data.conversionRate,
      suffix: '%',
    },
  ]

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-brand-blue" />
        <h3 className="text-sm font-semibold text-white">Chapter Health</h3>
      </div>
      <div className="space-y-4">
        {metrics.map(({ label, value, pct, color, suffix }) => (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-200 font-semibold">{value}{suffix ?? ''}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2">
              <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <span>Starting Balance: <span className="text-green-400 font-semibold">${data.startingBalance.toFixed(2)}</span></span>
        <span>Outstanding: <span className="text-red-400 font-semibold">${data.totalOwed.toFixed(2)}</span></span>
      </div>
    </div>
  )
}
