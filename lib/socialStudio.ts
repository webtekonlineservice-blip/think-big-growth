/**
 * Social Studio caption writer (DeepSeek).
 *
 * Difference from lib/socialAI.ts: the recurring facts are LOCKED. The model
 * writes only the hook and story. This module appends the fixed meeting block,
 * the Webtek credit and the hashtags itself, so "Thursday 11:30 at Mike Duffy's"
 * and the Webtek reference can never be reworded or dropped. The model also sees
 * recent posts and is told not to reuse their openings.
 */

import type { SocialPlatform, SocialType } from '@/lib/models/SocialPost'

export const CHAPTER_NAME = 'Think Big St. Louis'
export const LOCKED_MEETING = "📍 Thursdays · 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood, MO · Guests always welcome"
/** Always appended, never written by the AI. */
export const LOCKED_CREDIT = '💻 Marketing & web by Webtek.ai'

const HASHTAGS: Record<SocialPlatform, string> = {
  facebook: '#BNI #ThinkBigStL #Kirkwood #STLBusiness #Networking #Webtek',
  linkedin: '#BNI #ThinkBigStL #ReferralMarketing #SmallBusiness #StLouis #Webtek',
  instagram: '#BNI #ThinkBigStL #Kirkwood #STLBusiness #SmallBusinessSTL #Networking #ReferralNetwork #SupportLocal #Webtek',
}

const PLATFORM_TONE: Record<SocialPlatform, string> = {
  facebook: 'Facebook: warm, neighborly, 2 short paragraphs, a couple of tasteful emojis.',
  linkedin: 'LinkedIn: professional and value-forward, 2 short paragraphs, minimal emojis, focus on business results.',
  instagram: 'Instagram: punchy, short scannable lines, strong first line, emojis welcome.',
}

const TYPE_BRIEF: Record<SocialType, string> = {
  meeting_promo: "Invite local business owners to this week's meeting. Convey momentum.",
  speaker: "Preview this week's featured speaker and give people a reason to come hear them.",
  seat_open: 'Invite local owners in an open business category to visit and join the chapter. Membership in a referral group, never a job.',
  welcome: 'Welcome a brand-new member to the chapter. Say who they are and what they do, and ask members and readers to reach out and send them business. Warm and celebratory.',
  spotlight: 'Introduce a member: who they are, what they do, and who their ideal referral is. Make readers want to refer or use them.',
  visitor_invite: 'Invite prospective guests. Lower the barrier: it is free to visit and no-pressure.',
  win: 'Celebrate a chapter win. Show the real value of showing up weekly.',
  open_seats: 'Recruit for open seats. BNI allows one business per category, so each seat is exclusive. Make owners in those categories feel personally invited.',
  meeting_day: 'Day-of reminder: the meeting is TODAY. Short, energetic, easy to act on.',
  recap: 'Thank everyone who came this week. Keep it grateful and specific only to the facts given.',
  evergreen: 'Teach one idea about how referral networking works. Educational, not salesy.',
  photo: 'Write a caption to go with a photo from a meeting. Warm and human; only describe what the facts say is in the photo.',
  custom: 'Promote the chapter based on the brief provided.',
}

export interface StudioCaptionInput {
  type: SocialType
  platform: SocialPlatform
  facts: Record<string, string | undefined>
  /** Recent captions to avoid repeating (openings, phrases). */
  recent?: string[]
}

export interface StudioCaption {
  post: string       // full caption including locked blocks + hashtags
  cardLine: string   // short sentence printed on the image (<= ~120 chars)
  headline: string   // short headline for statement/photo cards (<= ~40 chars)
}

/** Build the final caption from a model-written body. */
export function assemble(body: string, platform: SocialPlatform): string {
  return `${body.trim()}\n\n${LOCKED_MEETING}\n${LOCKED_CREDIT}\n\n${HASHTAGS[platform]}`
}

const FALLBACK_HEADLINE: Record<SocialType, string> = {
  meeting_promo: 'Thursday, 11:30. Come see it.',
  speaker: 'Hear it live this Thursday.',
  seat_open: 'Your seat is open.',
  welcome: 'Welcome to Think Big.',
  spotlight: 'Meet a Think Big member.',
  visitor_invite: 'You are invited.',
  win: 'Referrals at work.',
  open_seats: 'Your seat is waiting.',
  meeting_day: 'See you at 11:30.',
  recap: 'Thank you, Think Big.',
  evergreen: 'How referrals really work.',
  photo: 'Thursday at Think Big',
  custom: 'Think Big St. Louis',
}

