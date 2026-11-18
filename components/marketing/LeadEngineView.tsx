'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import Link from 'next/link'
import {
  Zap, Building2, RefreshCw, Play, CheckCircle2, AlertTriangle,
  TrendingUp, Mail, Phone, Star, Users, BarChart3, Bell, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Chamber {
  id: string
  name: string
  area: string
  estimatedMembers: number
  priority: 'high' | 'medium' | 'low'
  note?: string
  lastRun: { ran_at: string; found: number; imported: number; enriched: number } | null
}

interface Run {
  id: string
  source: string
  location: string
  found: number
  imported: number
  enriched: number
  skipped: number
  ran_at: string
}

interface Pipeline {
  total: number; withEmail: number; hot: number
  contacted: number; converted: number; avgScore: number
}

interface ScrapeResult {
  ok: boolean
  chamber: string
  found: number
  shortlisted: number
  withEmail: number
  hotLeads: number
  hotWithEmail: number
  imported: number
  skipped: number
  notifications: string[]
  topLeads: { name: string; profession: string; score: number; reason: string; email: string; phone: string; city: string }[]
}

const PRIORITY_COLOR = {
  high: 'bg-brand-red/15 text-brand-red border-brand-red/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-700 text-gray-400 border-gray-600',
}

const SCORE_COLOR = (s: number) =>
  s >= 9 ? 'bg-green-500/20 text-green-400' :
  s >= 7 ? 'bg-brand-blue/20 text-brand-blue' :
  'bg-gray-700 text-gray-400'

export default function LeadEnginePage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [chambers, setChambers] = useState<Chamber[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)

  // Scrape state — per chamber
  const [scraping, setScraping] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ScrapeResult>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Notification settings
  const [notifyPhone, setNotifyPhone] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [minScore, setMinScore] = useState(6)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(async () => {
    const [cr, rr] = await Promise.all([
      fetch('/api/lead-engine/chambers', { credentials: 'include' }),
      fetch('/api/lead-engine/runs', { credentials: 'include' }),
    ])
    if (cr.ok) {
      const d = await cr.json()
      setChambers(d.chambers || [])
    }
    if (rr.ok) {
      const d = await rr.json()
      setRuns(d.runs || [])
      setPipeline(d.pipeline || null)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    setNotifyPhone(user.email ? '+13149223810' : '')
    setNotifyEmail(user.email || '')
    load().finally(() => setLoading(false))
  }, [user, load])

  const scrape = async (chamberId: string) => {
    setScraping(chamberId)
    setErrors((e) => ({ ...e, [chamberId]: '' }))
    setResults((r) => { const n = { ...r }; delete n[chamberId]; return n })

    try {
      const res = await fetch('/api/lead-engine/scrape', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chamberId,
          minScore,
          notifyPhone: notifyPhone || undefined,
          notifyEmail: notifyEmail || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors((e) => ({ ...e, [chamberId]: data.error || 'Scrape failed.' }))
      } else {
        setResults((r) => ({ ...r, [chamberId]: data }))
        // Refresh stats
        await load()
      }
    } catch {
      setErrors((e) => ({ ...e, [chamberId]: 'Network error.' }))
    } finally {
      setScraping(null)
    }
  }

  if (authLoading || !user) return null

  const highPriority = chambers.filter((c) => c.priority === 'high')
  const otherChambers = chambers.filter((c) => c.priority !== 'high')

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-blue" /> Lead Engine
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Chamber directories → AI scoring → campaign import → notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1.5 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition">
            <Bell className="w-4 h-4" /> Alerts
          </button>
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm shrink-0">
            <span className="sm:hidden">←</span><span className="hidden sm:inline">← Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Notification settings panel */}
      {showSettings && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-blue" /> Alert Settings
          </h2>
          <p className="text-xs text-gray-400">
            When a scrape finds hot leads (score ≥ {minScore}), you get an SMS and/or email summary instantly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">SMS alert to</label>
              <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)}
                placeholder="+13149223810" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email alert to</label>
              <input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="you@example.com" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min AI score to alert</label>
              <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50">
                {[5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}+ (import {n === 5 ? 'all' : n === 9 ? 'only best' : 'good matches'})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline stats */}
      {pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total leads', value: pipeline.total, icon: Users, color: 'text-white' },
            { label: 'With email', value: pipeline.withEmail, icon: Mail, color: 'text-brand-blue' },
            { label: 'Hot (8+)', value: pipeline.hot, icon: Star, color: 'text-yellow-400' },
            { label: 'Contacted', value: pipeline.contacted, icon: TrendingUp, color: 'text-green-400' },
            { label: 'Avg score', value: `${pipeline.avgScore}/10`, icon: BarChart3, color: 'text-purple-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-4 h-4 text-gray-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* High-priority chambers */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-red" /> High Priority Chambers
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse h-48" />
            ))
          ) : (
            highPriority.map((c) => (
              <ChamberCard
                key={c.id}
                chamber={c}
                scraping={scraping === c.id}
                result={results[c.id]}
                error={errors[c.id]}
                onScrape={() => scrape(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Other chambers */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-500" /> More Chambers
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 animate-pulse h-40" />
            ))
          ) : (
            otherChambers.map((c) => (
              <ChamberCard
                key={c.id}
                chamber={c}
                scraping={scraping === c.id}
                result={results[c.id]}
                error={errors[c.id]}
                onScrape={() => scrape(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Recent run history */}
      {runs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recent Runs</h2>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-5 px-4 py-2.5 border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wide font-semibold">
              <span>Source</span><span>Found</span><span>Emails</span><span>Imported</span><span>Date</span>
            </div>
            {runs.slice(0, 8).map((r) => (
              <div key={r.id} className="px-4 py-3 border-b border-gray-700/50 last:border-0">
                {/* Mobile */}
                <div className="sm:hidden">
                  <p className="text-sm text-white font-medium truncate">{r.source}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{r.found} found</span>
                    <span className="text-green-400">{r.enriched} emails</span>
                    <span className="text-brand-blue">{r.imported} imported</span>
                    <span className="ml-auto">{new Date(r.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-5 items-center text-sm">
                  <span className="text-gray-200 truncate pr-4">{r.source}</span>
                  <span className="text-gray-400">{r.found}</span>
                  <span className="text-green-400">{r.enriched}</span>
                  <span className="text-brand-blue">{r.imported}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(r.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chamber card ──────────────────────────────────────────────────────────────
function ChamberCard({ chamber, scraping, result, error, onScrape }: {
  chamber: Chamber
  scraping: boolean
  result?: ScrapeResult
  error?: string
  onScrape: () => void
}) {
  const [showLeads, setShowLeads] = useState(false)

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
      {/* Top */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-sm font-semibold text-white truncate">{chamber.name}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{chamber.area}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 capitalize ${PRIORITY_COLOR[chamber.priority]}`}>
          {chamber.priority}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>~{chamber.estimatedMembers} members</span>
        {chamber.lastRun ? (
          <span className="text-green-400">
            Last: +{chamber.lastRun.imported} leads {new Date(chamber.lastRun.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ) : (
          <span className="text-gray-600">Never scraped</span>
        )}
      </div>

      {chamber.note && (
        <p className="text-xs text-gray-600 italic">{chamber.note}</p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done — {result.imported} leads imported
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-gray-500">Scraped: <span className="text-white">{result.found}</span></span>
            <span className="text-gray-500">Emails: <span className="text-brand-blue">{result.withEmail}</span></span>
            <span className="text-gray-500">Hot (8+): <span className="text-yellow-400">{result.hotWithEmail}</span></span>
            <span className="text-gray-500">Dupes: <span className="text-gray-400">{result.skipped}</span></span>
          </div>
          {result.notifications.length > 0 && (
            <p className="text-xs text-purple-400 flex items-center gap-1">
              <Bell className="w-3 h-3" /> Notified: {result.notifications.join(', ')}
            </p>
          )}
          {result.topLeads.length > 0 && (
            <button onClick={() => setShowLeads((v) => !v)}
              className="text-xs text-brand-blue hover:text-white transition mt-1">
              {showLeads ? '▲ Hide' : `▼ Show ${result.topLeads.length} hot leads`}
            </button>
          )}
          {showLeads && result.topLeads.length > 0 && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              {result.topLeads.map((l, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${SCORE_COLOR(l.score)}`}>{l.score}</span>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{l.name}</p>
                    <p className="text-gray-500 truncate">{l.profession} {l.city ? `· ${l.city}` : ''}</p>
                    {l.email && <p className="text-brand-blue truncate">{l.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrape button */}
      <button
        onClick={onScrape}
        disabled={scraping}
        className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition mt-auto"
      >
        {scraping ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Scraping (may take 2-3 min)…</>
        ) : (
          <><Play className="w-4 h-4" /> Scrape {chamber.name.split(' ').slice(0,2).join(' ')}</>
        )}
      </button>
    </div>
  )
}
