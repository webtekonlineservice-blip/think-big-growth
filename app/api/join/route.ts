import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { sendSms } from '@/lib/twilio'
import { FieldValue } from 'firebase-admin/firestore'

interface JoinPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  businessType: string
  referralSource: string
  refCode?: string
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

    const db = getAdminFirestore()

    // Resolve inviting member from ref code
    let invitedById: string | null = null
    let invitingMemberPhone: string | null = null
    let invitingMemberName: string | null = null

    if (body.refCode) {
      const memberQuery = await db
        .collection('members')
        .where('invite_code', '==', body.refCode)
        .limit(1)
        .get()

      if (!memberQuery.empty) {
        const memberDoc = memberQuery.docs[0]
        invitedById = memberDoc.id
        invitingMemberPhone = memberDoc.data().phone ?? null
        invitingMemberName = memberDoc.data().name ?? null
      }
    }

    // Create visitor document
    const visitorRef = db.collection('visitors').doc()
    const visitorData = {
      first_name: body.firstName!.trim(),
      last_name: body.lastName!.trim(),
      email: body.email!.trim().toLowerCase(),
      phone: body.phone!.trim(),
      company: body.company!.trim(),
      business_type: body.businessType!.trim(),
      referral_source: body.referralSource!.trim(),
      invited_by: invitedById,
      status: 'invited',
      visit_date: null,
      notes: '',
      created_at: FieldValue.serverTimestamp(),
    }
    await visitorRef.set(visitorData)

    // Record invite link usage
    if (invitedById && body.refCode) {
      await db.collection('invites').add({
        member_id: invitedById,
        invite_code: body.refCode,
        visitor_id: visitorRef.id,
        created_at: FieldValue.serverTimestamp(),
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

    // Send welcome SMS to visitor
    try {
      await sendSms(
        body.phone!,
        `Hi ${body.firstName}, you're registered to visit Think Big St. Louis BNI! ` +
          `We meet every Thursday at 11:30 AM at Mike Duffy's Pub & Grill in Kirkwood, MO. ` +
          `See you there! — Think Big St. Louis`
      )
    } catch (smsErr) {
      console.error('Failed to send welcome SMS to visitor:', smsErr)
      // Non-fatal — visitor is still saved
    }

    // Notify inviting member
    if (invitingMemberPhone && invitingMemberName) {
      try {
        await sendSms(
          invitingMemberPhone,
          `Hi ${invitingMemberName}! ${body.firstName} ${body.lastName} from ${body.company} just registered to visit Think Big St. Louis using your invite link. ` +
            `Track their status at ${appUrl}/member`
        )
      } catch (smsErr) {
        console.error('Failed to send notification SMS to member:', smsErr)
      }
    }

    return NextResponse.json({ success: true, id: visitorRef.id }, { status: 201 })
  } catch (err) {
    console.error('Error in /api/join:', err)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
