import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/lib/models/SocialPost'
import { getSession } from '@/lib/auth'
import { getOpenSeats } from '@/lib/openSeats'
import { seatTeam } from '@/lib/chapterSeats'
import { generateSeatPost } from '@/lib/socialStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/social/seats → open seats, least recently promoted first:
 *   [{ seat, last_posted: 'YYYY-MM-DD' | null }]
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    await connectDB()
    const [seats, past] = await Promise.all([
      getOpenSeats(),
      SocialPost.find({ type: 'seat_open' }).select('graphic.title date').lean(),
    ])
    const last: Record<string, string> = {}
    past.forEach((p) => {
      const t = ((p.graphic as { title?: string } | null)?.title || '').toLowerCase()
      if (t && (!last[t] || p.date > last[t])) last[t] = p.date
    })
    const rows = seats.map((seat) => ({ seat, team: seatTeam(seat) ?? 'Other', last_posted: last[seat.toLowerCase()] ?? null }))
    rows.sort((a, b) => (a.last_posted ?? '').localeCompare(b.last_posted ?? ''))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/social/seats error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** POST /api/social/seats { seat, tone?, note? } → { seat, options: [...3] } */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const { seat, tone, note } = await req.json()
    if (typeof seat !== 'string' || seat.trim().length < 2) {
      return NextResponse.json({ error: 'Pick a seat first.' }, { status: 400 })
    }
    await connectDB()
    const recent = await SocialPost.find().sort({ created_at: -1 }).limit(10).select('content').lean()
    const out = await generateSeatPost(
      seat, recent.map((r) => r.content || ''),
      tone === 'heartfelt' || tone === 'direct' ? tone : 'witty',
      typeof note === 'string' ? note : '',
    )
    return NextResponse.json(out)
  } catch (err) {
    console.error('POST /api/social/seats error:', err)
    return NextResponse.json({ error: 'Could not write the seat post. Try again.' }, { status: 500 })
  }
}
