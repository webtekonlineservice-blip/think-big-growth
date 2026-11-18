'use client'

import { useState } from 'react'
import { Eye, FlaskConical, Send, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

interface Planned { prospect_id: string; name: string; company: string; email: string; campaign: string; step: number; subject: string }
interface BatchResult {
  mode: 'preview' | 'test' | 'send'
  planned: Planned[]; sent: number; errors: number
  excluded: Record<string, number>
  test_inbox?: string
}

const EXCLUDE_LABEL: Record<string, string> = {
  bad_email: 'bad or directory address',
  duplicate: 'same address already in sequence',
  waiting_for_delay: 'waiting for next step',
}

/**
 * One batch across every active campaign: preview who gets what,
 * test-send to the Webtek inbox, then send for real.
 */
export default function BatchSendPanel({ onSent }: { onSent?: () => void }) {
  const [open, setOpen] = useState(true)
  const [size, setSize] = useState(25)
  const [busy, setBusy] = useState<'' | 'preview' | 'test' | 'send'>('')
  const [res, setRes] = useState<BatchResult | null>(null)
  const [err, setErr] = useState('')
  const [tested, setTested] = useState(false)

  const run = async (mode: 'preview' | 'test' | 'send') => {
    if (mode === 'send' && !confirm(`Send up to ${size} real emails to prospects now?`)) return
    setBusy(mode); setErr('')
    try {
      const r = await fetch('/api/prospects/batch', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, limit: size }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Batch failed.')
      setRes(d)
      if (mode === 'test' && d.sent > 0) setTested(true)
      if (mode === 'send') { setTested(false); onSent?.() }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Batch failed.') }
    finally { setBusy('') }
  }

  const excludedText = res
    ? Object.entries(res.excluded).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${EXCLUDE_LABEL[k] ?? k}`).join(' · ')
    : ''

  return (
    <div className="border-b border-gray-800 px-4 sm:px-6 py-3 bg-gray-900/40">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-white">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} Send a batch (all campaigns)
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-400">Batch size</label>
            <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setRes(null); setTested(false) }}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100">
              {[10, 25, 40, 60].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => run('preview')} disabled={!!busy}
              className="flex items-center gap-1.5 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview
            </button>
            <button onClick={() => run('test')} disabled={!!busy}
              className="flex items-center gap-1.5 border border-yellow-600/50 text-yellow-300 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Test (3 to Webtek inbox)
            </button>
            <button onClick={() => run('send')} disabled={!!busy || !res || res.planned.length === 0}
              title={!res ? 'Preview first' : ''}
              className="flex items-center gap-1.5 bg-brand-blue text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40">
              {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send {res ? res.planned.length : ''}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Preview first. Each campaign still respects its own batch size and the 4-day gap between emails. Seats a member already holds are skipped. The daily cron sends up to 40.
          </p>

          {err && <p className="text-sm text-red-400">{err}</p>}
          {res && (
            <div className="space-y-2">
              <p className={`text-sm ${res.mode === 'preview' ? 'text-gray-300' : res.errors ? 'text-yellow-300' : 'text-green-400'}`}>
                {res.mode === 'preview' && `${res.planned.length} emails ready to send.`}
                {res.mode === 'test' && `Sent ${res.sent} test email${res.sent === 1 ? '' : 's'} to ${res.test_inbox}. Prospects were not touched.`}
                {res.mode === 'send' && `Sent ${res.sent} email${res.sent === 1 ? '' : 's'}${res.errors ? `, ${res.errors} failed` : ''}.`}
                {excludedText && <span className="text-gray-500"> Skipped: {excludedText}.</span>}
              </p>
              {res.mode === 'preview' && !tested && res.planned.length > 0 && (
                <p className="text-xs text-yellow-400">Tip: run Test before sending to check the wording in your inbox.</p>
              )}
              {res.planned.length > 0 && (
                <div className="max-h-72 overflow-y-auto border border-gray-800 rounded-lg divide-y divide-gray-800">
                  {res.planned.map((p) => (
                    <div key={p.prospect_id} className="px-3 py-2 text-xs">
                      <div className="flex flex-wrap gap-x-2 text-gray-200">
                        <span className="font-medium">{p.name || p.company}</span>
                        <span className="text-gray-500">{p.email}</span>
                        <span className="ml-auto text-brand-blue">Email {p.step}/3</span>
                      </div>
                      <div className="text-gray-500 truncate">{p.campaign} · {p.subject}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
