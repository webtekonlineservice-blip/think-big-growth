import { NextRequest, NextResponse } from 'next/server'
import { syncBniMembers } from '@/lib/syncBniMembers'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/sync-bni
 * Weekly cron: pulls the live BNI chapter roster and syncs it into Members.
 *   - adds new members, updates changed company/role/phone
 *   - flags (does not delete) members no longer on BNI
 *
 * Auth: either the Vercel cron Bearer CRON_SECRET, or an admin session
 * (so an admin can trigger it manually from the browser).
 *
 * Query: ?dryRun=1 to preview the diff without writing.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
  const session = getSession(req)
  const isAdmin = !!session?.is_admin

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const result = await syncBniMembers({ dryRun })
    console.log('Cron /api/cron/sync-bni completed:', {
      dryRun,
      added: result.added.length,
      updated: result.updated.length,
      flagged: result.flagged_for_removal.length,
      photos: result.photos_added.length,
    })
    return NextResponse.json({ dryRun, ...result })
  } catch (err) {
    console.error('Cron sync-bni error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
