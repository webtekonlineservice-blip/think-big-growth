import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost, { SOCIAL_PLATFORMS, SOCIAL_TYPES } from '@/lib/models/SocialPost'
import { getSession } from '@/lib/auth'
import { generateStudioCaption } from '@/lib/socialStudio'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/social/caption
 * Body: { type, platform, facts }
 * Returns { post, cardLine, headline }. Recent posts are passed to the writer
 * so openings are not repeated; the meeting block and Webtek credit are locked.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const b = await req.json()
    const type = SOCIAL_TYPES.includes(b.type) ? b.type : 'custom'
    const platform = SOCIAL_PLATFORMS.includes(b.platform) ? b.platform : 'facebook'
    const facts: Record<string, string> = {}
    if (b.facts && typeof b.facts === 'object') {
      Object.keys(b.facts).forEach((k) => {
        const v = (b.facts as Record<string, unknown>)[k]
        if (typeof v === 'string' && v.trim()) facts[k] = v.trim().slice(0, 300)
      })
    }
    await connectDB()
    const recent = await SocialPost.find().sort({ created_at: -1 }).limit(10).select('content').lean()
    const out = await generateStudioCaption({ type, platform, facts, recent: recent.map((r) => r.content || '') })
    return NextResponse.json(out)
  } catch (err) {
    console.error('POST /api/social/caption error:', err)
    return NextResponse.json({ error: 'Could not generate a caption.' }, { status: 500 })
  }
}
