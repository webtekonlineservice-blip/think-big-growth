/**
 * Growth Advisor — Reasoner (DeepSeek).
 *
 * Turns a deterministic GrowthSnapshot into a structured, actionable growth
 * plan. The model is constrained to:
 *   - only use facts present in the snapshot (no invented names/numbers),
 *   - return STRICT JSON matching the GrowthPlan shape,
 *   - map every recommended move to an executable action type.
 *
 * Also exposes a free-form chat advisor that answers questions grounded in
 * the same snapshot.
 */

import type { GrowthSnapshot } from '@/lib/growthSnapshot'

export type MovePriority = 'high' | 'medium' | 'low'

/** Action types that map to real engines in the Action Executor. */
export type GrowthActionType =
  | 'sms_segment'          // text a group of visitors/members
  | 'email_segment'        // email a group
  | 'outreach_prospects'   // email scraped prospects in a category
  | 'social_post'          // generate a social caption/graphic
  | 'manual'               // no automated action — a human to-do

export interface GrowthAction {
  type: GrowthActionType
  /** Audience hint: a visitor status, 'members', or a profession for prospects. */
  target?: string
  /** Suggested channels for segment/outreach moves. */
  channels?: ('sms' | 'whatsapp' | 'email')[]
  /** Pre-drafted message/caption. [name] and [company] tokens allowed. */
  draft?: string
  /** For email actions. */
  subject?: string
  /** For social_post. */
  socialType?: string
  platform?: string
}

export interface GrowthMove {
  id: string
  priority: MovePriority
  title: string
  why: string
  impact: string
  action: GrowthAction
}

