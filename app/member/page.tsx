'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

interface Visitor {
  id: string
  first_name: string
  last_name: string
  company: string
  status: 'invited' | 'visited' | 'applied' | 'member'
  created_at: string
}

interface MemberProfile {
  name: string
  invite_code: string
  company: string
}

const STATUS_STYLES: Record<Visitor['status'], string> = {
  invited: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  visited: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  applied: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  member: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function MemberDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const inviteUrl = profile
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'}/invite/${profile.invite_code}`
    : ''

  const fetchMemberData = useCallback(async (uid: string) => {
    try {
      const [profileRes, visitorsRes] = await Promise.all([
        fetch(`/api/members?uid=${uid}`),
        fetch(`/api/members/visitors?uid=${uid}`),
      ])
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data)
      }
      if (visitorsRes.ok) {
        const data = await visitorsRes.json()
        setVisitors(data)
      }
    } catch {
      // Non-fatal — dashboard still renders with empty state
    }
  }, [])

  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/member/login')
        return
      }
      setUser(u)
      fetchMemberData(u.uid).finally(() => setLoading(false))
    })
    return unsub
  }, [router, fetchMemberData])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleSignOut = async () => {
    const auth = getFirebaseAuth()
    await signOut(auth)
    router.push('/')
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
      {/* Top bar */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {profile?.name ?? user?.email}
            </h1>
            <p className="text-xs text-gray-500">Member Dashboard · Think Big St. Louis</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Invite link card */}
        <div className="card border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-transparent">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Your Invite Link</h2>
              <p className="text-sm text-gray-400">
                Share this link to invite prospects. Their registration will be
                linked to you.
              </p>
            </div>
            <div className="w-10 h-10 bg-brand-blue/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl || 'Loading…'}
              className="input-field flex-1 text-sm bg-gray-900 cursor-default"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              disabled={!inviteUrl}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 flex-shrink-0 ${
                copied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-brand-blue hover:bg-brand-blue-dark text-white'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visitors table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Visitors You've Invited</h2>
            <span className="text-sm text-gray-400">{visitors.length} total</span>
          </div>

          {visitors.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">No visitors yet.</p>
              <p className="text-gray-600 text-xs mt-1">Share your invite link to get started.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">Company</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v, i) => (
                    <tr
                      key={v.id}
                      className={`${i < visitors.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-700/30 transition-colors`}
                    >
                      <td className="px-6 py-4 text-white font-medium">
                        {v.first_name} {v.last_name}
                      </td>
                      <td className="px-6 py-4 text-gray-400">{v.company}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[v.status]}`}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(v.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
