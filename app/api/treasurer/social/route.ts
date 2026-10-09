import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/lib/models/SocialPost'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/treasurer/social
 * Admin-only: returns all planned social posts, newest planned date first.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const rows = await SocialPost.find().sort({ date: -1, created_at: -1 }).limit(500).lean()
    const result = rows.map((r) => ({
      id: r._id.toString(),
      date: r.date,
      platform: r.platform,
      type: r.type,
      content: r.content,
      status: r.status,
    }))
    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/treasurer/social error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/treasurer/social
 * Admin-only: create a planned post.
 * Body: { date, platform, type, content, status }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { date, platform, type, content, status } = await req.json()
    if (!date || !platform) {
      return NextResponse.json({ error: 'date and platform are required.' }, { status: 400 })
    }
    await connectDB()
    const post = await SocialPost.create({
      date,
      platform,
      type: type ?? 'custom',
      content: content ?? '',
      status: status ?? 'drafted',
    })
    return NextResponse.json({ id: post._id.toString() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/treasurer/social error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * PUT /api/treasurer/social?id=<id>
 * Admin-only: update a post's fields (status change, edit content, etc.).
 */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    const body = await req.json()
    const set: Record<string, unknown> = {}
    for (const k of ['date', 'platform', 'type', 'content', 'status'] as const) {
      if (body[k] !== undefined) set[k] = body[k]
    }
    await connectDB()
    await SocialPost.updateOne({ _id: id }, { $set: set })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/treasurer/social error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/treasurer/social?id=<id>
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    await connectDB()
    await SocialPost.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/treasurer/social error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