export interface GrowthPlan {
  headline: string
  summary: string
  moves: GrowthMove[]
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

function requireKey(): string {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY is not set.')
  return key
}

/** Compact the snapshot into a token-efficient briefing for the model. */
function snapshotBriefing(s: GrowthSnapshot): string {
  const lines: string[] = []
  lines.push(`Chapter: ${s.chapterName}`)
  lines.push(`Meeting: ${s.meetingLine}`)
  lines.push(`Members: ${s.members.total}`)
  lines.push(
    `Visitors — total ${s.visitors.total}, invited(not visited) ${s.visitors.invited}, visited ${s.visitors.visited}, applied ${s.visitors.applied}, became members ${s.visitors.becameMembers}, new this month ${s.visitors.newThisMonth}`
  )
  if (s.visitors.staleNoFollowup.length) {
    lines.push(
      `Stale visitors needing follow-up: ${s.visitors.staleNoFollowup
        .map((v) => `${v.name} (${v.company || 'n/a'}, ${v.daysSince}d)`)
        .join('; ')}`
    )
  }
  lines.push(`Open seats: ${s.seats.openProfessions.join(', ') || 'none'}`)
  if (s.seats.withReadyProspects.length) {
    lines.push(
      `Open seats WITH ready prospects: ${s.seats.withReadyProspects
        .map((o) => `${o.profession} (${o.prospectsReady} uncontacted)`)
        .join('; ')}`
    )
  }
  lines.push(
    `Prospects — total ${s.prospects.total}, never contacted ${s.prospects.neverContacted}, in sequence ${s.prospects.inSequence}, converted ${s.prospects.converted}`
  )
  lines.push(
    `Momentum — days since last scrape ${s.momentum.daysSinceLastScrape ?? 'never'}, outreach last 7d ${s.momentum.outreachLast7Days}, scrapes last 30d ${s.momentum.scrapesLast30Days}`
  )
  if (s.signals.length) lines.push(`Signals:\n- ${s.signals.join('\n- ')}`)
  return lines.join('\n')
}

const STRATEGY = [
  'You are the Growth Advisor for a BNI referral-networking chapter. BNI growth works on these levers, in rough priority:',
  '1. Recover warm leads: visitors who already came but got no follow-up are the cheapest growth.',
  '2. Convert registered-but-not-visited into actual visits.',
  '3. Recruit for OPEN seats — BNI is one-business-per-category, so each open seat is an exclusive invitation. Open seats that already have uncontacted scraped prospects are the highest-ROI recruiting move.',
  '4. Keep the prospect pipeline warm: contact never-contacted prospects, and keep scraping if the pipeline is cold.',
  '5. Social proof: celebrate wins/speakers to attract visitors.',
  'Rules:',
  '- Recommend 3 to 5 concrete moves, ordered by impact (highest first).',
  '- Use ONLY facts from the briefing. NEVER invent member names, companies, dollar amounts, or wins.',
  '- Every move MUST have an executable action. Prefer sms_segment/email_segment for visitors, outreach_prospects for recruiting open seats, social_post for awareness.',
  '- For messages, write a short, warm, specific draft using [name] and [company] tokens where personalization helps.',
  '- If a lever has no data (e.g. no stale visitors), do not invent one — pick the next best real lever.',
].join('\n')

const PLAN_SCHEMA = `Return STRICT JSON only (no markdown, no prose) matching:
{
  "headline": "string (one punchy line, e.g. '3 moves to book 2 visitors this week')",
  "summary": "string (2-3 sentences on the chapter's growth situation)",
  "moves": [
    {
      "id": "kebab-case-id",
      "priority": "high" | "medium" | "low",
      "title": "string",
      "why": "string (grounded in the real numbers)",
      "impact": "string (what this move should achieve)",
      "action": {
        "type": "sms_segment" | "email_segment" | "outreach_prospects" | "social_post" | "manual",
        "target": "string (visitor status like 'visited', or 'members', or a profession)",
        "channels": ["sms"|"whatsapp"|"email"],
        "draft": "string (message/caption with [name]/[company] tokens)",
        "subject": "string (email subject, if email)",
        "socialType": "string (for social_post: meeting_promo|speaker|open_seats|win|visitor_invite)",
        "platform": "string (for social_post: facebook|linkedin|instagram)"
      }
    }
  ]
}`

/** Extract the first JSON object from a model response (handles code fences). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response.')
  return raw.slice(start, end + 1)
}

/**
 * Generate a structured growth plan from the snapshot.
 * Throws on missing key / API failure / unparseable output.
 */
export async function generateGrowthPlan(snapshot: GrowthSnapshot): Promise<GrowthPlan> {
  const key = requireKey()
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${STRATEGY}\n\n${PLAN_SCHEMA}` },
        { role: 'user', content: `Here is the current chapter snapshot:\n\n${snapshotBriefing(snapshot)}\n\nProduce the growth plan JSON now.` },
      ],
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`DeepSeek returned ${res.status}: ${t.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek returned empty content.')

  const parsed = JSON.parse(extractJson(content)) as GrowthPlan
  if (!parsed.moves || !Array.isArray(parsed.moves)) {
    throw new Error('Growth plan missing moves array.')
  }
  // Defensive: ensure every move has an id + action type.
  parsed.moves = parsed.moves.map((m, i) => ({
    ...m,
    id: m.id || `move-${i + 1}`,
    priority: (['high', 'medium', 'low'].includes(m.priority) ? m.priority : 'medium') as MovePriority,
    action: m.action || { type: 'manual' },
  }))
  return parsed
}

/**
 * Free-form advisor chat. The model answers grounded in the snapshot.
 * Returns plain text (may include a drafted message the user can copy).
 */
export async function growthChat(
  snapshot: GrowthSnapshot,
  history: { role: 'user' | 'assistant'; content: string }[],
  question: string
): Promise<string> {
  const key = requireKey()
  const system = [
    STRATEGY,
    '',
    'You are now in conversational advisor mode. Answer the chapter leader directly and practically.',
    'Ground every answer in the snapshot below. If asked to draft outreach, write ready-to-send copy.',
    'Never invent member names, companies, numbers, or wins beyond the snapshot. Be concise.',
    'Format replies in clean Markdown: use **bold** for emphasis, numbered lists for prioritized steps, and bullet lists for options. Keep paragraphs short. Do not use tables or code fences.',
    '',
    'CURRENT SNAPSHOT:',
    snapshotBriefing(snapshot),
  ].join('\n')

  const messages = [
    { role: 'system' as const, content: system },
    ...history.slice(-8),
    { role: 'user' as const, content: question },
  ]

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.7, max_tokens: 900, messages }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`DeepSeek returned ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const reply = data?.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('DeepSeek returned an empty reply.')
  return reply
}
