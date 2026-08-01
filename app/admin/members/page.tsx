'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SessionUser {
  id: string
  email: string
  name: string
  is_admin: boolean
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  company: string
  phone: string
  invite_code: string
  display_order: number
  is_admin: boolean
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: '',
  company: '',
  phone: '',
  invite_code: '',
  is_admin: false,
  display_order: 0,
}

export default function AdminMembersPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'add' | 'edit' | 'password' | null>(null)
  const [selected, setSelected] = useState<Member | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) { router.push('/member/login'); return }
        const { user: u } = await res.json()
        if (!u.is_admin) { router.push('/member'); return }
        setUser(u)
        await fetchMembers()
      })
      .catch(() => router.push('/member/login'))
      .finally(() => setLoading(false))
  }, [router, fetchMembers])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, display_order: members.length })
    setError('')
    setSuccess('')
    setModal('add')
  }

  const openEdit = (m: Member) => {
    setSelected(m)
    setForm({
      name: m.name,
      email: m.email,
      password: '',
      role: m.role,
      company: m.company,
      phone: m.phone,
      invite_code: m.invite_code,
      is_admin: m.is_admin,
      display_order: m.display_order,
    })
    setError('')
    setSuccess('')
    setModal('edit')
  }

  const openPassword = (m: Member) => {
    setSelected(m)
    setNewPassword('')
    setError('')
    setSuccess('')
    setModal('password')
  }

  const closeModal = () => {
    setModal(null)
    setSelected(null)
    setError('')
    setSuccess('')
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create member.'); return }
      setMembers((prev) => [...prev, data].sort((a, b) => a.display_order - b.display_order))
      setSuccess(`${data.name} added successfully.`)
      setTimeout(closeModal, 1200)
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...rest } = form
      const res = await fetch(`/api/members/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to update member.'); return }
      setMembers((prev) => prev.map((m) => (m.id === selected.id ? data : m)))
      setSuccess('Member updated.')
      setTimeout(closeModal, 1200)
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/members/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to reset password.'); return }
      setSuccess('Password reset successfully.')
      setTimeout(closeModal, 1200)
    } catch { setError('Network error.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (m: Member) => {
    if (!confirm(`Remove ${m.name} from the chapter? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/members/${m.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMembers((prev) => prev.filter((x) => x.id !== m.id))
      }
    } catch { /* non-fatal */ }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

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
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Dashboard
            </Link>
            <div className="w-px h-4 bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">Members</h1>
              <p className="text-xs text-gray-500">Think Big St. Louis · {user?.email}</p>
            </div>
          </div>
          <button onClick={openAdd} className="btn-primary text-sm px-4 py-2">
            + Add Member
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-700">
                {['Name', 'Role / Company', 'Email', 'Invite Link', 'Admin', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr
                  key={m.id}
                  className={`${i < members.length - 1 ? 'border-b border-gray-700/50' : ''} hover:bg-gray-700/20 transition-colors`}
                >
                  <td className="px-4 pl-6 py-3 text-white font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-300 text-sm">{m.role || '—'}</p>
                    <p className="text-gray-500 text-xs">{m.company || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.email}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`${appUrl}/invite/${m.invite_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-blue hover:underline text-xs"
                    >
                      /invite/{m.invite_code}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {m.is_admin ? (
                      <span className="text-xs bg-brand-orange/20 text-brand-orange border border-brand-orange/30 px-2 py-0.5 rounded-full">Admin</span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 pr-6 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(m)} className="text-xs text-brand-blue hover:text-white transition-colors">Edit</button>
                      <button onClick={() => openPassword(m)} className="text-xs text-gray-400 hover:text-white transition-colors">Reset PW</button>
                      <button onClick={() => handleDelete(m)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">No members yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg my-auto">
            <h3 className="text-lg font-semibold text-white mb-5">
              {modal === 'add' ? 'Add New Member' : `Edit — ${selected?.name}`}
            </h3>

            <form onSubmit={modal === 'add' ? handleAdd : handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input-field" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input-field" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
              </div>

              {modal === 'add' && (
                <div>
                  <label className="label">Password *</label>
                  <input className="input-field" type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">BNI Role / Profession</label>
                  <input className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Realtor" />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="input-field" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme Realty" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input className="input-field" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(314) 555-0100" />
                </div>
                <div>
                  <label className="label">Invite Code *</label>
                  <input className="input-field" required value={form.invite_code} onChange={(e) => setForm((f) => ({ ...f, invite_code: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="jane-smith" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Display Order</label>
                  <input className="input-field" type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))} className="w-4 h-4 rounded accent-brand-orange" />
                    <span className="text-sm text-gray-300">Admin access</span>
                  </label>
                </div>
              </div>

              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              {success && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                  {saving ? 'Saving…' : modal === 'add' ? 'Add Member' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {modal === 'password' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-1">Reset Password</h3>
            <p className="text-sm text-gray-400 mb-5">{selected?.name} · {selected?.email}</p>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="label">New Password *</label>
                <input
                  className="input-field"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              {success && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeModal} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                  {saving ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
