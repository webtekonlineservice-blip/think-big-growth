import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import ChapterSetting, { STARTING_BALANCE_KEY, STARTING_BALANCE_DEFAULT, PENDING_MEMBERS_KEY } from '@/lib/models/ChapterSetting'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/treasurer/settings
 * Admin-only: returns treasurer settings — starting balance and the list of
 * member ids manually flagged "Pending" on slide 93.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const [balDoc, pendDoc] = await Promise.all([
      ChapterSetting.findOne({ key: STARTING_BALANCE_KEY }).lean(),
      ChapterSetting.findOne({ key: PENDING_MEMBERS_KEY }).lean(),
    ])
    const startingBalance = balDoc?.value ?? STARTING_BALANCE_DEFAULT
    const pendingMembers = Array.isArray(pendDoc?.data) ? (pendDoc!.data as string[]) : []
    return NextResponse.json({ startingBalance, pendingMembers })
  } catch (err) {
    console.error('GET /api/treasurer/settings error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * PUT /api/treasurer/settings
 * Admin-only: update the starting balance and/or the pending-members list.
 * Body: { startingBalance?: number, pendingMembers?: string[] }
 */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { startingBalance, pendingMembers } = await req.json()
    await connectDB()

    if (startingBalance != null) {
      if (isNaN(Number(startingBalance))) {
        return NextResponse.json({ error: 'startingBalance must be a number.' }, { status: 400 })
      }
      await ChapterSetting.updateOne(
        { key: STARTING_BALANCE_KEY },
        { $set: { value: Number(startingBalance), updated_at: new Date() } },
        { upsert: true }
      )
    }

    if (pendingMembers != null) {
      if (!Array.isArray(pendingMembers)) {
        return NextResponse.json({ error: 'pendingMembers must be an array.' }, { status: 400 })
      }
      await ChapterSetting.updateOne(
        { key: PENDING_MEMBERS_KEY },
        { $set: { data: pendingMembers.map(String), updated_at: new Date() } },
        { upsert: true }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/treasurer/settings error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
