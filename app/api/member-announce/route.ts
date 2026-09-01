import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buildMemberAnnouncement } from '@/lib/memberAnnouncement'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Think Big St. Louis <noreply@webtek.ai>'

/**
 * POST /api/member-announce
 * Admin-only: send the member announcement email.
 * Body: { to: string, member_name?: string, invite_code?: string, test?: boolean }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { to, member_name, invite_code } = await req.json() as {
      to?: string
      member_name?: string
      invite_code?: string
    }

    if (!to?.trim()) return NextResponse.json({ error: 'Recipient (to) is required.' }, { status: 400 })

    const html = buildMemberAnnouncement({
      memberName: member_name || 'there',
      inviteCode: invite_code || session.invite_code || 'patrick',
    })

    const result = await resend.emails.send({
      from: FROM,
      to: to.trim(),
      subject: `${member_name ? member_name.split(' ')[0] + ', ' : ''}I built something for our chapter`,
      html,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.data?.id })
  } catch (err) {
    console.error('POST /api/member-announce error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
