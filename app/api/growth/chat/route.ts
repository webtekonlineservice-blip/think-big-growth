import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buildGrowthSnapshot } from '@/lib/growthSnapshot'
import { growthChat } from '@/lib/growthAI'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/growth/chat
 * Admin-only. Free-form advisor chat grounded in the live snapshot.
 *
 * Body: {
 *   message: string
 *   history?: { role: 'user' | 'assistant'; content: string }[]
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { message, history = [] } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })

    const snapshot = await buildGrowthSnapshot()
    const reply = await growthChat(snapshot, history, message.trim())
    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chat failed.'
    console.error('POST /api/growth/chat error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
