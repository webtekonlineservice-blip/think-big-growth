import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import LedgerEntry from '@/lib/models/LedgerEntry'
import Transaction from '@/lib/models/Transaction'
import SpeakerRotation from '@/lib/models/SpeakerRotation'
import ChapterSetting, { STARTING_BALANCE_KEY, STARTING_BALANCE_DEFAULT, PENDING_MEMBERS_KEY } from '@/lib/models/ChapterSetting'
import { getSession } from '@/lib/auth'
import { pushToSlides, SlideReplacement } from '@/lib/googleSlides'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_MEMBER_SLOTS = 25
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function money(n: number) { return `$${n.toFixed(2)}` }
function longDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}`
}

/**
 * POST /api/treasurer/slides/push
 * Admin-only: compute current treasurer values and push them into the deck's
 * named placeholders (slides 93 members, 94 summary, 95 speakers).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const [members, ledger, transactions, speakers, balDoc, pendDoc] = await Promise.all([
      Member.find().sort({ display_order: 1 }).select('name').lean(),
      LedgerEntry.find().lean(),
      Transaction.find().lean(),
      SpeakerRotation.find().sort({ date: 1 }).lean(),
      ChapterSetting.findOne({ key: STARTING_BALANCE_KEY }).lean(),
      ChapterSetting.findOne({ key: PENDING_MEMBERS_KEY }).lean(),
    ])

    const startingBalance = balDoc?.value ?? STARTING_BALANCE_DEFAULT
    const pending: string[] = Array.isArray(pendDoc?.data) ? (pendDoc!.data as string[]) : []

    const balanceOf = (name: string) => {
      const mine = ledger.filter((e) => e.member_name === name)
      const charged = mine.filter((e) => e.type === 'charge' || e.type === 'opening').reduce((s, e) => s + e.amount, 0)
      const paid = mine.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0)
      return { balance: charged - paid, hasActivity: mine.length > 0 }
    }

    const replacements: SlideReplacement[] = []

    // ── Slide 93: member name + status (fixed slots) ──────────────
    members.forEach((m, i) => {
      if (i >= MAX_MEMBER_SLOTS) return
      const idStr = (m._id as { toString(): string }).toString()
      const { balance, hasActivity } = balanceOf(m.name)
      let status: string
      if (pending.includes(idStr)) status = 'Pending'
      else if (!hasActivity) status = 'Pending'
      else if (balance > 0) status = `${money(balance)} due`
      else status = 'Paid'
      replacements.push({ token: `member_${i + 1}`, value: m.name })
      replacements.push({ token: `status_${i + 1}`, value: status })
    })
    // Blank any unused slots so stale names don't linger.
    for (let i = members.length; i < MAX_MEMBER_SLOTS; i++) {
      replacements.push({ token: `member_${i + 1}`, value: '' })
      replacements.push({ token: `status_${i + 1}`, value: '' })
    }

    // ── Slide 94: chapter summary ─────────────────────────────────
    const duesCollected = transactions
      .filter((t) => t.type === 'income' && (t.category === 'Member Payment' || t.category === 'Dues'))
      .reduce((s, t) => s + t.amount, 0)
    const raffleIn = transactions.filter((t) => t.type === 'income' && t.category === '50/50 Collected').reduce((s, t) => s + t.amount, 0)
    const raffleOut = transactions.filter((t) => t.type === 'expense' && t.category === '50/50 Payout').reduce((s, t) => s + t.amount, 0)
    const chapterExpenses = transactions.filter((t) => t.type === 'expense' && t.category !== '50/50 Payout').reduce((s, t) => s + t.amount, 0)
    const totalInAccount = startingBalance + duesCollected + raffleIn - chapterExpenses - raffleOut

    replacements.push(
      { token: 'starting_balance', value: money(startingBalance) },
      { token: 'dues_collected', value: money(duesCollected) },
      { token: 'raffle_collected', value: money(raffleIn) },
      { token: 'chapter_expenses', value: money(chapterExpenses) },
      { token: 'raffle_paid_out', value: money(raffleOut) },
      { token: 'total_in_account', value: money(totalInAccount) },
    )

    // ── Slide 95: next 4 speakers ─────────────────────────────────
    const todayIso = new Date().toISOString().split('T')[0]
    const upcoming = speakers.filter((s) => s.date >= todayIso).slice(0, 4)
    const rows = upcoming.length > 0 ? upcoming : speakers.slice(-4)
    for (let i = 0; i < 4; i++) {
      const s = rows[i]
      replacements.push({ token: `speaker_date_${i + 1}`, value: s ? longDate(s.date) : '' })
      replacements.push({ token: `speaker_${i + 1}`, value: s ? s.name : '' })
    }

    const result = await pushToSlides(replacements)
    return NextResponse.json({ ok: true, ...result, pushedTokens: replacements.length })
  } catch (err) {
    console.error('POST /api/treasurer/slides/push error:', err)
    const message = err instanceof Error ? err.message : 'Push failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
