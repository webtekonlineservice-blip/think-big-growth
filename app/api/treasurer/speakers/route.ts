import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SpeakerRotation from '@/lib/models/SpeakerRotation'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/treasurer/speakers
 * Admin-only: returns the speaker rotation ordered by date asc.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const rows = await SpeakerRotation.find().sort({ date: 1 }).lean()
    const result = rows.map((r) => ({
      id: r._id.toString(),
      date: r.date,
      member_id: r.member_id?.toString() ?? null,
      name: r.name,
    }))
    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/treasurer/speakers error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/treasurer/speakers
 * Admin-only: create or update a speaker slot (upsert by date).
 * Body: { date, member_id?, name }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { date, member_id, name } = await req.json()
    if (!date) return NextResponse.json({ error: 'date is required.' }, { status: 400 })

    await connectDB()
    await SpeakerRotation.updateOne(
      { date },
      { $set: { member_id: member_id ?? null, name: name?.trim() || 'Speaker Name' } },
      { upsert: true }
    )
    const saved = await SpeakerRotation.findOne({ date }).lean()
    return NextResponse.json({
      id: saved!._id.toString(),
      date: saved!.date,
      member_id: saved!.member_id?.toString() ?? null,
      name: saved!.name,
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/treasurer/speakers error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/treasurer/speakers?id=<id>
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    await connectDB()
    await SpeakerRotation.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/treasurer/speakers error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
