import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost, { SOCIAL_PLATFORMS, SOCIAL_STATUSES, SOCIAL_TYPES } from '@/lib/models/SocialPost'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function shape(r: unknown) {
  const x = r as Record<string, unknown> & { _id: { toString(): string } }
  return {
    id: x._id.toString(),
    date: x.date, platform: x.platform, type: x.type, content: x.content, status: x.status,
    member_id: x.member_id ?? '', photo_id: x.photo_id ?? '', graphic: x.graphic ?? null,
    format: x.format ?? 'square', week_of: x.week_of ?? '', source: x.source ?? 'manual',
  }
}

/** GET /api/social/posts?week_of=YYYY-MM-DD — admin-only list (newest first). */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    await connectDB()
    const weekOf = req.nextUrl.searchParams.get('week_of')
    const filter = weekOf ? { week_of: weekOf } : {}
    const rows = await SocialPost.find(filter).sort({ date: weekOf ? 1 : -1, created_at: -1 }).limit(300).lean()
    return NextResponse.json(rows.map((r) => shape(r)))
  } catch (err) {
    console.error('GET /api/social/posts error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** POST /api/social/posts — create a post. */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const b = await req.json()
    if (!b.date || !SOCIAL_PLATFORMS.includes(b.platform)) {
      return NextResponse.json({ error: 'A date and a valid platform are required.' }, { status: 400 })
    }
    await connectDB()
    const post = await SocialPost.create({
      date: b.date,
      platform: b.platform,
      type: SOCIAL_TYPES.includes(b.type) ? b.type : 'custom',
      content: typeof b.content === 'string' ? b.content : '',
      status: SOCIAL_STATUSES.includes(b.status) ? b.status : 'drafted',
      member_id: typeof b.member_id === 'string' ? b.member_id : '',
      photo_id: typeof b.photo_id === 'string' ? b.photo_id : '',
      graphic: b.graphic ?? null,
      format: b.format === 'portrait' ? 'portrait' : 'square',
      week_of: typeof b.week_of === 'string' ? b.week_of : '',
      source: b.source === 'plan' ? 'plan' : 'manual',
    })
    return NextResponse.json(shape(post.toObject()), { status: 201 })
  } catch (err) {
    console.error('POST /api/social/posts error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** PUT /api/social/posts?id= — update fields. */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  try {
    const b = await req.json()
    const set: Record<string, unknown> = {}
    if (typeof b.date === 'string') set.date = b.date
    if (SOCIAL_PLATFORMS.includes(b.platform)) set.platform = b.platform
    if (SOCIAL_TYPES.includes(b.type)) set.type = b.type
    if (typeof b.content === 'string') set.content = b.content
    if (SOCIAL_STATUSES.includes(b.status)) set.status = b.status
    if (typeof b.member_id === 'string') set.member_id = b.member_id
    if (typeof b.photo_id === 'string') set.photo_id = b.photo_id
    if (b.graphic !== undefined) set.graphic = b.graphic
    if (b.format === 'square' || b.format === 'portrait') set.format = b.format
    if (Object.keys(set).length === 0) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
    await connectDB()
    await SocialPost.updateOne({ _id: id }, { $set: set })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/social/posts error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** DELETE /api/social/posts?id= */
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
    console.error('DELETE /api/social/posts error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
