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

const STATUS_COLOR: Record<SeatView['status'], string> = {
  filled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  open:   'bg-gray-700/60 text-gray-400 border-gray-600/40',
}

const STATUS_DOT: Record<SeatView['status'], string> = {
  filled: 'bg-blue-400',
  active: 'bg-green-400 animate-pulse',
  paused: 'bg-yellow-400',
  open:   'bg-gray-600',
}

const STATUS_LABEL: Record<SeatView['status'], string> = {
  filled: 'Filled',
  active: 'Active',
  paused: 'Paused',
  open:   'Open',
}

export default function AdminSeatsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [seats, setSeats] = useState<SeatView[]>([])
  const [toggling, setToggling] = useState<string | null>(null)
  const [scraping, setScraping] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'paused' | 'filled'>('all')
  const [search, setSearch] = useState('')
  const [editSeat, setEditSeat] = useState<SeatView | null>(null)
  const [editLocation, setEditLocation] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [slotsAvailable, setSlotsAvailable] = useState(5)

  const fetchSeats = useCallback(async () => {
    const res = await fetch('/api/seats?suggest=true')
    if (res.ok) {
      const data = await res.json()
      setSeats(Array.isArray(data) ? data : (data.seats ?? []))
      if (data.suggestions) setSuggestions(data.suggestions)
      if (typeof data.slots_available === 'number') setSlotsAvailable(data.slots_available)
    }
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

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleToggle = async (seat: SeatView) => {
    if (seat.status === 'filled') return
    const activate = seat.status !== 'active'
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
      if (res.ok) {
        flash(activate
          ? `✓ Outreach activated for ${seat.profession}`
          : `⏸ Outreach paused for ${seat.profession}`)
        await fetchSeats()
      } else {
        flash(data.error || 'Failed to update seat.', 'error')
      }
    } catch {
      flash('Network error.', 'error')
    }
    setToggling(null)
  }

  const handleScrape = async (seat: SeatView) => {
    if (!seat.campaign_id) {
      flash('Activate the seat first to create a campaign.', 'error')
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
      if (res.ok) {
        flash(`✓ Scrape queued for ${seat.profession} — check back in ~2 min`)
        await fetchSeats()
      } else {
        flash(data.error || 'Scrape failed.', 'error')
      }
    } catch {
      flash('Network error.', 'error')
    }
    setScraping(null)
  }

  const handleSaveLocation = async () => {
    if (!editSeat || !editLocation.trim()) return
    setToggling(editSeat.profession)
    try {
      const res = await fetch(`/api/seats/${encodeURIComponent(editSeat.profession)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: editSeat.status === 'active',
          location: editLocation.trim(),
        }),
      })
      if (res.ok) {
        flash(`✓ Location updated for ${editSeat.profession}`)
        await fetchSeats()
      }
    } catch { flash('Network error.', 'error') }
    setToggling(null)
    setEditSeat(null)
  }

  const counts = {
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
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">BNI Seats</h1>
              <p className="text-xs text-gray-500">Toggle outreach on/off per seat — one campaign per profession</p>
            </div>
          </div>
          {/* Summary chips */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {(['filled','active','paused','open'] as const).map((s) => (
              <span key={s} className={`px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[s]}`}>
                {counts[s]} {STATUS_LABEL[s]}
              </span>
            ))}
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

        {/* Active cap warning */}
        {slotsAvailable === 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>You have 5 active seats — the maximum. Pause one before activating another.</span>
          </div>
        )}

        {/* Rotation suggestions */}
        {suggestions.length > 0 && slotsAvailable > 0 && (
          <div className="bg-brand-indigo/10 border border-brand-indigo/20 rounded-lg px-4 py-3">
            <p className="text-xs text-brand-indigo-light font-semibold uppercase tracking-wide mb-2">
              Next up — {slotsAvailable} slot{slotsAvailable !== 1 ? 's' : ''} available
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((prof) => (
                <button
                  key={prof}
                  onClick={() => setFilter('open')}
                  className="text-xs bg-brand-indigo/20 text-brand-indigo-light border border-brand-indigo/30 px-3 py-1 rounded-full hover:bg-brand-indigo/30 transition-colors"
                >
                  {prof} →
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              These seats have never been scraped — activate to start outreach.
            </p>
          </div>
        )}

        {/* Filter + search bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-wrap">
            {(['all','open','active','paused','filled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                  filter === f
                    ? 'bg-brand-indigo border-brand-indigo text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {f === 'all' ? `All (${seats.length})` : `${STATUS_LABEL[f]} (${counts[f]})`}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search profession…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field py-1.5 text-sm sm:w-56 sm:ml-auto"
          />
        </div>

        {/* Seats grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((seat) => {
            const isToggling = toggling === seat.profession
            const isScraping = scraping === seat.profession
            const canToggle = seat.status !== 'filled'
            const isOn = seat.status === 'active'

            return (
              <div
                key={seat.profession}
                className={`card flex flex-col gap-3 transition-all ${
                  seat.status === 'filled' ? 'opacity-75' : ''
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[seat.status]}`} />
                    <p className="text-sm font-semibold text-white truncate">{seat.profession}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[seat.status]}`}>
                    {STATUS_LABEL[seat.status]}
                  </span>
                </div>

                {/* Filled by */}
                {seat.status === 'filled' && seat.member_name && (
                  <p className="text-xs text-blue-300">
                    {seat.member_name}{seat.member_company ? ` · ${seat.member_company}` : ''}
                  </p>
                )}

                {/* Stats */}
                {(seat.prospects_count > 0 || seat.total_sent > 0) && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    {seat.prospects_count > 0 && <span>{seat.prospects_count} prospects</span>}
                    {seat.total_sent > 0 && <span>{seat.total_sent} sent</span>}
                    {seat.total_sent > 0 && seat.total_opened > 0 && (
                      <span>{Math.round((seat.total_opened / seat.total_sent) * 100)}% open</span>
                    )}
                  </div>
                )}

                {/* Search query */}
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-600 truncate flex-1" title={seat.search_query}>
                    🔍 {seat.search_query}
                  </p>
                  <button
                    onClick={() => { setEditSeat(seat); setEditLocation(seat.location) }}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                    title="Edit location"
                  >
                    ✎
                  </button>
                </div>

                {seat.last_scraped && (
                  <p className="text-xs text-gray-600">
                    Last scraped {new Date(seat.last_scraped).toLocaleDateString()}
                  </p>
                )}

                {/* Actions */}
                {seat.status !== 'filled' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-700/50 mt-auto">
                    {/* On/Off toggle */}
                    <button
                      onClick={() => handleToggle(seat)}
                      disabled={!canToggle || isToggling}
                      title={isOn ? 'Pause outreach' : 'Start outreach'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        isOn ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isOn ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className={`text-xs font-medium ${isOn ? 'text-green-400' : 'text-gray-500'}`}>
                      {isToggling ? '…' : isOn ? 'On' : 'Off'}
                    </span>

                    <div className="flex-1" />

                    {/* Scrape button — only when active */}
                    {(isOn || seat.status === 'paused') && seat.campaign_id && (
                      <button
                        onClick={() => handleScrape(seat)}
                        disabled={isScraping}
                        className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 border border-gray-700 rounded-md px-2.5 py-1"
                      >
                        {isScraping ? 'Queuing…' : '+ Scrape leads'}
                      </button>
                    )}

                    {/* View campaign */}
                    {seat.campaign_id && (
                      <Link
                        href="/admin/outbound"
                        className="text-xs text-brand-indigo hover:text-white transition-colors"
                      >
                        Campaign →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-sm">No seats match this filter.</p>
          </div>
        )}
      </main>

      {/* Edit location modal */}
      {editSeat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-white mb-1">Edit Search Location</h3>
            <p className="text-xs text-gray-400 mb-4">{editSeat.profession}</p>
            <label className="label">Location (city + state)</label>
            <input
              className="input-field mb-1"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Kirkwood MO"
              autoFocus
            />
            <p className="text-xs text-gray-500 mb-4">
              Search query: <span className="text-gray-300">{editSeat.profession} in {editLocation || '…'}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditSeat(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={handleSaveLocation}
                disabled={toggling === editSeat.profession}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
