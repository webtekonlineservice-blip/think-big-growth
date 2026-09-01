/**
 * Generates a tailored 3-email drip sequence for any profession.
 * Every CTA links back to the member's invite code (Webtek credit).
 */

export interface SequenceStep {
  step: number
  subject: string
  body: string
  delay_days: number
  cta_text: string
  cta_url: string
}

const APP_URL = 'https://thinkbig.webtek.ai'

/**
 * Build a 3-email cold outreach sequence for a given profession.
 * @param profession e.g. "Dentist", "Plumber", "Realtor"
 * @param inviteCode member invite code for attribution (default "patrick")
 */
export function buildProfessionSequence(profession: string, inviteCode = 'patrick'): SequenceStep[] {
  const prof = profession.trim() || 'business owner'
  const ctaUrl = `${APP_URL}/invite/${inviteCode}`

  // Lowercase, singular-ish label for natural sentences
  const label = prof.toLowerCase()

  return [
    {
      step: 1,
      subject: `[name], the ${prof} seat at Think Big BNI is open`,
      body: `Hi [name],

I came across [company] and wanted to reach out — the ${prof} seat at our BNI chapter, Think Big St. Louis, is currently open.

BNI is a structured referral group where each profession gets one exclusive seat. Our members meet weekly and actively pass referrals to each other. As the only ${label} in the room, every referral for your line of work from 13+ trusted business professionals goes directly to you.

We meet every Thursday at 11:30 AM at Mike Duffy's in Kirkwood, MO. Guests visit free — no commitment.

Would you be open to checking it out?`,
      delay_days: 0,
      cta_text: 'Learn More & Register →',
      cta_url: ctaUrl,
    },
    {
      step: 2,
      subject: `How [company] could get referrals every week`,
      body: `Hi [name],

Quick follow-up — I wanted to share what makes Think Big St. Louis different from typical networking.

Imagine 13+ professionals — realtors, insurance agents, financial advisors, contractors — all trained to spot referrals for a ${label} in their daily conversations and send them directly to you.

That's exactly how BNI works. Each week our members:
• Give a 60-second pitch about what makes a great referral for them
• Pass qualified referrals to each other
• Hold each other accountable for growth

The ${prof} seat means zero competition — you'd be the only one.

Worth 90 minutes of your Thursday to see if it fits?`,
      delay_days: 4,
      cta_text: 'Reserve Your Guest Spot →',
      cta_url: ctaUrl,
    },
    {
      step: 3,
      subject: `Last thought — your ${prof} seat at Think Big`,
      body: `Hi [name],

Last note from me — I don't want to be a pest.

The ${prof} seat at Think Big St. Louis is still open. If you've been looking for a reliable way to bring in more referrals for [company], this is it.

Free to visit. Thursday 11:30 AM. Mike Duffy's Pub & Grill, Kirkwood.

If now's not the right time, no worries at all. But if you're curious, the link below takes 30 seconds.

Wishing you a great week either way.`,
      delay_days: 4,
      cta_text: "I'm Interested →",
      cta_url: ctaUrl,
    },
  ]
}
