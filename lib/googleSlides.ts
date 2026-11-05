/**
 * Google Slides push — writes treasurer data directly into specific text boxes
 * by element object ID. This approach is token-free and works permanently:
 * it deletes the existing text and inserts new text, so it never breaks even
 * after the {{token}} placeholders have been replaced.
 *
 * Slide layout (106-slide deck):
 *   Slide 93 (index 92) — small member name block (single element)
 *   Slide 95 (index 94) — full member name + status two-column block
 *   Slide 96 (index 95) — Monthly Accounts Report (financial summary)
 *   Slide 97 (index 96) — Speaker Rotation list
 *
 * Element IDs were discovered by reading the live deck via the Slides API.
 * If the deck is ever recreated, run scripts/discover-slide-ids.js to remap.
 */

import { slides_v1 } from '@googleapis/slides'
import { JWT } from 'google-auth-library'

const SCOPES = ['https://www.googleapis.com/auth/presentations']

// ── Element IDs (deck: 18-PLxqc8LQZhonjItImMZl0DvxExuJPU1Dn0LXnibwA) ────────
const ELEMENT_IDS = {
  /** Slide 95 — member names + status two-column block */
  membersBlock:  'h17de41707f5202a0_0_8',
  /** Slide 96 — monthly accounts (starting balance / dues / expenses / total) */
  summaryBlock:  'h17de41707f5202a0_0_11',
  /** Slide 96 — month label ("October 2026") */
  summaryMonth:  'g37c6d13c64b_0_1338',
  /** Slide 95 — month label ("September 2026") */
  membersMonth:  'g37c6d13c64b_0_1329',
  /** Slide 97 — speaker rotation list */
  speakersBlock: 'g37c6d13c64b_0_1348',
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlideReplacement {
  /** Legacy token name (kept for API compatibility). Not used in the new push. */
  token: string
  value: string
}

export interface SlidePushData {
  /** Each member: name + payment status label */
  members: { name: string; status: string }[]
  /** Financial summary numbers */
  summary: {
    startingBalance: number
    duesCollected: number
    raffleIn: number
    chapterExpenses: number
    raffleOut: number
    totalInAccount: number
  }
  /** Month label e.g. "October 2026" */
  monthLabel: string
  /** Upcoming speakers */
  speakers: { date: string; name: string }[]
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function getCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.')
  let parsed: { client_email?: string; private_key?: string }
  try { parsed = JSON.parse(raw) } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON missing client_email / private_key.')
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  }
}

function getApi() {
  const { client_email, private_key } = getCredentials()
  const auth = new JWT({ email: client_email, key: private_key, scopes: SCOPES })
  return new slides_v1.Slides({ auth })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) => `$${n.toFixed(2)}`

/** Build a deleteText + insertText request pair for one element. */
function overwrite(objectId: string, text: string) {
  return [
    { deleteText: { objectId, textRange: { type: 'ALL' } } },
    { insertText: { objectId, insertionIndex: 0, text } },
  ]
}

// ── Main push ────────────────────────────────────────────────────────────────

/**
 * Push treasurer data into the live Google Slides deck.
 * Uses direct element ID overwrites — no tokens required.
 */
export async function pushSlideDeck(data: SlidePushData): Promise<{ requests: number; deckId: string }> {
  const deckId = process.env.GOOGLE_SLIDES_DECK_ID
  if (!deckId) throw new Error('GOOGLE_SLIDES_DECK_ID is not set.')

  const api = getApi()
  const requests: object[] = []

  // ── Slide 95: member names + status ──────────────────────────────────────
  // Two-column layout: name + status, padded to align.
  // We put up to 14 pairs per column, 2 per line side by side.
  const COL_WIDTH = 20  // chars to pad the name to before status
  const PER_ROW = 2     // members per line
  const lines: string[] = []
  for (let i = 0; i < data.members.length; i += PER_ROW) {
    const left  = data.members[i]
    const right = data.members[i + 1]
    const leftPart  = left  ? `${left.name.padEnd(COL_WIDTH)} ${left.status}` : ''
    const rightPart = right ? `   ${right.name.padEnd(COL_WIDTH)} ${right.status}` : ''
    lines.push(leftPart + rightPart)
  }
  requests.push(...overwrite(ELEMENT_IDS.membersBlock, lines.join('\n')))
  requests.push(...overwrite(ELEMENT_IDS.membersMonth, data.monthLabel))

  // ── Slide 96: monthly accounts summary ───────────────────────────────────
  const s = data.summary
  const summaryText = [
    `Starting Balance            ${money(s.startingBalance)}`,
    `Dues Collected              ${money(s.duesCollected)}`,
    `50/50 Collected              ${money(s.raffleIn)}`,
    `Chapter Expenses         ${money(s.chapterExpenses)}`,
    `50/50 Paid out                ${money(s.raffleOut)}`,
    `Total in Account       ${money(s.totalInAccount)}`,
  ].join('\n')
  requests.push(...overwrite(ELEMENT_IDS.summaryBlock, summaryText))
  requests.push(...overwrite(ELEMENT_IDS.summaryMonth, data.monthLabel))

  // ── Slide 97: speaker rotation ────────────────────────────────────────────
  const speakerLines = data.speakers
    .slice(0, 6)
    .map((sp) => `${sp.date}  ${sp.name}`)
    .join('\n')
  requests.push(...overwrite(ELEMENT_IDS.speakersBlock, speakerLines))

  if (requests.length === 0) return { requests: 0, deckId }

  await api.presentations.batchUpdate({
    presentationId: deckId,
    requestBody: { requests },
  })

  return { requests: requests.length, deckId }
}

/**
 * Legacy token-based push — kept for backwards compatibility.
 * Now a no-op since all tokens have been consumed. Use pushSlideDeck instead.
 */
export async function pushToSlides(replacements: SlideReplacement[]): Promise<{ requests: number; deckId: string }> {
  const deckId = process.env.GOOGLE_SLIDES_DECK_ID || ''
  // Tokens are gone — nothing to replace. Return gracefully.
  return { requests: 0, deckId }
}
