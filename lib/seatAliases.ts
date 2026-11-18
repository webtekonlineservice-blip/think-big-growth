/**
 * Seat matching: map a member role or prospect profession to a chapter seat.
 *
 * Seat names, power teams and alias words live in lib/chapterSeats.ts.
 * Matching is WHOLE-WORD and picks the most specific (longest) alias, so
 *   "roofing - residential"          → Roofing
 *   "property & casualty insurance"  → Insurance Agent (not Property Manager)
 *   "home cleaning"                  → Home Cleaning   (not Home Inspector)
 * There is no first-word or loose substring matching.
 */
import { SEAT_DEFS } from '@/lib/chapterSeats'

/** Lowercase, "&" → "and", punctuation → spaces, single-spaced. */
function norm(s: string): string {
  return ` ${(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `
}

/** Canonical seat name → alias terms (derived; kept for existing callers). */
export const SEAT_ALIASES: Record<string, string[]> = Object.fromEntries(
  SEAT_DEFS.map((s) => [s.name, s.aliases])
)

// Broad words that only decide the seat when nothing more specific is present,
// e.g. "Painter/Contractor" is a Painter, "Contractor" alone is Contractor / Builder.
const GENERIC = new Set(['contractor', 'builder', 'construction', 'marketing', 'insurance', 'law', 'video', 'promotional', 'moving', 'entertainment', 'venue', 'fitness', 'wellness', 'bank'].map((w) => norm(w)))

// Every (seat, phrase) pair: specific phrases first (longest first), generic words last.
const PHRASES: { seat: string; phrase: string }[] = SEAT_DEFS
  .flatMap((s) => [s.name, ...s.name.split('/'), ...s.aliases].map((p) => ({ seat: s.name, phrase: norm(p) })))
  .filter((x) => x.phrase.trim().length > 0)
  .sort((a, b) => {
    const ga = GENERIC.has(a.phrase) ? 1 : 0
    const gb = GENERIC.has(b.phrase) ? 1 : 0
    return ga !== gb ? ga - gb : b.phrase.length - a.phrase.length
  })

/**
 * Return the seat a profession string belongs to, or null.
 * e.g. "Residential Mortgages" → "Mortgage Broker".
 */
export function canonicalizeProfession(input: string): string | null {
  if (!input) return null
  const text = norm(input)
  if (!text.trim()) return null
  for (const { seat, phrase } of PHRASES) {
    if (text.includes(phrase)) return seat
  }
  return null
}

/** True if a profession/role and a seat (or another role) belong to the same seat. */
export function professionMatchesSeat(profession: string, seatName: string): boolean {
  if (!profession || !seatName) return false
  const a = canonicalizeProfession(profession)
  const b = canonicalizeProfession(seatName)
  if (a && b) return a === b
  // Neither maps to a known seat: only an exact match counts.
  return norm(profession) === norm(seatName)
}

/** True if any current member role covers this seat/profession. */
export function isSeatFilledByMembers(profession: string, filledRoles: string[]): boolean {
  return filledRoles.some((role) => professionMatchesSeat(profession, role))
}
