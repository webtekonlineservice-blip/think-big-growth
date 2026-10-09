/**
 * AI caption generation for chapter social posts (DeepSeek).
 *
 * Uses the same provider/endpoint as the enrichment scripts:
 *   POST https://api.deepseek.com/chat/completions  (model: deepseek-chat)
 *
 * The brand voice is charismatic and promotional — every caption sells the
 * value of Think Big St. Louis. The model is told NEVER to invent specific
 * facts (member names, wins, numbers) beyond what the caller supplies.
 */

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram'
export type SocialType = 'meeting_promo' | 'speaker' | 'spotlight' | 'visitor_invite' | 'win' | 'custom'

export interface CaptionContext {
  type: SocialType
  platform: SocialPlatform
  /** Facts the AI may use. Only these specifics are allowed in the output. */
  facts: {
    chapterName?: string
    meetingLine?: string
    speakerName?: string
    speakerCompany?: string
    speakerDate?: string
    spotlightName?: string
    spotlightRole?: string
    spotlightCompany?: string
    winText?: string
    customBrief?: string
  }
}

const CHAPTER_NAME = 'Think Big St. Louis'
const MEETING_LINE = "Thursdays 11:30 AM at Mike Duffy's Pub & Grill, Kirkwood"

const PLATFORM_TONE: Record<SocialPlatform, string> = {
  facebook:
    'Facebook: warm, community-driven, and welcoming. Invite people in. 1–2 short paragraphs. A few tasteful emojis. End with 4–6 hashtags.',
  linkedin:
    'LinkedIn: professional and value-forward, but still energetic. Emphasize business growth, trusted referrals, and ROI. Minimal emojis. End with 3–5 professional hashtags.',
  instagram:
    'Instagram: punchy, high-energy, emoji-forward. Short, scannable lines. Strong hook on line one. End with 6–10 hashtags.',
}

const TYPE_BRIEF: Record<SocialType, string> = {
  meeting_promo: 'Promote this week\'s meeting and invite guests to visit. Convey momentum and opportunity.',
  speaker: 'Hype up the featured speaker of the week and invite people to come hear them.',
  spotlight: 'Celebrate a member — who they are, what they do, and why the chapter values them. Encourage people to use/refer their business.',
  visitor_invite: 'Invite prospective guests to a visitor day. Lower the barrier, make it exciting and no-pressure.',
  win: 'Celebrate a chapter win / referral success to show the real value members get. Prompt others to want in.',
  custom: 'Promote the chapter and its value based on the brief provided.',
}

/** Build the system + user prompt for DeepSeek. */
function buildMessages(ctx: CaptionContext): { role: 'system' | 'user'; content: string }[] {
  const chapter = ctx.facts.chapterName || CHAPTER_NAME
  const meeting = ctx.facts.meetingLine || MEETING_LINE

  const system = [
    `You are the social media voice for ${chapter}, a BNI referral-networking chapter.`,
    'Your captions are CHARISMATIC, upbeat, and promotional — they sell the energy and value of the chapter and everything it does: weekly meetings, trusted referrals, member businesses, guest visits, featured speakers, and wins.',
    'Rules:',
    `- Always weave in the meeting details: ${meeting}.`,
    '- Always end with relevant hashtags (include #BNI and #ThinkBigStL).',
    '- NEVER invent specific facts — member names, companies, dollar amounts, or wins — beyond what is provided in the facts. If a specific is missing, keep it general.',
    '- Keep it authentic and human, not corporate or spammy. No made-up statistics.',
    '- Output ONLY the caption text. No preamble, no quotes, no explanations.',
    PLATFORM_TONE[ctx.platform],
  ].join('\n')

  const factLines = Object.entries(ctx.facts)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const user = [
    `Write a ${ctx.platform} caption.`,
    `Goal: ${TYPE_BRIEF[ctx.type]}`,
    factLines ? `Facts you may use (do not add others):\n${factLines}` : 'No extra facts — keep specifics general.',
  ].join('\n\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * Generate a caption via DeepSeek. Returns the caption string.
 * Throws on missing key or API failure so the caller can fall back to a template.
 */
export async function generateCaptionAI(ctx: CaptionContext): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY is not set.')

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: buildMessages(ctx),
      temperature: 0.9,       // more creative / varied for charisma
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DeepSeek returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const caption = data?.choices?.[0]?.message?.content?.trim()
  if (!caption) throw new Error('DeepSeek returned an empty caption.')
  return caption
}
