import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/lib/models/SocialPost'
import { getSession } from '@/lib/auth'
import { generateQuickPost } from '@/lib/socialStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/social/quick  { subject }
 * Returns { headline, cardLine, facebook, linkedin } written from one subject.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const { subject, tone } = await req.json()
    if (typeof subject !== 'string' || subject.trim().length < 3) {
      return NextResponse.json({ error: 'Tell me what the post is about (a few words is enough).' }, { status: 400 })
    }
    await connectDB()
    const recent = await SocialPost.find().sort({ created_at: -1 }).limit(10).select('content').lean()
    const out = await generateQuickPost(subject, recent.map((r) => r.content || ''), tone === 'heartfelt' || tone === 'direct' ? tone : 'witty')
    return NextResponse.json(out)
  } catch (err) {
    console.error('POST /api/social/quick error:', err)
    return NextResponse.json({ error: 'Could not write the posts. Try again.' }, { status: 500 })
  }
}
