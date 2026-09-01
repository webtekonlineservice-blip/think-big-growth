/**
 * Real Estate Stack Day sequence — event-specific outreach for the
 * September 10, 2026 recruitment event targeting real estate agents.
 */

import type { SequenceStep } from './emailSequences'

const APP_URL = 'https://thinkbig.webtek.ai'

export function buildStackDaySequence(inviteCode = 'patrick'): SequenceStep[] {
  const ctaUrl = `${APP_URL}/invite/${inviteCode}`

  return [
    {
      step: 1,
      subject: `[name], you're invited — Real Estate Stack Day, Sept 10`,
      body: `Hi [name],

I'm reaching out because we're hosting a Real Estate Stack Day at Think Big St. Louis on Thursday, September 10th — and we'd love to have you there.

A "stack day" is when we invite top agents to visit our BNI chapter and see how our members generate consistent referral business. For real estate agents, the referral potential here is huge — mortgage brokers, insurance agents, contractors, attorneys, and more, all in one room, all sending business your way.

📅 Thursday, Sept 10, 2026 · 11:30 AM
📍 Mike Duffy's Pub & Grill, Kirkwood MO
💰 Free to attend — breakfast included

Would you like to join us?`,
      delay_days: 0,
      cta_text: 'Reserve My Spot →',
      cta_url: ctaUrl,
    },
    {
      step: 2,
      subject: `The Realtor seat at our chapter — one agent only`,
      body: `Hi [name],

Quick follow-up on the Real Estate Stack Day (Sept 10).

Here's what makes this worth your Thursday morning: BNI chapters allow only ONE real estate agent per chapter. Whoever claims the seat gets every real estate referral the group generates — with zero competition inside the room.

At Stack Day you'll meet the members who could be sending you referrals: lenders, title reps, home inspectors, contractors, insurance agents. These are the exact partners that fuel a steady real estate pipeline.

📅 Thursday, Sept 10 · 11:30 AM · Kirkwood

Come see if it's a fit — no pressure, no commitment.`,
      delay_days: 3,
      cta_text: 'Save My Seat for Sept 10 →',
      cta_url: ctaUrl,
    },
    {
      step: 3,
      subject: `Last call — Real Estate Stack Day is this week`,
      body: `Hi [name],

Real Estate Stack Day is almost here — Thursday, September 10th at 11:30 AM.

If you've been looking for a reliable source of referrals that doesn't cost you ad dollars, this is the room to be in. One visit, no obligation, and you'll leave knowing whether it's right for your business.

📅 Thursday, Sept 10 · 11:30 AM
📍 Mike Duffy's Pub & Grill, Kirkwood MO

Spots are limited for the event. Grab yours below and I'll make sure you're on the list.`,
      delay_days: 4,
      cta_text: "I'll Be There →",
      cta_url: ctaUrl,
    },
  ]
}
