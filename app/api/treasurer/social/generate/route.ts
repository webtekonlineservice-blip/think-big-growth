import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { generateCaptionAI, CaptionContext, SocialPlatform, SocialType } from '@/lib/socialAI'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram']
const TYPES: SocialType[] = ['meeting_promo', 'speaker', 'spotlight', 'visitor_invite', 'win', 'open_seats', 'custom']

/**
 * POST /api/treasurer/social/generate
 * Admin-only: generate a charismatic caption via DeepSeek.
 *
 * Body: { type, platform, facts: {...} }
 * Returns: { caption } on success, or { error } (caller falls back to template).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    const type: SocialType = TYPES.includes(body.type) ? body.type : 'custom'
    const platform: SocialPlatform = PLATFORMS.includes(body.platform) ? body.platform : 'facebook'
    const facts = (body.facts ?? {}) as CaptionContext['facts']

    const caption = await generateCaptionAI({ type, platform, facts })
    return NextResponse.json({ caption })
  } catch (err) {
    console.error('POST /api/treasurer/social/generate error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    // 502 so the client knows to fall back to the local template.
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
