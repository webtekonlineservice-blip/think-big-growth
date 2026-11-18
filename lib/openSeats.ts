import Member from '@/lib/models/Member'
import { ALL_SEATS } from '@/lib/chapterSeats'
import { isSeatFilledByMembers } from '@/lib/seatAliases'

/** The chapter's set business categories that no current member holds. Caller must be connected to the DB. */
export async function getOpenSeats(): Promise<string[]> {
  const members = await Member.find({ role: { $ne: '' } }).select('role').lean()
  const roles = members.map((m) => (m.role || '').toLowerCase().trim()).filter(Boolean)
  return ALL_SEATS.filter((s) => !isSeatFilledByMembers(s, roles))
}
