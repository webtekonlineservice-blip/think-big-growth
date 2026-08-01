import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/twilio'
import { getSession } from '@/lib/auth'

/**
 * POST /api/sms
 * Admin-only: send a manual SMS to a visitor or any phone number.
 * Body: { to: string, message: string }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!session.is_admin) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
  }

  try {
    const { to, message } = (await req.json()) as { to?: string; message?: string }

    if (!to?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Both "to" (phone number) and "message" are required.' },
        { status: 400 }
      )
    }

    await sendSms(to.trim(), message.trim())

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/sms error:', err)
    return NextResponse.json({ error: 'Failed to send SMS.' }, { status: 500 })
  }
}
