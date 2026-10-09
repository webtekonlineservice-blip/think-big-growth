'use client'

import { useState, useEffect } from 'react'

export interface AdminUser {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

/**
 * Fetches /api/auth/me on every mount to verify the session cookie.
 * Redirects to /member/login if unauthenticated, or /member if not admin.
 *
 * Returns { user, loading } — render nothing (or a spinner) while loading is true.
 */
export function useAdminAuth() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) { window.location.href = '/member/login'; return }
        const { user: u } = await res.json()
        if (!u?.is_admin) { window.location.href = '/member'; return }
        setUser(u)
      })
      .catch(() => { window.location.href = '/member/login' })
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
