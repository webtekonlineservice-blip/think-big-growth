import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { signToken, SessionPayload } from '@/lib/auth'

/**
 * POST /api/ext/auth
 * Extension login — returns a raw JWT token (not a cookie) for the extension to store.
 * Body: { email, password }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string }

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    await connectDB()

    const member = await Member.findOne({ email: email.trim().toLowerCase() }).lean()
    if (!member) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, member.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (!member.is_admin) {
      return NextResponse.json({ error: 'Admin access required for the extension.' }, { status: 403 })
    }

    const payload: SessionPayload = {
      id: member._id.toString(),
      email: member.email,
      name: member.name,
      is_admin: member.is_admin,
      invite_code: member.invite_code,
    }

    const token = signToken(payload)

    return NextResponse.json({ token, user: payload })
  } catch (err) {
    console.error('POST /api/ext/auth error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