/** Deterministic fallback when the AI is unavailable. */
export function fallbackCaption(input: StudioCaptionInput): StudioCaption {
  const f = input.facts
  const hook =
    input.type === 'speaker' ? `This Thursday we're hearing from ${f.name || 'a great speaker'}${f.company ? ` of ${f.company}` : ''}.` :
    input.type === 'spotlight' ? `Meet ${f.name || 'one of our members'}${f.role ? `, our ${f.role}` : ''}${f.company ? ` at ${f.company}` : ''}.` :
    input.type === 'welcome' ? `Please give a warm Think Big welcome to ${f.name || 'our newest member'}${f.role ? `, ${f.role}` : ''}${f.company ? ` at ${f.company}` : ''}.` :
    input.type === 'open_seats' ? `We're looking for local owners in: ${f.seats || 'several categories'}. One seat per category, and each one is exclusive.` :
    input.type === 'meeting_day' ? `Today's the day. We meet at 11:30.` :
    input.type === 'recap' ? `Thank you to everyone who showed up this week.` :
    input.type === 'evergreen' ? `${f.topic || 'A good referral is an introduction with context, not just a name.'}` :
    input.type === 'visitor_invite' ? `Curious how referral networking works? Come see it in person. It's free to visit.` :
    input.type === 'photo' ? `${f.photo_note || 'A little of what Thursday looks like at Think Big.'}` :
    `Think Big St. Louis is a group of local owners who send each other business every week.`
  return { post: assemble(hook, input.platform), cardLine: hook.slice(0, 120), headline: FALLBACK_HEADLINE[input.type] }
}

/**
 * Generate a unique caption, on-image line and headline. Falls back to a
 * template on any failure so the plan never blocks on the AI.
 */
export async function generateStudioCaption(input: StudioCaptionInput): Promise<StudioCaption> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.')

    const facts = Object.entries(input.facts)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n')
    const avoid = (input.recent ?? []).slice(0, 10).map((r) => `- ${r.split('\n')[0].slice(0, 110)}`).join('\n')

    const system = [
      `You write social media posts for ${CHAPTER_NAME}, a BNI referral-networking chapter in Kirkwood, MO.`,
      'Voice: genuine, local, upbeat. Sounds like a person, not a brand. No corporate jargon, no made-up statistics.',
      'NEVER invent member names, companies, results, dollar amounts or quotes. Use only the facts provided.',
      'DO NOT include the meeting day/time/location, any Webtek credit line, or hashtags. Those are added automatically.',
      PLATFORM_TONE[input.platform],
      'Return STRICT JSON: {"post": "<caption body>", "card_line": "<one punchy sentence under 110 characters for the image>", "headline": "<a fresh headline under 40 characters>"}',
    ].join('\n')

    const user = [
      `Goal: ${TYPE_BRIEF[input.type]}`,
      facts ? `Facts you may use:\n${facts}` : 'No specific facts, keep it general.',
      avoid ? `Recent posts. Do NOT reuse their openings or phrasing:\n${avoid}` : '',
    ].filter(Boolean).join('\n\n')

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.95,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
    const data = await res.json()
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}') as { post?: string; card_line?: string; headline?: string }
    if (!parsed.post?.trim()) throw new Error('Empty caption')
    return {
      post: assemble(parsed.post, input.platform),
      cardLine: (parsed.card_line || parsed.post).trim().slice(0, 120),
      headline: (parsed.headline || FALLBACK_HEADLINE[input.type]).trim().slice(0, 44),
    }
  } catch (err) {
    console.error('generateStudioCaption fell back to template:', err instanceof Error ? err.message : err)
    return fallbackCaption(input)
  }
}

// ─── Quick post: one subject → Facebook + LinkedIn ───────────────────────────

export interface QuickPostOutput {
  headline: string
  cardLine: string
  facebook: string    // chapter voice ("we"), locked blocks + hashtags appended
  linkedin: string    // Patrick's voice ("I"), locked blocks + hashtags appended
  angle?: string
}
export interface QuickPostResult extends QuickPostOutput {
  options: QuickPostOutput[]
}

export type PostTone = 'witty' | 'heartfelt' | 'direct'
export const POST_TONES: { id: PostTone; label: string }[] = [
  { id: 'witty', label: 'Witty' },
  { id: 'heartfelt', label: 'Heartfelt' },
  { id: 'direct', label: 'Direct' },
]
const TONE_RULES: Record<PostTone, string> = {
  witty: 'Tone: witty and playful. Clever wordplay, a light joke or a surprising comparison. Smart, never corny, never mean.',
  heartfelt: 'Tone: heartfelt and warm. Gratitude, community, real human connection. Sincere, not sappy.',
  direct: 'Tone: direct and confident. Short sentences, clear value, a strong call to action. No fluff.',
}

