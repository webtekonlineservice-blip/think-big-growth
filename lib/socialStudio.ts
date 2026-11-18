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
}

/**
 * Write both platform posts from a single subject typed on a phone.
 * The writer may only use what the subject says: no invented numbers,
 * names, outcomes or quotes.
 */
export async function generateQuickPost(subject: string, recent: string[] = []): Promise<QuickPostOutput> {
  const clean = subject.trim().slice(0, 600)
  const fallbackBody = clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`
  const fallback: QuickPostOutput = {
    headline: clean.length <= 40 ? clean : 'Thursday at Think Big',
    cardLine: clean.slice(0, 120),
    facebook: assemble(fallbackBody, 'facebook'),
    linkedin: assemble(fallbackBody, 'linkedin'),
  }
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.')

    const avoid = recent.slice(0, 10).map((r) => `- ${r.split('\n')[0].slice(0, 110)}`).join('\n')
    const system = [
      `You write two social posts from one subject for ${CHAPTER_NAME}, a BNI referral-networking chapter in Kirkwood, MO.`,
      'The subject was typed quickly on a phone. Use ONLY what it says. Never invent numbers, names, companies, results, quotes or events that are not in it. If it is thin, write less, not more.',
      'FACEBOOK post: the chapter speaking as "we". Warm, neighborly, 2 short paragraphs, a few tasteful emojis.',
      'LINKEDIN post: Patrick Driscoll speaking as "I". He is a member of the chapter and runs Webtek. Professional but personal, 2 short paragraphs, minimal emojis, a takeaway for business owners. Do not claim anything about Patrick beyond being a chapter member.',
      'DO NOT include the meeting day/time/location, any Webtek credit line, or hashtags. Those are added automatically.',
      'Return STRICT JSON: {"headline": "<fresh headline under 40 characters for the image>", "card_line": "<one sentence under 110 characters for the image>", "facebook": "<post body>", "linkedin": "<post body>"}',
    ].join('\n')
    const user = [
      `Subject: ${clean}`,
      avoid ? `Recent posts. Do NOT reuse their openings or phrasing:\n${avoid}` : '',
    ].filter(Boolean).join('\n\n')

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat', temperature: 0.9, max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
    const data = await res.json()
    const p = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}') as { headline?: string; card_line?: string; facebook?: string; linkedin?: string }
    if (!p.facebook?.trim() || !p.linkedin?.trim()) throw new Error('Empty post')
    return {
      headline: (p.headline || fallback.headline).trim().slice(0, 44),
      cardLine: (p.card_line || clean).trim().slice(0, 120),
      facebook: assemble(p.facebook, 'facebook'),
      linkedin: assemble(p.linkedin, 'linkedin'),
    }
  } catch (err) {
    console.error('generateQuickPost fell back to the subject text:', err instanceof Error ? err.message : err)
    return fallback
  }
}
