import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { getSession } from '@/lib/auth'
import {
  sendMarketingSms,
  sendMarketingEmail,
  buildMemberInvoiceSms,
  buildMemberInvoiceEmail,
} from '@/lib/marketing'

export const dynamic = 'force-dynamic'

/**
 * POST /api/marketing/invoice
 * Admin-only: send a member their balance + invoice via SMS and/or Email.
 *
 * Body: {
 *   member_id: string
 *   channels: ('sms' | 'email')[]   // which channels to send on
 *   test: boolean                    // true = route to admin test address
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { member_id, channels = ['sms'], test = true } = await req.json()
    if (!member_id) return NextResponse.json({ error: 'member_id required.' }, { status: 400 })

    await connectDB()
    const member = await Member.findById(member_id).lean()
    if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })

    // Compute balance from ledger
    const entries = await LedgerEntry.find({ member_name: member.name }).lean()
    const charged = entries.filter((e) => e.type === 'charge' || e.type === 'opening').reduce((s, e) => s + e.amount, 0)
    const paid = entries.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0)
    const balance = charged - paid

    const recentEntries = [...entries]
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 6)
      .map((e) => ({ description: e.description, amount: e.amount, date: e.date, item: e.item ?? '', status: e.status }))

    const results: Record<string, { ok: boolean; error?: string }> = {}

    if (channels.includes('sms') && member.phone) {
      const body = buildMemberInvoiceSms({ name: member.name, balance, recentEntries })
      results.sms = await sendMarketingSms({ to: member.phone, body, recipientName: member.name, type: 'member_invoice', test })
    } else if (channels.includes('sms') && !member.phone) {
      results.sms = { ok: false, error: 'No phone number on file.' }
    }

    if (channels.includes('email') && member.email && !member.email.includes('@member.thinkbig')) {
      const { subject, html } = buildMemberInvoiceEmail({ name: member.name, balance, recentEntries })
      results.email = await sendMarketingEmail({ to: member.email, subject, html, recipientName: member.name, type: 'member_invoice', test })
    } else if (channels.includes('email') && (!member.email || member.email.includes('@member.thinkbig'))) {
      results.email = { ok: false, error: 'No real email on file (placeholder address).' }
    }

    return NextResponse.json({ ok: true, member: member.name, balance, test, results })
  } catch (err) {
    console.error('POST /api/marketing/invoice error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
