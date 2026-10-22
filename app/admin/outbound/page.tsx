'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Link from 'next/link'
import {
  Send, Plus, Trash2, Zap, ToggleLeft, ToggleRight,
  Search, Upload, X, Mail, MousePointerClick, Users,
  ChevronDown, ChevronRight, Eye, RefreshCw,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────
interface Campaign {
  id: string; name: string; description: string; invite_code: string
  sequence_count: number; batch_size: number; active: boolean
  total_prospects: number; total_sent: number; total_opened: number
  total_clicked: number; total_unsubscribed: number; created_at: string
}
interface Prospect {
  id: string; name: string; email: string; company: string
  profession: string; phone: string; source: string; status: string
  sequence_step: number; opened_count: number; clicked_count: number
  unsubscribed: boolean; ai_score: number; ai_first_line: string
}

const SCORE_CLS = (s: number) =>
  s >= 8 ? 'bg-green-500/20 text-green-400 border-green-500/20' :
  s >= 5 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
  'bg-gray-800 text-gray-500 border-gray-700'

const STATUS_CLS = (p: Prospect) =>
  p.unsubscribed ? 'text-red-400' :
  p.sequence_step === 0 ? 'text-gray-500' :
  p.sequence_step === 3 ? 'text-green-400' : 'text-brand-blue'

const STATUS_LABEL = (p: Prospect) =>
  p.unsubscribed ? 'Unsub' :
  p.sequence_step === 0 ? 'Queued' :
  `Email ${p.sequence_step}/3`

const DEFAULT_SEQUENCE = [
  { step: 1, delay_days: 0, subject: "[name], there's an open seat in your category at Think Big St. Louis", body: "Hi [name],\n\nI came across [company] and noticed you're in [profession] — which happens to be an open category at our BNI chapter, Think Big St. Louis.\n\nBNI is a structured referral group where each profession gets one exclusive seat. Members meet weekly and actively pass referrals to each other. No competition — just collaboration.\n\nWe meet every Thursday at 11:30 AM at Mike Duffy's in Kirkwood, MO. Guests visit free, no commitment.\n\nWould you be open to checking it out?", cta_text: 'Learn More & Register →', cta_url: '' },
  { step: 2, delay_days: 4, subject: "How [company] could get referrals every single week", body: "Hi [name],\n\nQuick follow-up — I wanted to share what makes Think Big St. Louis different from typical networking.\n\nOur members don't just exchange business cards. Each week, we:\n• Give a 60-second pitch to the group\n• Pass qualified referrals to each other\n• Hold each other accountable for growth\n\nBNI chapters worldwide generate billions in referred business annually. And since only one [profession] can hold the seat, you'd have zero competition within the group.\n\nWorth 90 minutes of your Thursday to see if it fits?", cta_text: 'Reserve Your Guest Spot →', cta_url: '' },
  { step: 3, delay_days: 4, subject: 'Last thought — your Thursday seat at Think Big', body: "Hi [name],\n\nLast note from me — I don't want to be a pest.\n\nThe [profession] seat at Think Big St. Louis is still open. If you've been thinking about a reliable way to get more referrals for [company], this is it.\n\nFree to visit. Thursday 11:30 AM. Mike Duffy's Pub & Grill, Kirkwood.\n\nIf now's not the right time, no worries at all. But if you're curious, the link below takes 30 seconds.\n\nEither way — wishing you a great week.", cta_text: "I'm Interested →", cta_url: '' },
]

// ─── Main page ──────────────────────────────────────────────────────────────
export default function OutboundPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loadingP, setLoadingP] = useState(false)
  const [openCategories, setOpenCategories] = useState<string[]>([])

  // Mobile: campaign list collapsed by default
  const [listOpen, setListOpen] = useState(false)

  // Send controls
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [toggling, setToggling] = useState(false)
  const [batchSize, setBatchSize] = useState(10)
  const [savingBatch, setSavingBatch] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  // Prospects controls
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'sent' | 'opened' | 'unsub'>('all')
  const [enrichStats, setEnrichStats] = useState<{ total: number; hasEmail: number; needsEnrichment: number } | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichMsg, setEnrichMsg] = useState('')

  // Import
  const [showImport, setShowImport] = useState(false)
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const fetchCampaigns = useCallback(async () => {
    const r = await fetch('/api/prospects/campaigns', { credentials: 'include' })
    if (r.ok) {
      const list: Campaign[] = await r.json()
      setCampaigns(list)
      if (list.length && !selectedId) setSelectedId(list[0].id)
    }
  }, [selectedId])

  const fetchProspects = useCallback(async (id: string) => {
    setLoadingP(true)
    const r = await fetch(`/api/prospects?campaign_id=${id}&limit=200`, { credentials: 'include' })
    if (r.ok) setProspects((await r.json()).prospects || [])
    setLoadingP(false)
  }, [])

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetchCampaigns(),
      fetch('/api/prospects/enrich', { credentials: 'include' }).then(r => r.ok ? r.json().then(setEnrichStats) : null),
      fetch('/api/categories', { credentials: 'include' }).then(r => r.ok ? r.json().then((d: { openCategories: string[] }) => setOpenCategories(d.openCategories || [])) : null),
    ]).finally(() => setLoading(false))
  }, [user, fetchCampaigns])

  useEffect(() => {
    if (selectedId) fetchProspects(selectedId)
  }, [selectedId, fetchProspects])

  useEffect(() => {
    const c = campaigns.find(x => x.id === selectedId)
    if (c) setBatchSize(c.batch_size || 10)
  }, [selectedId, campaigns])

  const active = campaigns.find(c => c.id === selectedId)

  const selectCampaign = (id: string) => {
    setSelectedId(id)
    setListOpen(false)
    setSearch('')
    setStatusFilter('all')
    setSendMsg('')
    setImportResult(null)
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const createCampaign = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const r = await fetch('/api/prospects/campaigns', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, sequence: DEFAULT_SEQUENCE }),
    })
    if (r.ok) {
      const c = await r.json()
      await fetchCampaigns()
      setSelectedId(c.id)
      setShowCreate(false)
      setNewName('')
    }
    setCreating(false)
  }

  const toggleActive = async () => {
    if (!active) return
    setToggling(true)
    await fetch(`/api/prospects/campaigns/${active.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active.active }),
    })
    await fetchCampaigns()
    setToggling(false)
  }

  const saveBatch = async () => {
    if (!selectedId) return
    setSavingBatch(true)
    await fetch(`/api/prospects/campaigns/${selectedId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_size: batchSize }),
    })
    setSavingBatch(false)
  }

  const sendBatch = async () => {
    if (!selectedId || !confirm(`Send next batch of up to ${batchSize} emails now?`)) return
    setSending(true); setSendMsg('')
    try {
      const r = await fetch(`/api/prospects/campaigns/${selectedId}/send`, { method: 'POST', credentials: 'include' })
      const d = await r.json()
      setSendMsg(r.ok ? `✓ Sent ${d.sent} emails` : `✗ ${d.error || 'Failed'}`)
      if (r.ok) await fetchCampaigns()
    } catch { setSendMsg('✗ Network error') }
    setSending(false)
  }

  const deleteProspect = async (id: string) => {
    if (!confirm('Remove this prospect?')) return
    await fetch(`/api/prospects/${id}`, { method: 'DELETE', credentials: 'include' })
    setProspects(p => p.filter(x => x.id !== id))
  }

  const enrich = async () => {
    setEnriching(true); setEnrichMsg('')
    const r = await fetch('/api/prospects/enrich', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: selectedId, limit: 50 }),
    })
    if (r.ok) {
      const d = await r.json()
      setEnrichMsg(`✓ Found ${d.enriched} emails`)
      if (selectedId) await fetchProspects(selectedId)
      const er = await fetch('/api/prospects/enrich', { credentials: 'include' })
      if (er.ok) setEnrichStats(await er.json())
    }
    setEnriching(false)
  }

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
      const rows: Array<Record<string, string>> = []
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSV(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? '' })
        rows.push(row)
      }
      setCsvData(rows); setImportResult(null)
    }
    reader.readAsText(file)
  }

  const importCSV = async () => {
    if (!selectedId || !csvData.length) return
    setImporting(true)
    const normalized = csvData.map(row => ({
      name: row.name || row.business_name || row.title || '',
      email: row.email || row.e_mail || row.email_address || '',
      company: row.company || row.business_name || '',
      profession: row.profession || row.category || row.industry || '',
      phone: row.phone || row.telephone || '',
      website: row.website || row.url || '',
      source: 'csv_import',
    }))
    const r = await fetch('/api/prospects', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: selectedId, prospects: normalized }),
    })
    if (r.ok) {
      const d = await r.json()
      setImportResult(d)
      setCsvData([])
      await fetchCampaigns()
      await fetchProspects(selectedId)
    }
    setImporting(false)
  }

  // ── Filtered prospects ────────────────────────────────────────────────────
  const filtered = prospects.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) ||
      p.profession.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'queued' ? p.sequence_step === 0 && !p.unsubscribed :
      statusFilter === 'sent' ? p.sequence_step > 0 && !p.unsubscribed :
      statusFilter === 'opened' ? p.opened_count > 0 :
      p.unsubscribed
    return matchSearch && matchStatus
  })

  const isOpenSeat = (prof: string) => {
    if (!prof) return false
    const p = prof.toLowerCase()
    return openCategories.some(cat => { const c = cat.toLowerCase(); return c.includes(p) || p.includes(c.split(' / ')[0]) })
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full min-h-screen">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm shrink-0">
            <span className="sm:hidden">←</span><span className="hidden sm:inline">← Dashboard</span>
          </Link>
          <div className="w-px h-4 bg-gray-700 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white flex items-center gap-1.5">
              <Send className="w-4 h-4 text-brand-blue shrink-0" /> Outbound Pipeline
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/admin/lead-engine"
            className="flex items-center gap-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-brand-blue/50 px-3 py-1.5 rounded-lg transition">
            <Zap className="w-3.5 h-3.5" /><span className="hidden sm:inline">Lead Engine</span>
          </Link>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-blue text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-blue/90 transition">
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + main ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Campaign sidebar ───────────────────────────────────────────────── */}
        {/* Mobile: collapsible dropdown */}
        <div className="lg:hidden border-b border-gray-800 px-4 py-2">
          <button onClick={() => setListOpen(v => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-white">
            <span className="font-medium truncate">{active?.name || 'Select campaign'}</span>
            <div className="flex items-center gap-2 shrink-0">
              {active && <span className={`w-1.5 h-1.5 rounded-full ${active.active ? 'bg-green-400' : 'bg-gray-600'}`} />}
              {listOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </button>
          {listOpen && (
            <div className="mt-2 space-y-1 pb-2">
              {campaigns.map(c => (
                <button key={c.id} onClick={() => selectCampaign(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition ${
                    c.id === selectedId ? 'bg-brand-blue/20 border border-brand-blue/30 text-white' : 'hover:bg-gray-800 text-gray-400'
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.active ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span className="text-sm truncate font-medium">{c.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{c.total_prospects} leads</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: fixed sidebar */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-gray-800 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Campaigns</p>
          </div>
          <nav className="flex-1 px-3 space-y-1 pb-4">
            {campaigns.length === 0 ? (
              <p className="text-xs text-gray-600 px-2 py-3">No campaigns yet.</p>
            ) : campaigns.map(c => {
              const openRate = c.total_sent > 0 ? Math.round(c.total_opened / c.total_sent * 100) : 0
              return (
                <button key={c.id} onClick={() => selectCampaign(c.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition group ${
                    c.id === selectedId ? 'bg-gray-800 border border-gray-700' : 'hover:bg-gray-800/50'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate leading-tight">{c.name}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${c.active ? 'bg-green-400' : 'bg-gray-600'}`} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.total_prospects}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.total_sent}</span>
                    {openRate > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{openRate}%</span>}
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ── Main panel ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">

          {!active ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Send className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm mb-4">
                {campaigns.length === 0 ? "No campaigns yet. Create one to start sending." : "Select a campaign from the list."}
              </p>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition">
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            </div>
          ) : (
            <>
              {/* Campaign header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{active.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {active.sequence_count || 3}-email drip · created {new Date(active.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Automation toggle */}
                  <button onClick={toggleActive} disabled={toggling}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-50 ${
                      active.active ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-gray-700 bg-gray-800 text-gray-400'
                    }`}>
                    {active.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {toggling ? '…' : active.active ? 'Auto ON' : 'Auto OFF'}
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Leads', value: active.total_prospects, icon: Users, color: 'text-white' },
                  { label: 'Sent', value: active.total_sent, icon: Send, color: 'text-brand-blue' },
                  { label: 'Opened', value: active.total_opened, icon: Eye, color: 'text-cyan-400' },
                  { label: 'Clicked', value: active.total_clicked, icon: MousePointerClick, color: 'text-green-400' },
                  {
                    label: 'Open rate',
                    value: active.total_sent > 0 ? `${Math.round(active.total_opened / active.total_sent * 100)}%` : '—',
                    icon: Eye, color: 'text-cyan-400',
                  },
                  { label: 'Unsubs', value: active.total_unsubscribed, icon: X, color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Send controls */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Emails / day</p>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={100} value={batchSize}
                        onChange={e => setBatchSize(parseInt(e.target.value) || 10)}
                        className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
                      {savingBatch && <span className="text-xs text-gray-500">Saving…</span>}
                      {batchSize !== (active.batch_size || 10) && (
                        <button onClick={saveBatch} className="text-xs text-brand-blue hover:text-white transition">Save</button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    When automation is on, the daily cron sends this many emails automatically.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full sm:w-auto shrink-0">
                  <button onClick={sendBatch} disabled={sending}
                    className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition whitespace-nowrap">
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending…' : `Send Next ${batchSize} Now`}
                  </button>
                  {sendMsg && <p className={`text-xs text-center ${sendMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{sendMsg}</p>}
                </div>
              </div>

              {/* Prospect toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-0 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search prospects…"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
                </div>
                {/* Status filter */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {(['all', 'queued', 'sent', 'opened', 'unsub'] as const).map(f => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className={`px-3 py-2 text-xs font-medium capitalize transition ${statusFilter === f ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {/* Enrich + import */}
                {enrichStats && enrichStats.needsEnrichment > 0 && (
                  <button onClick={enrich} disabled={enriching}
                    className="flex items-center gap-1.5 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-xs transition disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${enriching ? 'animate-spin' : ''}`} />
                    {enriching ? 'Finding…' : `Find ${enrichStats.needsEnrichment} emails`}
                  </button>
                )}
                {enrichMsg && <span className="text-xs text-green-400">{enrichMsg}</span>}
                <button onClick={() => setShowImport(v => !v)}
                  className="flex items-center gap-1.5 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-xs transition ml-auto">
                  <Upload className="w-3.5 h-3.5" />
                  {showImport ? 'Close import' : 'Import CSV'}
                </button>
                <span className="text-xs text-gray-500 shrink-0">{filtered.length} prospects</span>
              </div>

              {/* CSV import panel */}
              {showImport && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-gray-400" /> Import from CSV
                    </h3>
                    <Link href="/admin/lead-engine" className="text-xs text-brand-blue hover:text-white transition flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Or use Lead Engine
                    </Link>
                  </div>
                  <p className="text-xs text-gray-500">Columns: <code className="text-brand-blue">email, name, company, profession, phone, website</code></p>
                  <input type="file" accept=".csv" onChange={handleCSV}
                    className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-blue/20 file:text-brand-blue hover:file:bg-brand-blue/30 cursor-pointer" />
                  {csvData.length > 0 && (
                    <div>
                      <p className="text-xs text-green-400 mb-2">{csvData.length} rows ready</p>
                      <button onClick={importCSV} disabled={importing}
                        className="flex items-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-brand-blue/90 transition disabled:opacity-50">
                        {importing ? 'Importing…' : `Import ${csvData.length} prospects`}
                      </button>
                    </div>
                  )}
                  {importResult && (
                    <p className="text-xs text-green-400">✓ Imported {importResult.imported} · Skipped {importResult.skipped} duplicates</p>
                  )}
                </div>
              )}

              {/* Prospect table */}
              {loadingP ? (
                <div className="text-center py-10"><div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-10 text-center">
                  <p className="text-gray-500 text-sm">
                    {prospects.length === 0 ? 'No prospects yet — import a CSV or use the Lead Engine.' : 'No prospects match your filter.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {filtered.map(p => (
                      <div key={p.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-white font-medium text-sm truncate">{p.name || p.company || '—'}</p>
                            <p className="text-gray-400 text-xs break-all">{p.email && !p.email.includes('placeholder') ? p.email : p.phone || '—'}</p>
                          </div>
                          <button onClick={() => deleteProspect(p.id)} className="text-gray-600 hover:text-red-400 shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isOpenSeat(p.profession) ? 'bg-green-500/15 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                            {p.profession || 'Unknown'}
                          </span>
                          <span className={`text-xs font-medium ${STATUS_CLS(p)}`}>{STATUS_LABEL(p)}</span>
                          {p.ai_score > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${SCORE_CLS(p.ai_score)}`}>{p.ai_score}/10</span>}
                          {p.opened_count > 0 && <span className="text-xs text-cyan-400">{p.opened_count} opens</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block bg-gray-900/60 border border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 bg-gray-800/50">
                          {['Name / Company', 'Contact', 'Profession', 'Score', 'Step', 'Engagement', ''].map(h => (
                            <th key={h} className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 first:pl-5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {filtered.map(p => (
                          <tr key={p.id} className="hover:bg-gray-800/40 transition-colors group">
                            <td className="px-4 pl-5 py-3">
                              <p className="text-white font-medium leading-tight">{p.name || '—'}</p>
                              {p.company && p.company !== p.name && <p className="text-gray-500 text-xs mt-0.5 truncate">{p.company}</p>}
                            </td>
                            <td className="px-4 py-3">
                              {p.email && !p.email.includes('placeholder')
                                ? <p className="text-gray-300 text-xs truncate max-w-[180px]">{p.email}</p>
                                : <span className="text-gray-600 text-xs">no email</span>}
                              {p.phone && <p className="text-gray-500 text-xs">{p.phone}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${isOpenSeat(p.profession) ? 'bg-green-500/15 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                {p.profession || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {p.ai_score > 0
                                ? <span className={`text-xs font-bold px-2 py-0.5 rounded border ${SCORE_CLS(p.ai_score)}`}>{p.ai_score}/10</span>
                                : <span className="text-gray-700 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${STATUS_CLS(p)}`}>{STATUS_LABEL(p)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 text-xs">
                                {p.opened_count > 0 && <span className="text-cyan-400 flex items-center gap-1"><Eye className="w-3 h-3" />{p.opened_count}</span>}
                                {p.clicked_count > 0 && <span className="text-green-400 flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{p.clicked_count}</span>}
                                {!p.opened_count && !p.clicked_count && <span className="text-gray-700">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteProspect(p.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Create Campaign Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-1">New Outbound Campaign</h3>
            <p className="text-sm text-gray-400 mb-5">Creates a 3-email drip sequence — customize it after creation.</p>
            <label className="label">Campaign name *</label>
            <input className="input-field mb-5" value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Kirkwood Chamber — Financial Advisors"
              autoFocus onKeyDown={e => e.key === 'Enter' && createCampaign()} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCreate(false); setNewName('') }} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button onClick={createCampaign} disabled={creating || !newName.trim()} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                {creating ? 'Creating…' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function parseCSV(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result
}
