import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set.')

const COOKIE_NAME = 'tbg_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionPayload {
  id: string
  email: string
  name: string
  is_admin: boolean
  invite_code: string
}

/** Sign a JWT and return it as a string. */
export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: MAX_AGE })
}

/** Verify a JWT string. Returns the payload or null if invalid/expired. */
export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Read the session cookie from an incoming request and return the decoded payload.
 * Works in both Route Handlers (NextRequest) and Server Components (cookies()).
 */
export function getSession(req?: NextRequest): SessionPayload | null {
  let token: string | undefined

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value
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
