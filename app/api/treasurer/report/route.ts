import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import LedgerEntry from '@/lib/models/LedgerEntry'
import Transaction from '@/lib/models/Transaction'
import { getSession } from '@/lib/auth'
import { sendTreasurerReport, type TreasurerReportData } from '@/lib/resend'

const BANK_BALANCE = 3322.70 // as of 10/01/2026 — update as statements come in

/**
 * Build the treasurer report data from the ledger + transactions.
 */
async function buildReportData(month?: string): Promise<TreasurerReportData> {
  await connectDB()
  const [entries, txs] = await Promise.all([
    LedgerEntry.find().lean(),
    Transaction.find().sort({ date: -1 }).lean(),
  ])

  // Per-member balances
  const byMember = new Map<string, { name: string; charged: number; paid: number }>()
  for (const e of entries) {
    const key = e.member_name
    if (!byMember.has(key)) byMember.set(key, { name: key, charged: 0, paid: 0 })
    const m = byMember.get(key)!
    if (e.type === 'charge' || e.type === 'opening') m.charged += e.amount || 0
    if (e.type === 'payment') m.paid += e.amount || 0
  }
  const memberStatements = Array.from(byMember.values())
    .map((m) => ({ ...m, balance: m.charged - m.paid }))
    .sort((a, b) => b.balance - a.balance)

  const totalOwed = memberStatements.reduce((s, m) => (m.balance > 0 ? s + m.balance : s), 0)

  // Month filter — default to current month
  const now = new Date()
  const monthKey = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTxs = txs.filter((t) => t.date?.startsWith(monthKey))

  const monthIncome = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)
  const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)

  const monthLabel = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return {
    memberStatements,
    bankBalance: BANK_BALANCE,
    totalOwed,
    monthIncome,
    monthExpense,
    monthLabel,
    transactions: monthTxs.map((t) => ({
      date: t.date,
      description: t.description || t.category,
      type: t.type,
      amount: t.amount || 0,
    })),
  }
}

/**
 * GET /api/treasurer/report  — returns the report data (for preview, no email sent)
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const month = req.nextUrl.searchParams.get('month') ?? undefined
    const data = await buildReportData(month)
    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/treasurer/report error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/treasurer/report  — sends the report via Resend
 * Body: { to: string | string[], month?: "YYYY-MM" }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { to, month } = await req.json()
    const recipient = to || session.email
    if (!recipient) return NextResponse.json({ error: 'Recipient email required.' }, { status: 400 })

    const data = await buildReportData(month)
    const result = await sendTreasurerReport({ to: recipient, data })

    return NextResponse.json({ success: true, id: result.data?.id ?? null, to: recipient })
  } catch (err) {
    console.error('POST /api/treasurer/report error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
