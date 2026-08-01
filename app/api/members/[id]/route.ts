import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'

interface Params {
  params: { id: string }
}

/**
 * PATCH /api/members/[id]
 * Admin-only: update member fields or reset password.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const allowedFields = ['name', 'email', 'role', 'company', 'phone', 'invite_code', 'display_order', 'is_admin'] as const
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    // Handle password reset separately
    if (body.new_password) {
      if (typeof body.new_password !== 'string' || body.new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }
      updates.password_hash = await bcrypt.hash(body.new_password, 12)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    await connectDB()

    const member = await Member.findByIdAndUpdate(
      params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password_hash').lean()

    if (!member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    }

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
    })
  } catch (err) {
    console.error('PATCH /api/members/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/members/[id]
 * Admin-only: remove a member. Cannot delete yourself.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (session.id === params.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  try {
    await connectDB()

    const member = await Member.findByIdAndDelete(params.id)
    if (!member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/members/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