/** Creative angles. Each option gets a different one so the three never read alike. */
const ANGLES = [
  'Behind the scenes: what the moment actually looks and feels like from inside the room.',
  'Myth-buster: open by gently knocking down a misconception about networking or BNI, then the truth.',
  'Question first: open with a question the reader will answer in their head.',
  'Hot take: a bold one-line opinion about doing business locally, then back it up.',
  'Referral math: show how one introduction can turn into ongoing business (general logic only, no invented numbers).',
  'Tiny story: tell it as a short moment with a beginning and an end, using only the facts given.',
  'Listicle in miniature: three quick, punchy lines.',
  'Neighbor voice: talk like a local who loves Kirkwood and St. Louis businesses.',
]

function pickAngles(n: number): string[] {
  const pool = ANGLES.slice()
  const out: string[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  return out
}

const BASE_RULES = [
  'Use ONLY the facts given. Never invent numbers, names, companies, results, quotes, testimonials or events. If the facts are thin, write less, not more.',
  'FACEBOOK post: the chapter speaking as "we". 2 short paragraphs, a few tasteful emojis.',
  'LINKEDIN post: Patrick Driscoll speaking as "I". He is a member of the chapter and runs Webtek. Professional but personal, 2 short paragraphs, minimal emojis, one takeaway for business owners. Claim nothing about Patrick beyond being a chapter member.',
  'DO NOT include the meeting day/time/location, any Webtek credit line, or hashtags. Those are added automatically.',
  'Avoid cliches: "game-changer", "unlock", "elevate", "synergy", "in today\'s fast-paced world", "look no further".',
]

async function deepseekJson(system: string, user: string, temperature = 0.95, maxTokens = 2200): Promise<Record<string, unknown>> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.')
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature, max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
  const data = await res.json()
  return JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
}

function avoidBlock(recent: string[]): string {
  const avoid = recent.slice(0, 10).map((r) => `- ${r.split('\n')[0].slice(0, 110)}`).join('\n')
  return avoid ? `Recent posts. Do NOT reuse their openings or phrasing:\n${avoid}` : ''
}

/**
 * Write three takes on one subject, each with a different creative angle,
 * in the chosen tone. The first option is also returned at the top level.
 */
export async function generateQuickPost(subject: string, recent: string[] = [], tone: PostTone = 'witty'): Promise<QuickPostResult> {
  const clean = subject.trim().slice(0, 600)
  const fallbackBody = /[.!?]$/.test(clean) ? clean : `${clean}.`
  const fb: QuickPostOutput = {
    headline: clean.length <= 40 ? clean : 'Thursday at Think Big',
    cardLine: clean.slice(0, 120),
    facebook: assemble(fallbackBody, 'facebook'),
    linkedin: assemble(fallbackBody, 'linkedin'),
  }
  const angles = pickAngles(3)
  try {
    const system = [
      `You write social posts for ${CHAPTER_NAME}, a BNI referral-networking chapter in Kirkwood, MO.`,
      'The subject was typed quickly on a phone.',
      ...BASE_RULES,
      TONE_RULES[tone],
      'Write THREE different options. Each option must follow its assigned angle and open differently from the others.',
      'Return STRICT JSON: {"options": [{"headline": "<under 40 characters, for the image>", "card_line": "<one sentence under 110 characters, for the image>", "facebook": "<post body>", "linkedin": "<post body>"}, ... x3]}',
    ].join('\n')
    const user = [
      `Subject: ${clean}`,
      angles.map((a, i) => `Option ${i + 1} angle: ${a}`).join('\n'),
      avoidBlock(recent),
    ].filter(Boolean).join('\n\n')
    const p = await deepseekJson(system, user)
    const raw = Array.isArray(p.options) ? (p.options as Record<string, string>[]) : []
    const options = raw
      .filter((o) => o && o.facebook?.trim() && o.linkedin?.trim())
      .slice(0, 3)
      .map((o, i) => ({
        headline: (o.headline || fb.headline).trim().slice(0, 44),
        cardLine: (o.card_line || clean).trim().slice(0, 120),
        facebook: assemble(o.facebook, 'facebook'),
        linkedin: assemble(o.linkedin, 'linkedin'),
        angle: angles[i]?.split(':')[0] ?? '',
      }))
    if (!options.length) throw new Error('Empty options')
    return { ...options[0], options }
  } catch (err) {
    console.error('generateQuickPost fell back to the subject text:', err instanceof Error ? err.message : err)
    return { ...fb, options: [fb] }
  }
}

// ─── Open seat: invite a new member for an open business category ──────────

export interface SeatPostOption {
  headline: string          // e.g. "Calling all St. Louis CPAs"
  tagline: string           // script line on the image, under 34 chars
  lookingFor: string[]      // 3 short lines describing a great fit, each under 40 chars
  facebook: string
  linkedin: string
  angle?: string
}
export interface SeatPostResult { seat: string; options: SeatPostOption[] }

