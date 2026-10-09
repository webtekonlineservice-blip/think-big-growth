/**
 * Sync the BNI chapter roster into the local Member collection.
 *
 * Strategy (safe hybrid):
 *   - New on BNI        → auto-create (placeholder email + random password, non-admin)
 *   - Existing (by name)→ update company / role / phone when changed
 *   - Missing from BNI  → FLAG ONLY (never auto-delete; protects ledger & seats)
 *
 * Matching is by normalized name. Admins and the email/password/invite_code of
 * existing members are never modified.
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { fetchBniRoster, BniMember } from '@/lib/bniRoster'

export interface SyncChange {
  name: string
  fields?: string[]   // for updates: which fields changed
}

export interface SyncResult {
  ran_at: string
  bni_count: number
  db_count: number
  added: SyncChange[]
  updated: SyncChange[]
  flagged_for_removal: SyncChange[]   // in DB but no longer on BNI (not deleted)
  unchanged: number
}

/** Normalize a name for matching: lowercase, collapse spaces, strip punctuation. */
function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'().]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a slug like "colton-bemis" from a full name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'().]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Ensure a slug is unique against a set of taken slugs. */
function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base || 'member'
  let i = 2
  while (taken.has(slug)) slug = `${base}-${i++}`
  taken.add(slug)
  return slug
}

/**
 * Run the sync. Pass `dryRun: true` to compute the diff without writing.
 */
export async function syncBniMembers(opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const { dryRun = false } = opts

  const roster = await fetchBniRoster()
  if (roster.length === 0) {
    throw new Error('BNI roster returned 0 members — refusing to sync (possible parse/endpoint failure).')
  }

  await connectDB()
  const dbMembers = await Member.find().lean()

  const dbByName = new Map(dbMembers.map((m) => [normName(m.name), m]))
  const takenEmails = new Set(dbMembers.map((m) => m.email.toLowerCase()))
  const takenSlugs = new Set(dbMembers.map((m) => m.invite_code))
  const bniNames = new Set(roster.map((r) => normName(r.name)))

  const added: SyncChange[] = []
  const updated: SyncChange[] = []
  const flagged_for_removal: SyncChange[] = []
  let unchanged = 0

  // ── Added / Updated ─────────────────────────────────────────────
  for (const r of roster) {
    const key = normName(r.name)
    const existing = dbByName.get(key)

    if (!existing) {
      const slug = uniqueSlug(slugify(r.name), takenSlugs)
      let email = `${slug}@member.thinkbig`
      if (takenEmails.has(email)) email = `${slug}-${Date.now()}@member.thinkbig`
      takenEmails.add(email)

      if (!dryRun) {
        const randomPw = crypto.randomBytes(24).toString('hex')
        const password_hash = await bcrypt.hash(randomPw, 12)
        await Member.create({
          name: r.name,
          email,
          password_hash,
          role: r.profession,
          company: r.company,
          phone: r.phone,
          invite_code: slug,
          is_admin: false,
          display_order: 999,
        })
      }
      added.push({ name: r.name })
      continue
    }

    // Update changed fields (company / role / phone only)
    const changed: string[] = []
    if ((existing.company || '') !== (r.company || '')) changed.push('company')
    if ((existing.role || '') !== (r.profession || '')) changed.push('role')
    if ((existing.phone || '') !== (r.phone || '')) changed.push('phone')

    if (changed.length > 0) {
      if (!dryRun) {
        await Member.updateOne(
          { _id: existing._id },
          { $set: { company: r.company, role: r.profession, phone: r.phone } }
        )
      }
      updated.push({ name: existing.name, fields: changed })
    } else {
      unchanged++
    }
  }

  // ── Flagged for removal (in DB, not on BNI) ─────────────────────
  for (const m of dbMembers) {
    if (m.is_admin) continue // never flag admins
    if (!bniNames.has(normName(m.name))) {
      flagged_for_removal.push({ name: m.name })
    }
  }

  return {
    ran_at: new Date().toISOString(),
    bni_count: roster.length,
    db_count: dbMembers.length,
    added,
    updated,
    flagged_for_removal,
    unchanged,
  }
}

export type { BniMember }
