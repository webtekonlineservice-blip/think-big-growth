'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EmailTestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; subject?: string } | null>(null)

  const [to, setTo] = useState('')
  const [step, setStep] = useState(1)
  const [testName, setTestName] = useState('John')
  const [testCompany, setTestCompany] = useState('Smith Consulting')
  const [testProfession, setTestProfession] = useState('Financial Advisor')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user } = await res.json()
        if (!user.is_admin) { router.push('/member'); return }
        setTo(user.email)
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router])

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, step, test_name: testName, test_company: testCompany, test_profession: testProfession }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: 'Network error.' })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-blue animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <div className="w-px h-4 bg-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-white">Email Test Lab</h1>
            <p className="text-xs text-gray-500">Preview and send test emails to yourself</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Info box */}
        <div className="card border-brand-blue/30 bg-gradient-to-br from-brand-blue/5 to-transparent">
          <p className="text-sm text-gray-300">
            Send test emails to your inbox to see exactly what prospects will receive.
            Customize the placeholder values below to preview with different names/companies.
          </p>
        </div>

        {/* Form */}
        <div className="card space-y-5">
          <div>
            <label className="label">Send To (your email)</label>
            <input className="input-field" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div>
            <label className="label">Sequence Step</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border transition-colors ${
                    step === s
                      ? 'bg-brand-blue border-brand-blue text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="block text-lg font-bold">Email {s}</span>
                  <span className="block text-xs mt-0.5 opacity-70">
                    {s === 1 ? 'Intro — Open seat' : s === 2 ? 'Value — Referrals' : 'Soft close'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Test Name</label>
              <input className="input-field" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="label">Test Company</label>
              <input className="input-field" value={testCompany} onChange={(e) => setTestCompany(e.target.value)} placeholder="Smith Consulting" />
            </div>
            <div>
              <label className="label">Test Profession</label>
              <input className="input-field" value={testProfession} onChange={(e) => setTestProfession(e.target.value)} placeholder="Financial Advisor" />
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-lg px-5 py-4 text-sm ${
            result.success
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {result.success
              ? `✓ Test email sent! Subject: "${result.subject}" — check your inbox.`
              : `✗ ${result.error}`}
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || !to}
          className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60"
        >
          {sending ? 'Sending...' : `Send Test Email ${step} to ${to}`}
        </button>

        {/* Preview of what each email says */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Email Sequence Preview</h3>
          <div className="space-y-4 text-sm">
            <div className={`p-4 rounded-lg border ${step === 1 ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-gray-700/50 bg-gray-900/30'}`}>
              <p className="font-semibold text-white mb-1">Email 1 — Intro (Day 0)</p>
              <p className="text-gray-400 text-xs">Subject: "{testName}, there's an open seat in your category at Think Big St. Louis"</p>
              <p className="text-gray-500 text-xs mt-1">Personalised intro. Mentions their profession is an open category. CTA to learn more.</p>
            </div>
            <div className={`p-4 rounded-lg border ${step === 2 ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-gray-700/50 bg-gray-900/30'}`}>
              <p className="font-semibold text-white mb-1">Email 2 — Value (Day 4)</p>
              <p className="text-gray-400 text-xs">Subject: "How {testCompany} could get referrals every single week"</p>
              <p className="text-gray-500 text-xs mt-1">Explains the BNI format. Bullet points. No competition pitch. CTA to reserve a spot.</p>
            </div>
            <div className={`p-4 rounded-lg border ${step === 3 ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-gray-700/50 bg-gray-900/30'}`}>
              <p className="font-semibold text-white mb-1">Email 3 — Soft Close (Day 8)</p>
              <p className="text-gray-400 text-xs">Subject: "Last thought — your Thursday seat at Think Big"</p>
              <p className="text-gray-500 text-xs mt-1">Short, respectful. Easy out. Final CTA. Won't email again after this.</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
