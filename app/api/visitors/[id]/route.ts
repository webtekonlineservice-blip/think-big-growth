import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import { getSession } from '@/lib/auth'

interface Params {
  params: { id: string }
}

/**
 * PATCH /api/visitors/[id]
 * Admin-only: update visitor status, notes, or visit_date.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!session.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const allowedFields = ['status', 'notes', 'visit_date'] as const
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    await connectDB()

    const visitor = await Visitor.findByIdAndUpdate(
      params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean()

    if (!visitor) {
      return NextResponse.json({ error: 'Visitor not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/visitors/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
