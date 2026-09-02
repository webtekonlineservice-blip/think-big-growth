import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buildMemberAnnouncement } from '@/lib/memberAnnouncement'

/**
 * GET /api/members/announce/preview
 * Admin-only: renders the announcement email as an HTML page for preview.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const html = buildMemberAnnouncement({
    memberName: session.name || 'Patrick',
    inviteCode: session.invite_code || 'patrick',
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
