import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import Member from '@/lib/models/Member'
import OutreachLog from '@/lib/models/OutreachLog'
import { sendSms } from '@/lib/twilio'
import { sendApplicationReminderEmail } from '@/lib/resend'

/**
 * GET /api/cron/follow-up
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Checks every visitor with a visit_date and sends the appropriate
 * follow-up if it hasn't been sent yet.
 *
 * Schedule:
 *   Day 1  after visit_date → SMS  "Great meeting you today..."
 *   Day 7  after visit_date → SMS  "Still thinking about joining?"
 *   Day 14 after visit_date → Email application reminder
 *
 * Protected by CRON_SECRET header set automatically by Vercel,
 * or manually via Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    await connectDB()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'
    const now = new Date()

    // Only process visitors who have actually visited (visit_date is set)
    // and aren't already converted to members
    const visitors = await Visitor.find({
      visit_date: { $ne: null },
      status: { $in: ['visited', 'applied'] },
    }).lean()

    let day1Sent = 0
    let day7Sent = 0
    let day14Sent = 0
    let skipped = 0

    for (const visitor of visitors) {
      if (!visitor.visit_date) continue

      const visitDate = new Date(visitor.visit_date)
      const daysSince = Math.floor(
        (now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const visitorId = visitor._id.toString()

      // Resolve inviting member name for personalisation
      let invitedByName: string | null = null
      if (visitor.invited_by) {
        const member = await Member.findById(visitor.invited_by).select('name').lean()
        if (member) invitedByName = member.name
      }

      // ── Day 1 SMS ──────────────────────────────────────────────────────────
      if (daysSince >= 1) {
        const alreadySent = await OutreachLog.findOne({
          visitor_id: visitorId,
          step: 'day1_sms',
        })

        if (!alreadySent) {
          const memberNote = invitedByName
            ? ` ${invitedByName} thinks you'd be a great fit.`
            : ''

          try {
            await sendSms(
              visitor.phone,
              `Hey ${visitor.first_name}! Great meeting you at Think Big St. Louis today.${memberNote} ` +
                `We'd love to have you in the chapter. Learn more: ${appUrl}`
            )
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day1_sms',
              channel: 'sms',
              to: visitor.phone,
              status: 'sent',
            })
            day1Sent++
          } catch (err) {
            console.error(`Day 1 SMS failed for ${visitor.email}:`, err)
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day1_sms',
              channel: 'sms',
              to: visitor.phone,
              status: 'failed',
              error: String(err),
            }).catch(() => {})
          }
        } else {
          skipped++
        }
      }

      // ── Day 7 SMS ──────────────────────────────────────────────────────────
      if (daysSince >= 7) {
        const alreadySent = await OutreachLog.findOne({
          visitor_id: visitorId,
          step: 'day7_sms',
        })

        if (!alreadySent) {
          const memberNote = invitedByName ? `It's ${invitedByName} from Think Big BNI. ` : ''

          try {
            await sendSms(
              visitor.phone,
              `Hi ${visitor.first_name}! ${memberNote}Still thinking about joining? ` +
                `Our next meeting is Thursday at 11:30 AM at Mike Duffy's in Kirkwood. ` +
                `Reply YES to confirm you're coming!`
            )
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day7_sms',
              channel: 'sms',
              to: visitor.phone,
              status: 'sent',
            })
            day7Sent++
          } catch (err) {
            console.error(`Day 7 SMS failed for ${visitor.email}:`, err)
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day7_sms',
              channel: 'sms',
              to: visitor.phone,
              status: 'failed',
              error: String(err),
            }).catch(() => {})
          }
        } else {
          skipped++
        }
      }

      // ── Day 14 Email ───────────────────────────────────────────────────────
      if (daysSince >= 14) {
        const alreadySent = await OutreachLog.findOne({
          visitor_id: visitorId,
          step: 'day14_email',
        })

        if (!alreadySent) {
          try {
            await sendApplicationReminderEmail({
              to: visitor.email,
              firstName: visitor.first_name,
              invitedByName,
            })
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day14_email',
              channel: 'email',
              to: visitor.email,
              status: 'sent',
            })
            day14Sent++
          } catch (err) {
            console.error(`Day 14 email failed for ${visitor.email}:`, err)
            await OutreachLog.create({
              visitor_id: visitorId,
              step: 'day14_email',
              channel: 'email',
              to: visitor.email,
              status: 'failed',
              error: String(err),
            }).catch(() => {})
          }
        } else {
          skipped++
        }
      }
    }

    const summary = {
      processed: visitors.length,
      day1_sms: day1Sent,
      day7_sms: day7Sent,
      day14_email: day14Sent,
      skipped,
      ran_at: now.toISOString(),
    }

    console.log('Cron /api/cron/follow-up completed:', summary)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('Cron follow-up error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
