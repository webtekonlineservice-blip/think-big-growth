'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  description: string
  invite_code: string
  sequence_count: number
  batch_size: number
  active: boolean
  total_prospects: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_unsubscribed: number
  created_at: string
}

interface ProspectRow {
  id: string
  name: string
  email: string
  company: string
  profession: string
  status: string
  sequence_step: number
  opened_count: number
  clicked_count: number
  unsubscribed: boolean
}

// Default 3-email sequence for new campaigns
const DEFAULT_SEQUENCE = [
  {
    step: 1,
    subject: "[name], there's an open seat in your category at Think Big St. Louis",
    body: "Hi [name],\n\nI came across [company] and noticed you're in [profession] — which happens to be an open category at our BNI chapter, Think Big St. Louis.\n\nBNI is a structured referral group where each profession gets one exclusive seat. Members meet weekly and actively pass referrals to each other. No competition — just collaboration.\n\nWe meet every Thursday at 11:30 AM at Mike Duffy's in Kirkwood, MO. Guests visit free, no commitment.\n\nWould you be open to checking it out?",
    delay_days: 0,
    cta_text: 'Learn More & Register →',
    cta_url: '',
  },
  {
    step: 2,
    subject: "How [company] could get referrals every single week",
    body: "Hi [name],\n\nQuick follow-up — I wanted to share what makes Think Big St. Louis different from typical networking events.\n\nOur members don't just exchange business cards. Each week, we:\n• Give a 60-second pitch to the group\n• Pass qualified referrals to each other\n• Hold each other accountable for growth\n\nBNI chapters worldwide generate billions in referred business annually. And since only one [profession] can hold the seat, you'd have zero competition within the group.\n\nWorth 90 minutes of your Thursday to see if it fits?",
    delay_days: 4,
    cta_text: 'Reserve Your Guest Spot →',
    cta_url: '',
  },
  {
    step: 3,
    subject: 'Last thought — your Thursday seat at Think Big',
    body: "Hi [name],\n\nLast note from me — I don't want to be a pest.\n\nThe [profession] seat at Think Big St. Louis is still open. If you've been thinking about a reliable way to get more referrals for [company], this is it.\n\nFree to visit. Thursday 11:30 AM. Mike Duffy's Pub & Grill, Kirkwood.\n\nIf now's not the right time, no worries at all. But if you're curious, the link below takes 30 seconds.\n\nEither way — wishing you a great week.",
    delay_days: 4,
    cta_text: "I'm Interested →",
    cta_url: '',
  },
]

