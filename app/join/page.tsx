'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  businessType: string
  referralSource: string
  refCode: string
}

const initialForm: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  businessType: '',
  referralSource: '',
  refCode: '',
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-blue animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    }>
      <JoinForm />
    </Suspense>
  )
}

function JoinForm() {
  const searchParams = useSearchParams()
  const [form, setForm] = useState<FormData>(initialForm)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setForm((f) => ({ ...f, refCode: ref }))
  }, [searchParams])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">You're registered!</h1>
          <p className="text-gray-400 mb-8">
            We've saved your spot and sent a confirmation to{' '}
            <span className="text-white">{form.email}</span>. See you Thursday!
          </p>

          <div className="card mb-8 text-left">
            <h2 className="text-sm font-semibold text-brand-orange uppercase tracking-widest mb-4">
              Next Meeting Details
            </h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3 text-gray-300">
                <svg className="w-4 h-4 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Every Thursday
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <svg className="w-4 h-4 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                11:30 AM
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <svg className="w-4 h-4 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mike Duffy's Pub & Grill, Kirkwood, MO
              </li>
            </ul>
          </div>

          <Link href="/" className="btn-ghost">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-6 py-16">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 border-b border-gray-800/60 px-6 py-4 backdrop-blur-sm bg-[#0a0f1e]/80 z-40">
        <div className="max-w-xl mx-auto flex items-center">
          <Link href="/" className="group inline-flex items-center">
            <Image src="/logo.png" alt="Webtek.ai" width={115} height={36} className="object-contain transition-all duration-300 group-hover:brightness-110 group-hover:scale-105" priority />
          </Link>
        </div>
      </nav>
      <div className="max-w-xl mx-auto pt-16">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-10">
          ← Back to Home
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-brand-orange/20 border border-brand-orange/30 text-brand-orange px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4">
            Free Guest Visit
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Request to Visit
          </h1>
          <p className="text-gray-400">
            Fill in your details and we'll confirm your spot at our next Thursday
            meeting. No commitment required — guests can visit twice before deciding.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label">First Name *</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={form.firstName}
                onChange={handleChange}
                placeholder="Jane"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="label">Last Name *</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={form.lastName}
                onChange={handleChange}
                placeholder="Smith"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">Email Address *</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="phone" className="label">Phone Number *</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              placeholder="(314) 555-0100"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="company" className="label">Company / Business Name *</label>
            <input
              id="company"
              name="company"
              type="text"
              required
              value={form.company}
              onChange={handleChange}
              placeholder="Smith Consulting LLC"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="businessType" className="label">Business Type / Category *</label>
            <input
              id="businessType"
              name="businessType"
              type="text"
              required
              value={form.businessType}
              onChange={handleChange}
              placeholder="e.g. Financial Advisor, Real Estate, IT Services"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="referralSource" className="label">How did you hear about us? *</label>
            <select
              id="referralSource"
              name="referralSource"
              required
              value={form.referralSource}
              onChange={handleChange}
              className="input-field"
            >
              <option value="" disabled>Select an option</option>
              <option value="member_referral">Member referral</option>
              <option value="social_media">Social media</option>
              <option value="google">Google</option>
              <option value="bni_website">BNI website</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Hidden ref code */}
          <input type="hidden" name="refCode" value={form.refCode} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center text-base py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting…
              </>
            ) : (
              'Reserve My Spot →'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By submitting, you agree to receive a confirmation SMS. No spam — ever.
          </p>
        </form>
      </div>
    </div>
  )
}

