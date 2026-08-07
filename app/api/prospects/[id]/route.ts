import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import { getSession } from '@/lib/auth'

interface Params { params: { id: string } }

/**
 * PATCH /api/prospects/[id]
 * Admin-only: update prospect fields (profession, name, etc.)
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    const allowed = ['name', 'email', 'company', 'profession', 'phone', 'status'] as const
    const updates: Record<string, unknown> = {}
    for (const field of allowed) {
      if (field in body) updates[field] = body[field]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
    }

    await connectDB()
    const prospect = await Prospect.findByIdAndUpdate(params.id, { $set: updates }, { new: true }).lean()
    if (!prospect) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/prospects/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/prospects/[id]
 * Admin-only: remove a prospect.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const prospect = await Prospect.findByIdAndDelete(params.id)
    if (!prospect) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/prospects/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
