'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MAX_ACTIVE_SEATS = 5

interface SeatView {
  profession: string
  status: 'filled' | 'active' | 'paused' | 'open'
  outreach_status: 'open' | 'active' | 'paused'
  campaign_id: string | null
  campaign_name: string | null
  campaign_active: boolean
  prospects_count: number
  total_sent: number
  total_opened: number
  search_query: string
  location: string
  last_scraped: string | null
  member_name: string | null
  member_company: string | null
}

const STATUS_CONFIG = {
  filled:  { dot: 'bg-green-400',  badge: 'bg-green-500/20 text-green-400 border-green-500/30',  label: 'Filled'  },
  active:  { dot: 'bg-brand-indigo animate-pulse', badge: 'bg-brand-indigo/20 text-indigo-300 border-brand-indigo/30', label: 'Active'  },
  paused:  { dot: 'bg-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Paused' },
  open:    { dot: 'bg-gray-600',   badge: 'bg-gray-700/50 text-gray-400 border-gray-600/30',    label: 'Open'    },
}

export default function AdminSeatsPage() {
  const router = useRouter()
  const [seats, setSeats] = useState<SeatView[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [scraping, setScraping] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'paused' | 'filled'>('all')
  const [search, setSearch] = useState('')

  const fetchSeats = useCallback(async () => {
    const res = await fetch('/api/seats')
    if (res.ok) setSeats(await res.json())
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { window.location.href = '/member/login'; return }
        const { user } = await res.json()
        if (!user.is_admin) { window.location.href = '/member'; return }
        await fetchSeats()
      })
      .catch(() => window.location.href = '/member/login')
      .finally(() => setLoading(false))
  }, [router, fetchSeats])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const toggleSeat = async (seat: SeatView) => {
    if (seat.status === 'filled') return
    const activate = seat.status !== 'active'
    // Pre-check cap on the client before even calling the API
    if (activate && counts.active >= MAX_ACTIVE_SEATS) {
      showMessage(`You're at the ${MAX_ACTIVE_SEATS}-seat limit. Pause an active seat first.`, 'error')
      return
    }
    setToggling(seat.profession)
    try {
      const res = await fetch(
        `/api/seats/${encodeURIComponent(seat.profession)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: activate }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        showMessage(data.error || 'Toggle failed.', 'error')
      } else {
        showMessage(
          activate
            ? `✓ ${seat.profession} outreach activated.`
            : `⏸ ${seat.profession} outreach paused.`,
          'success'
        )
        await fetchSeats()
      }
    } catch {
      showMessage('Network error.', 'error')
    }
    setToggling(null)
  }

  const triggerScrape = async (seat: SeatView) => {
    if (!seat.campaign_id) {
      showMessage('Activate the seat first to create a campaign.', 'error')
      return
    }
    setScraping(seat.profession)
    try {
      const res = await fetch(
        `/api/seats/${encodeURIComponent(seat.profession)}/scrape`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max: 30 }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        showMessage(data.error || 'Scrape failed.', 'error')
      } else {
        showMessage(`🔍 Scraping ${seat.profession} leads in the background…`, 'success')
      }
    } catch {
      showMessage('Network error.', 'error')
    }
    setScraping(null)
  }

  const counts = {
    all:    seats.length,
    filled: seats.filter((s) => s.status === 'filled').length,
    active: seats.filter((s) => s.status === 'active').length,
    paused: seats.filter((s) => s.status === 'paused').length,
    open:   seats.filter((s) => s.status === 'open').length,
  }

  const filtered = seats.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false
    if (search && !s.profession.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-indigo animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Dashboard
            </Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">BNI Seats</h1>
              <p className="text-xs text-gray-500">
                {counts.filled} filled · {counts.active} active · {counts.paused} paused · {counts.open} open
              </p>
            </div>
          </div>
          {/* Active seat slot meter */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400 font-medium">Active slots</p>
              <p className="text-xs text-gray-500">{counts.active} / {MAX_ACTIVE_SEATS} running</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: MAX_ACTIVE_SEATS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-6 rounded-sm transition-colors ${
                    i < counts.active ? 'bg-brand-indigo' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Flash message */}
        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['filled', 'active', 'paused', 'open'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? 'all' : s)}
              className={`stat-card text-left transition-all ${filter === s ? 'ring-2 ring-brand-indigo' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{s}</p>
              </div>
              <p className="text-3xl font-bold text-white">{counts[s]}</p>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search profession…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field py-2 text-sm w-64"
          />
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-gray-400 hover:text-white transition-colors">
              Clear filter ×
            </button>
          )}
        </div>

        {/* Seats grid */}
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((seat) => {
            const cfg = STATUS_CONFIG[seat.status]
            const isToggling = toggling === seat.profession
            const isScraping = scraping === seat.profession
            const canToggle = seat.status !== 'filled'
            const isOn = seat.status === 'active'

            return (
              <div
                key={seat.profession}
                className={`card flex flex-col gap-3 transition-all ${
                  seat.status === 'active' ? 'border-brand-indigo/30' :
                  seat.status === 'filled' ? 'border-green-500/20' :
                  'border-gray-700/50'
                }`}
              >
                {/* Top row: profession + status + toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <p className="text-sm font-semibold text-white truncate">{seat.profession}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {canToggle && (
                      <button
                        onClick={() => toggleSeat(seat)}
                        disabled={isToggling || (!isOn && counts.active >= MAX_ACTIVE_SEATS)}
                        title={
                          !isOn && counts.active >= MAX_ACTIVE_SEATS
                            ? `At ${MAX_ACTIVE_SEATS}-seat limit — pause another seat first`
                            : isOn ? 'Pause outreach' : 'Start outreach'
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          isOn ? 'bg-brand-indigo' : 'bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isOn ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filled-by info */}
                {seat.status === 'filled' && seat.member_name && (
                  <p className="text-xs text-gray-400">
                    <span className="text-green-400 font-medium">{seat.member_name}</span>
                    {seat.member_company ? ` · ${seat.member_company}` : ''}
                  </p>
                )}

                {/* Campaign stats */}
                {(seat.status === 'active' || seat.status === 'paused') && (
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span><span className="text-white font-medium">{seat.prospects_count}</span> prospects</span>
                    <span><span className="text-brand-indigo font-medium">{seat.total_sent}</span> sent</span>
                    {seat.total_sent > 0 && (
                      <span>
                        <span className="text-brand-cyan font-medium">
                          {Math.round((seat.total_opened / seat.total_sent) * 100)}%
                        </span> open
                      </span>
                    )}
                  </div>
                )}

                {/* Search query + scrape button */}
                {seat.status !== 'filled' && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500 truncate" title={seat.search_query}>
                      🔍 {seat.search_query}
                    </p>
                    {seat.campaign_id && (
                      <button
                        onClick={() => triggerScrape(seat)}
                        disabled={isScraping || !seat.campaign_id}
                        className="text-xs text-brand-indigo hover:text-white transition-colors disabled:opacity-40 flex-shrink-0"
                        title="Scrape new leads for this profession"
                      >
                        {isScraping ? 'Starting…' : '+ Scrape leads'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-sm">No seats match your filter.</p>
          </div>
        )}
      </main>
    </div>
  )
}
