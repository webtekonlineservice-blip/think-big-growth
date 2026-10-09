import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { parseReceipt } from '@/lib/receiptParser'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/treasurer/receipt
 * Admin-only: parse a pasted lunch receipt into structured data (date, total,
 * items with prices). The client shows an editable preview before saving.
 *
 * Body: { text: string }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { text } = await req.json()
    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: 'Paste the receipt text.' }, { status: 400 })
    }
    const parsed = await parseReceipt(String(text))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('POST /api/treasurer/receipt error:', err)
    const message = err instanceof Error ? err.message : 'Could not parse receipt.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