export default function AdminOutboundPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [prospects, setProspects] = useState<ProspectRow[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  // Create campaign modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  // CSV import
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch('/api/prospects/campaigns')
    if (res.ok) setCampaigns(await res.json())
  }, [])

  const fetchProspects = useCallback(async (campaignId: string) => {
    const res = await fetch(`/api/prospects?campaign_id=${campaignId}&limit=100`)
    if (res.ok) {
      const data = await res.json()
      setProspects(data.prospects)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        await fetchCampaigns()
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router, fetchCampaigns])

  useEffect(() => {
    if (selectedCampaign) fetchProspects(selectedCampaign)
  }, [selectedCampaign, fetchProspects])

  const handleCreateCampaign = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/prospects/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, sequence: DEFAULT_SEQUENCE }),
    })
    if (res.ok) {
      await fetchCampaigns()
      setShowCreate(false)
      setNewName('')
    }
    setCreating(false)
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) return

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
      const rows: Array<Record<string, string>> = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? '' })
        if (row.email || row.e_mail || row.email_address) rows.push(row)
      }
      setCsvData(rows)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!selectedCampaign || !csvData.length) return
    setImporting(true)
    setImportResult(null)

    // Normalize field names
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
      await fetchCampaigns()
      await fetchProspects(selectedCampaign)
    }
    setImporting(false)
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

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaign)

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">Outbound Email</h1>
              <p className="text-xs text-gray-500">Import prospects, run drip sequences, track results</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-4 py-2">
            + New Campaign
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Campaign selector + stats */}
        {campaigns.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-gray-400 mb-4">No campaigns yet. Create your first outbound campaign to get started.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-6 py-3">Create Campaign</button>
          </div>
        ) : (
          <>
            {/* Campaign tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaign(c.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedCampaign === c.id
                      ? 'bg-brand-indigo border-brand-indigo text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {c.name}
                  <span className="ml-2 text-xs opacity-60">{c.total_prospects}</span>
                </button>
              ))}
            </div>

            {/* Stats cards */}
            {activeCampaign && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: 'Prospects', value: activeCampaign.total_prospects, color: 'text-white' },
                  { label: 'Sent', value: activeCampaign.total_sent, color: 'text-brand-indigo' },
                  { label: 'Opened', value: activeCampaign.total_opened, color: 'text-brand-cyan' },
                  { label: 'Clicked', value: activeCampaign.total_clicked, color: 'text-green-400' },
                  { label: 'Open Rate', value: activeCampaign.total_sent > 0 ? `${Math.round((activeCampaign.total_opened / activeCampaign.total_sent) * 100)}%` : '—', color: 'text-brand-cyan' },
                  { label: 'Unsubs', value: activeCampaign.total_unsubscribed, color: 'text-red-400' },
                ].map((s) => (
                  <div key={s.label} className="stat-card">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CSV Import */}
            {selectedCampaign && (
              <div className="card">
                <h2 className="text-base font-semibold text-white mb-4">Import Prospects (CSV)</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Upload a CSV with columns like: <code className="text-brand-indigo">email, name, company, profession, phone, website</code>.
                  Column names are flexible — the system auto-maps common variations.
                </p>

                <div className="flex items-center gap-4 mb-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-indigo/20 file:text-brand-indigo hover:file:bg-brand-indigo/30 cursor-pointer"
                  />
                </div>

                {csvData.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-green-400 mb-3">{csvData.length} rows parsed. Ready to import.</p>
                    <div className="max-h-40 overflow-auto bg-gray-900 rounded-lg border border-gray-700 p-3">
                      <table className="text-xs text-gray-400 w-full">
                        <thead><tr>
                          {Object.keys(csvData[0]).slice(0, 5).map((k) => <th key={k} className="text-left px-2 py-1 text-gray-500">{k}</th>)}
                        </tr></thead>
                        <tbody>
                          {csvData.slice(0, 5).map((row, i) => (
                            <tr key={i}>{Object.values(row).slice(0, 5).map((v, j) => <td key={j} className="px-2 py-1">{v}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                      {csvData.length > 5 && <p className="text-xs text-gray-600 px-2 mt-1">…and {csvData.length - 5} more</p>}
                    </div>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="btn-primary mt-4 text-sm px-6 py-2.5 disabled:opacity-60"
                    >
                      {importing ? 'Importing…' : `Import ${csvData.length} Prospects`}
                    </button>
                  </div>
                )}

                {importResult && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-4 py-3 text-sm">
                    Imported {importResult.imported} prospects ({importResult.skipped} skipped as duplicates).
                  </div>
                )}
              </div>
            )}

            {/* Prospects list */}
            {selectedCampaign && prospects.length > 0 && (
              <div className="card p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-700">
                      {['Name', 'Email', 'Company', 'Step', 'Opens', 'Clicks', 'Status'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map((p, i) => (
                      <tr key={p.id} className={`${i < prospects.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-800/30`}>
                        <td className="px-4 pl-6 py-3 text-white font-medium">{p.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.email}</td>
                        <td className="px-4 py-3 text-gray-400">{p.company || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-brand-indigo/20 text-brand-indigo-light px-2 py-0.5 rounded-full">{p.sequence_step}/3</span>
                        </td>
                        <td className="px-4 py-3 text-brand-cyan font-medium">{p.opened_count}</td>
                        <td className="px-4 py-3 text-green-400 font-medium">{p.clicked_count}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.unsubscribed ? 'bg-red-500/20 text-red-400' :
                            p.status === 'new' ? 'bg-gray-700 text-gray-400' :
                            'bg-brand-indigo/20 text-brand-indigo-light'
                          }`}>{p.unsubscribed ? 'Unsubscribed' : p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">New Outbound Campaign</h3>
            <p className="text-sm text-gray-400 mb-5">
              Creates a 3-email drip sequence. You can customize the emails later.
            </p>
            <div className="mb-5">
              <label className="label">Campaign Name *</label>
              <input
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Kirkwood Chamber Q1 2025"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={handleCreateCampaign}
                disabled={creating || !newName.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CSV parser (handles quoted fields with commas) ─────────────────────────
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
