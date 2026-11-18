import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPhoto from '@/lib/models/SocialPhoto'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_DATA_CHARS = 3_000_000   // ~2.2 MB of base64; client compresses to ~300 KB
const MAX_THUMB_CHARS = 150_000
const DATA_URI = /^data:image\/(jpeg|png|webp);base64,/

/**
 * GET /api/social/photos          → list (thumbnails only, newest first)
 * GET /api/social/photos?id=<id>  → one photo including the full-size data
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    await connectDB()
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const p = await SocialPhoto.findById(id).lean()
      if (!p) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
      return NextResponse.json({ id: p._id.toString(), data: p.data, thumb: p.thumb, label: p.label, member_id: p.member_id })
    }
    const rows = await SocialPhoto.find().select('thumb label member_id created_at').sort({ created_at: -1 }).limit(120).lean()
    return NextResponse.json(rows.map((p) => ({
      id: p._id.toString(), thumb: p.thumb, label: p.label, member_id: p.member_id, created_at: p.created_at.toISOString(),
    })))
  } catch (err) {
    console.error('GET /api/social/photos error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** POST /api/social/photos — { data, thumb, label?, member_id? } */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const b = await req.json()
    if (typeof b.data !== 'string' || !DATA_URI.test(b.data) || b.data.length > MAX_DATA_CHARS) {
      return NextResponse.json({ error: 'A compressed image (jpeg/png/webp, under ~2 MB) is required.' }, { status: 400 })
    }
    const thumb = typeof b.thumb === 'string' && DATA_URI.test(b.thumb) && b.thumb.length <= MAX_THUMB_CHARS ? b.thumb : ''
    if (!thumb) return NextResponse.json({ error: 'A thumbnail is required.' }, { status: 400 })
    await connectDB()
    const p = await SocialPhoto.create({
      data: b.data,
      thumb,
      label: typeof b.label === 'string' ? b.label.slice(0, 120) : '',
      member_id: typeof b.member_id === 'string' ? b.member_id : '',
    })
    return NextResponse.json({ id: p._id.toString() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/social/photos error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** PUT /api/social/photos?id= — { label?, member_id? } */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  try {
    const b = await req.json()
    const set: Record<string, string> = {}
    if (typeof b.label === 'string') set.label = b.label.slice(0, 120)
    if (typeof b.member_id === 'string') set.member_id = b.member_id
    await connectDB()
    await SocialPhoto.updateOne({ _id: id }, { $set: set })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/social/photos error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/** DELETE /api/social/photos?id= */
export async function DELETE(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  try {
    await connectDB()
    await SocialPhoto.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/social/photos error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
