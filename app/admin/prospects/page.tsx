'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Prospect {
  id: string
  name: string
  email: string
  company: string
  profession: string
  phone: string
  source: string
  status: string
  sequence_step: number
  opened_count: number
  clicked_count: number
  unsubscribed: boolean
}

interface Campaign {
  id: string
  name: string
  total_prospects: number
}

export default function ProspectsBoard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')

  // CSV import
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; failed: number; total: number } | null>(null)
  const [enrichStats, setEnrichStats] = useState<{ needsEnrichment: number; hasEmail: number; total: number } | null>(null)

  // CSV import
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Open BNI seats (categories not yet filled by a member)
  const [openCategories, setOpenCategories] = useState<string[]>([])

  // One-click campaign creation
  const [creatingCampaign, setCreatingCampaign] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [campRes, prospRes, enrichRes, catRes] = await Promise.all([
      fetch('/api/prospects/campaigns'),
      fetch('/api/prospects?limit=100'),
      fetch('/api/prospects/enrich'),
      fetch('/api/categories'),
    ])
    if (campRes.ok) {
      const c = await campRes.json()
      setCampaigns(c)
      if (c.length && !selectedCampaign) setSelectedCampaign(c[0].id)
    }
    if (prospRes.ok) {
      const d = await prospRes.json()
      setProspects(d.prospects)
    }
    if (enrichRes.ok) {
      setEnrichStats(await enrichRes.json())
    }
    if (catRes.ok) {
      const { openCategories: open } = await catRes.json()
      setOpenCategories(open || [])
    }
  }, [selectedCampaign])

  // Check if a profession matches an open BNI seat
  const isOpenSeat = useCallback((profession: string): boolean => {
    if (!profession) return false
    const p = profession.toLowerCase()
    return openCategories.some((cat) => {
      const c = cat.toLowerCase()
      return c.includes(p) || p.includes(c.split(' / ')[0]) || p.includes(c.split(' ')[0])
    })
  }, [openCategories])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        await fetchData()
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router, fetchData])

  // Fetch prospects when campaign changes
  useEffect(() => {
    if (!selectedCampaign) return
    fetch(`/api/prospects?campaign_id=${selectedCampaign}&limit=200`)
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json()
          setProspects(d.prospects)
        }
      })
  }, [selectedCampaign])

  // Group by profession/category
  const categories = getCategories(prospects, search)

  // CSV handling
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) return
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
      const rows: Array<Record<string, string>> = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? '' })
        rows.push(row)
      }
      setCsvData(rows)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!selectedCampaign || !csvData.length) return
    setImporting(true)
    const normalized = csvData.map((row) => ({
      name: row.name || row.business_name || row.company_name || row.title || '',
      email: row.email || row.e_mail || row.email_address || '',
      company: row.company || row.business_name || row.company_name || '',
      profession: row.profession || row.category || row.industry || row.type || '',
      phone: row.phone || row.telephone || row.phone_number || '',
      website: row.website || row.url || row.site || '',
      source: row.source || 'csv_import',
    }))
    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: selectedCampaign, prospects: normalized }),
    })
    if (res.ok) {
      const data = await res.json()
      setImportResult({ imported: data.imported, skipped: data.skipped })
      setCsvData([])
      // Refresh prospects
      const r = await fetch(`/api/prospects?campaign_id=${selectedCampaign}&limit=200`)
      if (r.ok) setProspects((await r.json()).prospects)
    }
    setImporting(false)
  }

  // Drag & drop — update prospect profession
  const handleDrop = async (targetCategory: string) => {
    if (!draggedId) return
    const prospect = prospects.find((p) => p.id === draggedId)
    if (!prospect || prospect.profession === targetCategory) { setDraggedId(null); return }

    // Optimistic update
    setProspects((prev) => prev.map((p) => p.id === draggedId ? { ...p, profession: targetCategory } : p))
    setDraggedId(null)

    // Update in DB
    await fetch(`/api/prospects/${draggedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profession: targetCategory }),
    })
  }

  const handleEnrich = async () => {
    if (!confirm(`Find emails for ${enrichStats?.needsEnrichment || 'all'} prospects with websites? This may take a few minutes.`)) return
    setEnriching(true)
    setEnrichResult(null)
    const res = await fetch('/api/prospects/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: selectedCampaign || undefined, limit: 50 }),
    })
    if (res.ok) {
      const data = await res.json()
      setEnrichResult(data)
      // Refresh prospects
      const r = await fetch(`/api/prospects?campaign_id=${selectedCampaign}&limit=200`)
      if (r.ok) setProspects((await r.json()).prospects)
      const er = await fetch('/api/prospects/enrich')
      if (er.ok) setEnrichStats(await er.json())
    }
    setEnriching(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this prospect?')) return
    const res = await fetch(`/api/prospects/${id}`, { method: 'DELETE' })
    if (res.ok) setProspects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleCreateCampaign = async (profession: string) => {
    if (!confirm(`Create a 3-email drip campaign for "${profession}"?\n\nThis generates tailored emails linking to your invite code.`)) return
    setCreatingCampaign(profession)
    const res = await fetch('/api/prospects/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profession }),
    })
    if (res.ok) {
      const camp = await res.json()
      // Refresh campaigns and switch to the new one
      const cr = await fetch('/api/prospects/campaigns')
      if (cr.ok) setCampaigns(await cr.json())
      setSelectedCampaign(camp.id)
      alert(`Campaign "${camp.name}" created with ${camp.sequence_count} emails. Now assign prospects to it.`)
    } else {
      alert('Failed to create campaign.')
    }
    setCreatingCampaign(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-red animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Prospect Board</h1>
          <p className="text-xs text-gray-500">Organize, categorize, and manage scraped leads</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="input-field text-sm py-2 w-56"
          >
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.total_prospects})</option>)}
          </select>
          <button
            onClick={() => setView(view === 'board' ? 'list' : 'board')}
            className="btn-ghost text-xs px-3 py-2"
          >
            {view === 'board' ? '☰ List' : '▦ Board'}
          </button>
        </div>
      </div>

      {/* Stats + Enrich bar */}
      {enrichStats && (
        <div className="flex items-center gap-4 p-4 bg-gray-900/60 border border-gray-700/50 rounded-xl">
          <div className="flex items-center gap-6 flex-1 text-sm">
            <div>
              <span className="text-gray-400">Total: </span>
              <span className="text-white font-semibold">{enrichStats.total}</span>
            </div>
            <div>
              <span className="text-gray-400">With email: </span>
              <span className="text-green-400 font-semibold">{enrichStats.hasEmail}</span>
            </div>
            <div>
              <span className="text-gray-400">Need email: </span>
              <span className="text-brand-red font-semibold">{enrichStats.needsEnrichment}</span>
            </div>
            {enrichStats.total > 0 && (
              <div className="flex-1 max-w-xs">
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-green-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round((enrichStats.hasEmail / enrichStats.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((enrichStats.hasEmail / enrichStats.total) * 100)}% email coverage
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleEnrich}
            disabled={enriching || enrichStats.needsEnrichment === 0}
            className="btn-primary text-xs px-4 py-2 disabled:opacity-50 flex items-center gap-2"
          >
            {enriching ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Enriching...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find {enrichStats.needsEnrichment} Emails
              </>
            )}
          </button>
        </div>
      )}

      {enrichResult && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-5 py-3 text-sm">
          ✓ Enrichment complete — found {enrichResult.enriched} emails, {enrichResult.failed} not found out of {enrichResult.total} prospects.
        </div>
      )}

      {/* Search + CSV import */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, profession..."
          className="input-field text-sm py-2 flex-1 max-w-md"
        />
        <label className="btn-secondary text-xs px-4 py-2 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Import CSV
          <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
        </label>
        <span className="text-xs text-gray-500">{prospects.length} total</span>
      </div>

      {/* CSV preview */}
      {csvData.length > 0 && (
        <div className="card">
          <p className="text-sm text-green-400 mb-3">{csvData.length} rows parsed.</p>
          <div className="max-h-32 overflow-auto bg-gray-950 rounded-lg border border-gray-700 p-3 mb-3">
            <table className="text-xs text-gray-400 w-full">
              <thead><tr>{Object.keys(csvData[0]).slice(0, 5).map((k) => <th key={k} className="text-left px-2 py-1 text-gray-500">{k}</th>)}</tr></thead>
              <tbody>{csvData.slice(0, 3).map((row, i) => <tr key={i}>{Object.values(row).slice(0, 5).map((v, j) => <td key={j} className="px-2 py-1">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <button onClick={handleImport} disabled={importing} className="btn-primary text-xs px-5 py-2 disabled:opacity-60">
            {importing ? 'Importing...' : `Import ${csvData.length} Prospects`}
          </button>
          {importResult && <p className="text-xs text-green-400 mt-2">Imported {importResult.imported}, skipped {importResult.skipped}</p>}
        </div>
      )}

      {/* Board view */}
      {view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex-shrink-0 w-72 bg-gray-900/60 border border-gray-700/50 rounded-xl overflow-hidden"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-red/50') }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-brand-red/50') }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-red/50'); handleDrop(cat.name) }}
            >
              {/* Column header */}
              <div className={`px-4 py-3 border-b border-gray-700/50 ${isOpenSeat(cat.name) ? 'bg-green-500/10' : 'bg-gray-800/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white truncate">{cat.name || 'Uncategorized'}</h3>
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">{cat.prospects.length}</span>
                </div>
                {cat.name && cat.name !== 'Uncategorized' && (
                  <div className="flex items-center justify-between gap-2">
                    {isOpenSeat(cat.name) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Open Seat — Target!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" /> Seat Filled
                      </span>
                    )}
                    <button
                      onClick={() => handleCreateCampaign(cat.name)}
                      disabled={creatingCampaign === cat.name}
                      className="text-[10px] text-brand-indigo-light hover:text-white transition-colors whitespace-nowrap disabled:opacity-50"
                      title={`Create a drip campaign for ${cat.name}`}
                    >
                      {creatingCampaign === cat.name ? 'Creating…' : '+ Campaign'}
                    </button>
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                {cat.prospects.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggedId(p.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`p-3 bg-gray-800 border border-gray-700/50 rounded-lg cursor-grab active:cursor-grabbing hover:border-gray-600 transition-all ${
                      draggedId === p.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name || p.company || 'Unknown'}</p>
                        {p.company && p.company !== p.name && <p className="text-xs text-gray-500 truncate">{p.company}</p>}
                      </div>
                      <button onClick={() => handleDelete(p.id)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0">×</button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      {p.phone && <span>{p.phone}</span>}
                      {p.email && !p.email.includes('placeholder') && <span className="truncate">{p.email}</span>}
                    </div>
                    {p.sequence_step > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] bg-brand-indigo/20 text-brand-indigo-light px-2 py-0.5 rounded-full">
                          Email {p.sequence_step}/3 sent
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {cat.prospects.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-6">Drop prospects here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-700">
                {['Name', 'Company', 'Category', 'Phone', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.filter((p) => {
                if (!search) return true
                const q = search.toLowerCase()
                return p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) || p.profession.toLowerCase().includes(q)
              }).map((p, i) => (
                <tr key={p.id} className={`${i < prospects.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-800/30`}>
                  <td className="px-4 pl-6 py-3 text-white font-medium">{p.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{p.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{p.profession || 'Uncategorized'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-brand-indigo/20 text-brand-indigo-light px-2 py-0.5 rounded-full">{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategories(prospects: Prospect[], search: string): { name: string; prospects: Prospect[] }[] {
  const q = search.toLowerCase()
  const filtered = prospects.filter((p) => {
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) || p.profession.toLowerCase().includes(q)
  })

  const map = new Map<string, Prospect[]>()
  for (const p of filtered) {
    const cat = p.profession || 'Uncategorized'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(p)
  }

  // Sort categories: Uncategorized last, rest alphabetical
  const entries = Array.from(map.entries()).sort((a, b) => {
    if (a[0] === 'Uncategorized') return 1
    if (b[0] === 'Uncategorized') return -1
    return a[0].localeCompare(b[0])
  })

  return entries.map(([name, prospects]) => ({ name, prospects }))
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
  }
  result.push(current)
  return result
}
