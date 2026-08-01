import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { signToken, SESSION_COOKIE, SessionPayload } from '@/lib/auth'

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

    const payload: SessionPayload = {
      id: (member._id as { toString(): string }).toString(),
      email: member.email,
      name: member.name,
      is_admin: member.is_admin,
      invite_code: member.invite_code,
    }

    const token = signToken(payload)

    const res = NextResponse.json({ ok: true, user: payload })
    res.cookies.set(SESSION_COOKIE.name, token, {
      maxAge: SESSION_COOKIE.maxAge,
      httpOnly: SESSION_COOKIE.httpOnly,
      secure: SESSION_COOKIE.secure,
      sameSite: SESSION_COOKIE.sameSite,
      path: SESSION_COOKIE.path,
    })

    return res
  } catch (err) {
    console.error('POST /api/auth/login error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
