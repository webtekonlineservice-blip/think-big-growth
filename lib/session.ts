/**
 * Client-side session helpers using localStorage.
 * Avoids cookie race conditions — token is available instantly after login.
 */

const TOKEN_KEY = 'tbg_token'
const USER_KEY  = 'tbg_user'

export interface SessionUser {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Returns headers with Authorization bearer token if a session exists. */
export function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
