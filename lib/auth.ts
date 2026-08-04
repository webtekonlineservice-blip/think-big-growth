import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'tbg_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionPayload {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set.')
  return secret
}

/** Sign a JWT and return it as a string. */
export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: MAX_AGE })
}

/** Verify a JWT string. Returns the payload or null if invalid/expired. */
export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getSecret()) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Read the session from an incoming request.
 * Checks: 1) Authorization: Bearer <token>  2) Cookie
 * Works in Route Handlers (NextRequest) and Server Components (cookies()).
 */
export function getSession(req?: NextRequest): SessionPayload | null {
  let token: string | undefined

  if (req) {
    // Check Authorization header first (used by Chrome extension)
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
    // Fallback to cookie
    if (!token) {
      token = req.cookies.get(COOKIE_NAME)?.value
    }
  } else {
    token = cookies().get(COOKIE_NAME)?.value
  }

  if (!token) return null
  return verifyToken(token)
}

/** Cookie options used when setting the session cookie. */
export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