/** Facts about every seat that are always true. The model may use these and nothing else. */
const SEAT_FACTS = [
  'Think Big St. Louis is a BNI chapter: local business owners who meet weekly and refer business to each other.',
  'Each business category has exactly one seat, so the member who holds it is the only one from that field in the group.',
  'Members give a short weekly introduction about their business and pass referrals to each other.',
  'Guests can visit a meeting for free with no commitment.',
]

function seatFallback(seat: string): SeatPostOption {
  return {
    headline: `Seat open: ${seat}`.slice(0, 40),
    tagline: 'Your referral partners are waiting.',
    lookingFor: [`An established local ${seat}`, 'Someone who loves helping others', 'Ready to show up every Thursday'],
    facebook: assemble(`Our ${seat} seat is open. In BNI each business category has one seat, so the ${seat} who joins is the only one in the room when referrals get passed. Know someone great? Tag them, or come visit as our guest. It's free.`, 'facebook'),
    linkedin: assemble(`Our BNI chapter has an open seat for a ${seat}. Each category has exactly one seat, so the person who takes it is the only ${seat} our members refer. If that's you, or someone you trust, I'd be glad to have you visit as my guest.`, 'linkedin'),
  }
}

/**
 * Three takes on recruiting a new member for one open business category.
 * This is membership, not employment: no hiring, job, salary or "apply" language.
 */
export async function generateSeatPost(seat: string, recent: string[] = [], tone: PostTone = 'witty', note = ''): Promise<SeatPostResult> {
  const cleanSeat = seat.trim().slice(0, 60)
  const angles = pickAngles(3)
  try {
    const system = [
      `You write posts that invite a local business owner to join ${CHAPTER_NAME}, a BNI referral-networking chapter in Kirkwood, MO, in a business category whose seat is open.`,
      'This is MEMBERSHIP in a referral group, NOT a job. Never use the words hiring, hire, job, position, role opening, apply, applicant, candidate, salary, pay, perks or benefits package. Nobody is being employed.',
      'Speak to owners and professionals in that field, and to readers who might know one. Make it appealing to be the only one from that category in the group.',
      'Never promise or guarantee referrals, volume, income or results. Do not say they would get "every" or "all" referrals. Say members refer each other and the seat is exclusive, and let the reader imagine the rest.',
      ...BASE_RULES,
      TONE_RULES[tone],
      `True facts you may use:\n- ${SEAT_FACTS.join('\n- ')}`,
      'End by inviting readers to tag a great local professional in that field, or to visit as a guest.',
      'Write THREE different options, each following its assigned angle.',
      'For each option also write, for the image: "headline" (under 32 characters, e.g. "Calling all local CPAs"), "tagline" (under 30 characters, warm or clever), and "looking_for": exactly 3 short lines describing who would be a great fit for the seat, each under 36 characters (e.g. "Loves helping small businesses"). These describe the kind of member, not job requirements.',
      'Return STRICT JSON: {"options": [{"headline": "", "tagline": "", "looking_for": ["", "", ""], "facebook": "", "linkedin": ""}, ... x3]}',
    ].join('\n')
    const user = [
      `Open seat (business category): ${cleanSeat}`,
      note.trim() ? `Extra facts from the chapter (true, may use): ${note.trim().slice(0, 300)}` : '',
      angles.map((a, i) => `Option ${i + 1} angle: ${a}`).join('\n'),
      avoidBlock(recent),
    ].filter(Boolean).join('\n\n')
    const p = await deepseekJson(system, user)
    const raw = Array.isArray(p.options) ? (p.options as Record<string, unknown>[]) : []
    const fb = seatFallback(cleanSeat)
    const banned = /\b(hiring|hire|job|salary|apply|applicant|candidate)\b/i
    const options = raw
      .filter((o) => typeof o?.facebook === 'string' && typeof o?.linkedin === 'string')
      .filter((o) => !banned.test(`${o.facebook} ${o.linkedin} ${o.headline ?? ''} ${o.tagline ?? ''}`))
      .slice(0, 3)
      .map((o, i) => {
        const lf = Array.isArray(o.looking_for) ? (o.looking_for as unknown[]).map((r) => String(r).trim()).filter(Boolean).slice(0, 3) : []
        return {
          headline: String(o.headline || fb.headline).trim().slice(0, 40),
          tagline: String(o.tagline || fb.tagline).trim().slice(0, 34),
          lookingFor: lf.length === 3 ? lf.map((r) => r.slice(0, 42)) : fb.lookingFor,
          facebook: assemble(String(o.facebook), 'facebook'),
          linkedin: assemble(String(o.linkedin), 'linkedin'),
          angle: angles[i]?.split(':')[0] ?? '',
        }
      })
    if (!options.length) throw new Error('No usable options')
    return { seat: cleanSeat, options }
  } catch (err) {
    console.error('generateSeatPost fell back to template:', err instanceof Error ? err.message : err)
    return { seat: cleanSeat, options: [seatFallback(cleanSeat)] }
  }
}
