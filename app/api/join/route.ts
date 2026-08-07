import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import Visitor from '@/lib/models/Visitor'
import Invite from '@/lib/models/Invite'
import OutreachLog from '@/lib/models/OutreachLog'
import { sendSms } from '@/lib/twilio'
import { sendWelcomeEmail } from '@/lib/resend'

interface JoinPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  businessType: string
  referralSource: string
  visitDate: string
  refCode: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JoinPayload>

    // Validate required fields
    const required: (keyof JoinPayload)[] = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'company',
      'businessType',
      'referralSource',
    ]

    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    await connectDB()

    // Resolve inviting member from ref code
    let invitedById: string | null = null
    let invitingMemberPhone: string | null = null
    let invitingMemberName: string | null = null

    if (body.refCode) {
      const member = await Member.findOne({ invite_code: body.refCode }).lean()
      if (member) {
        invitedById = member._id.toString()
        invitingMemberPhone = member.phone ?? null
        invitingMemberName = member.name ?? null
      }
    }

    // Create visitor document
    const visitor = await Visitor.create({
      first_name: body.firstName!.trim(),
      last_name: body.lastName!.trim(),
      email: body.email!.trim().toLowerCase(),
      phone: body.phone!.trim(),
      company: body.company!.trim(),
      business_type: body.businessType!.trim(),
      referral_source: body.referralSource!.trim(),
      invited_by: invitedById,
      status: 'invited',
      visit_date: body.visitDate ? new Date(body.visitDate) : null,
      notes: '',
    })

    const visitorId = visitor._id.toString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

    // Record invite link usage
    if (invitedById && body.refCode) {
      await Invite.create({
        member_id: invitedById,
        visitor_id: visitorId,
        invite_code: body.refCode,
      })
    }

    // ── Welcome SMS to visitor ───────────────────────────────────────────────
    try {
      await sendSms(
        body.phone!,
        `Hi ${body.firstName}! You're registered to visit Think Big St. Louis BNI. ` +
          `We meet every Thursday at 11:30 AM at Mike Duffy's Pub & Grill in Kirkwood, MO. ` +
          `See you there! — Think Big St. Louis`
      )
      await OutreachLog.create({
        visitor_id: visitorId,
        step: 'welcome_sms',
        channel: 'sms',
        to: body.phone!,
        status: 'sent',
      })
    } catch (err) {
      console.error('Welcome SMS failed:', err)
      await OutreachLog.create({
        visitor_id: visitorId,
        step: 'welcome_sms',
        channel: 'sms',
        to: body.phone!,
        status: 'failed',
        error: String(err),
      }).catch(() => {})
    }

    // ── Welcome email to visitor ─────────────────────────────────────────────
    try {
      await sendWelcomeEmail({
        to: body.email!,
        firstName: body.firstName!,
        invitedByName: invitingMemberName,
      })
      await OutreachLog.create({
        visitor_id: visitorId,
        step: 'welcome_email',
        channel: 'email',
        to: body.email!,
        status: 'sent',
      })
    } catch (err) {
      console.error('Welcome email failed:', err)
      await OutreachLog.create({
        visitor_id: visitorId,
        step: 'welcome_email',
        channel: 'email',
        to: body.email!,
        status: 'failed',
        error: String(err),
      }).catch(() => {})
    }

    // ── Notify inviting member via SMS ───────────────────────────────────────
    if (invitingMemberPhone && invitingMemberName) {
      try {
        await sendSms(
          invitingMemberPhone,
          `Hi ${invitingMemberName}! ${body.firstName} ${body.lastName} from ${body.company} ` +
            `just registered to visit Think Big St. Louis using your invite link. ` +
            `Track their status at ${appUrl}/member`
        )
      } catch (err) {
        console.error('Member notification SMS failed:', err)
      }
    }

    return NextResponse.json({ success: true, id: visitorId }, { status: 201 })
  } catch (err) {
    console.error('POST /api/join error:', err)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
