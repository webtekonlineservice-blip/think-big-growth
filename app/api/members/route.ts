import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'

/**
 * GET /api/members
 *
 * - No auth params: Admin-only — returns all members ordered by display_order.
 * - ?uid=<memberId>: Member self-profile lookup (any authenticated member).
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const uid = req.nextUrl.searchParams.get('uid')

  try {
    await connectDB()

    // Member self-profile lookup
    if (uid) {
      // Members can only fetch their own profile; admins can fetch any
      if (!session.is_admin && session.id !== uid) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const member = await Member.findById(uid)
        .select('-password_hash')
        .lean()

      if (!member) {
        return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
      }

      return NextResponse.json({
        id: member._id.toString(),
        name: member.name,
        company: member.company,
        invite_code: member.invite_code,
        role: member.role,
      })
    }

    // Admin-only: full member list
    if (!session.is_admin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
    }

    const members = await Member.find()
      .select('-password_hash')
      .sort({ display_order: 1 })
      .lean()

    const result = members.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      email: m.email,
      role: m.role,
      company: m.company,
      phone: m.phone,
      invite_code: m.invite_code,
      display_order: m.display_order,
      is_admin: m.is_admin,
      created_at: m.created_at.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/members error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/members
 * Admin-only: create a new member account.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, password, role, company, phone, invite_code, is_admin, display_order } = body

    if (!name?.trim() || !email?.trim() || !password?.trim() || !invite_code?.trim()) {
      return NextResponse.json({ error: 'name, email, password and invite_code are required.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    await connectDB()

    const existing = await Member.findOne({
      $or: [{ email: email.trim().toLowerCase() }, { invite_code: invite_code.trim() }],
    })

    if (existing) {
      const conflict = existing.email === email.trim().toLowerCase() ? 'email' : 'invite_code'
      return NextResponse.json({ error: `A member with that ${conflict} already exists.` }, { status: 409 })
    }

    const bcrypt = (await import('bcryptjs')).default
    const password_hash = await bcrypt.hash(password, 12)

    const member = await Member.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      role: role?.trim() ?? '',
      company: company?.trim() ?? '',
      phone: phone?.trim() ?? '',
      invite_code: invite_code.trim(),
      is_admin: is_admin ?? false,
      display_order: display_order ?? 0,
    })

    return NextResponse.json({
      id: member._id.toString(),
      name: member.name,
      email: member.email,
      role: member.role,
      company: member.company,
      phone: member.phone,
      invite_code: member.invite_code,
      display_order: member.display_order,
      is_admin: member.is_admin,
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/members error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
