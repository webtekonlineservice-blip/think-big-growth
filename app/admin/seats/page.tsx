'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SeatView {
  profession: string
  status: 'filled' | 'active' | 'paused' | 'open'
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
  filled:  { dot: 'bg-blue-400',  label: 'Filled',  labelColor: 'text-blue-400',  border: 'border-blue-400/20'  },
  active:  { dot: 'bg-green-400 animate-pulse', label: 'Active', labelColor: 'text-green-400', border: 'border-green-400/20' },
  paused:  { dot: 'bg-yellow-400', label: 'Paused', labelColor: 'text-yellow-400', border: 'border-yellow-400/20' },
  open:    { dot: 'bg-gray-600',  label: 'Open',   labelColor: 'text-gray-500',  border: 'border-gray-700'    },
}

export default function AdminSeatsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [seats, setSeats] = useState<SeatView[]>([])
  const [toggling, setToggling] = useState<string | null>(null)
  const [scraping, setScraping] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'paused' | 'filled'>('all')

  const fetchSeats = useCallback(async () => {
    const res = await fetch('/api/seats')
    if (res.ok) setSeats(await res.json())
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        await fetchSeats()
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router, fetchSeats])

  const toggle = async (seat: SeatView) => {
    if (seat.status === 'filled') return
    const activate = seat.status !== 'active'
    setToggling(seat.profession)
    setMessage(null)
    try {
      const res = await fetch(`/api/seats/${encodeURIComponent(seat.profession)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activate }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: activate ? `✓ ${seat.profession} outreach activated` : `⏸ ${seat.profession} outreach paused`, ok: true })
        await fetchSeats()
      } else {
        setMessage({ text: data.error || 'Failed.', ok: false })
      }
    } catch {
      setMessage({ text: 'Network error.', ok: false })
    }
    setToggling(null)
  }

  const scrape = async (seat: SeatView) => {
    if (!seat.campaign_id) {
      setMessage({ text: 'Activate the seat first to create a campaign, then scrape.', ok: false })
      return
    }
    setScraping(seat.profession)
    setMessage(null)
    try {
      const res = await fetch(`/api/seats/${encodeURIComponent(seat.profession)}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max: 20 }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: `Scraping "${data.search_query}" in background — prospects will appear shortly.`, ok: true })
        await fetchSeats()
      } else {
        setMessage({ text: data.error || 'Scrape failed.', ok: false })
      }
    } catch {
      setMessage({ text: 'Network error.', ok: false })
    }
    setScraping(null)
  }

  const filtered = seats.filter((s) => filter === 'all' || s.status === filter)
  const counts = {
    all: seats.length,
    filled: seats.filter((s) => s.status === 'filled').length,
    active: seats.filter((s) => s.status === 'active').length,
    paused: seats.filter((s) => s.status === 'paused').length,
    open: seats.filter((s) => s.status === 'open').length,
  }

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
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">BNI Seats</h1>
              <p className="text-xs text-gray-500">
                {counts.filled} filled · {counts.active} active · {counts.paused} paused · {counts.open} open
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Message banner */}
        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm border ${
            message.ok
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'filled',  label: 'Seats Filled',   value: counts.filled,  color: 'text-blue-400'   },
            { key: 'active',  label: 'Outreach Active', value: counts.active,  color: 'text-green-400'  },
            { key: 'paused',  label: 'Paused',          value: counts.paused,  color: 'text-yellow-400' },
            { key: 'open',    label: 'Open / Untargeted',value: counts.open,   color: 'text-gray-400'   },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(filter === s.key as typeof filter ? 'all' : s.key as typeof filter)}
              className={`stat-card text-left transition-colors hover:border-gray-500 ${filter === s.key ? 'border-gray-500' : ''}`}
            >
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-600 mt-1">{filter === s.key ? 'click to clear' : 'click to filter'}</p>
            </button>
          ))}
        </div>

        {/* Seat list */}
        <div className="space-y-2">
          {filtered.map((seat) => {
            const cfg = STATUS_CONFIG[seat.status]
            const isToggling = toggling === seat.profession
            const isScraping = scraping === seat.profession

            return (
              <div
                key={seat.profession}
                className={`card border ${cfg.border} flex flex-col sm:flex-row sm:items-center gap-4 py-4`}
              >
                {/* Status dot + name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{seat.profession}</p>
                    {seat.status === 'filled' && seat.member_name && (
                      <p className="text-xs text-blue-400">{seat.member_name} · {seat.member_company}</p>
                    )}
                    {seat.status === 'active' && (
                      <p className="text-xs text-gray-400">
                        {seat.prospects_count} prospects · {seat.total_sent} sent
                        {seat.total_sent > 0 ? ` · ${Math.round((seat.total_opened / seat.total_sent) * 100)}% open` : ''}
                      </p>
                    )}
                    {seat.status === 'paused' && (
                      <p className="text-xs text-gray-500">
                        {seat.prospects_count} prospects · {seat.total_sent} sent · paused
                      </p>
                    )}
                    {seat.status === 'open' && (
                      <p className="text-xs text-gray-600">No outreach running</p>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 ${cfg.labelColor} flex-shrink-0 hidden sm:block`}>
                  {cfg.label}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Scrape button — only when campaign exists */}
                  {(seat.status === 'active' || seat.status === 'paused') && (
                    <button
                      onClick={() => scrape(seat)}
                      disabled={isScraping || !!toggling || !!scraping}
                      className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                    >
                      {isScraping ? 'Scraping…' : '↓ Scrape Leads'}
                    </button>
                  )}

                  {/* Toggle switch */}
                  {seat.status !== 'filled' && (
                    <button
                      onClick={() => toggle(seat)}
                      disabled={isToggling || !!toggling || !!scraping}
                      title={seat.status === 'active' ? 'Pause outreach' : 'Start outreach'}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-50 ${
                        seat.status === 'active' ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        seat.status === 'active' ? 'translate-x-8' : 'translate-x-1'
                      }`} />
                    </button>
                  )}

                  {seat.status === 'filled' && (
                    <span className="text-xs text-blue-400/60 px-3 py-1.5">Seat filled</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </main>
    </div>
  )
}
