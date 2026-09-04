/**
 * Real Estate Stack Day sequence — event-specific outreach for the
 * September 10, 2026 "Visitor Day for the Realtor Seat" event.
 *
 * Details match the printed flyer (public/stack-day.png):
 *   Thursday, September 10th · 11:30 AM – 1:00 PM
 *   Mike Duffy's · 124 W Jefferson Ave, Kirkwood, MO 63122
 *   Register at tb.visitbni.us
 */

import type { SequenceStep } from './emailSequences'

// Public registration link printed on the flyer.
const REGISTER_URL = 'https://tb.visitbni.us'

// Event flyer served from /public. Rendered as the hero image on step 1.
const CARD_IMAGE = '/stack-day.png'

export function buildStackDaySequence(_inviteCode = 'patrick'): SequenceStep[] {
  const ctaUrl = REGISTER_URL

  return [
    {
      step: 1,
      subject: `[name], you're invited — Visitor Day for the Realtor Seat, Sept 10`,
      body: `Hi [name],

You're invited to our Visitor Day for the Realtor Seat at BNI Think Big St. Louis on Thursday, September 10th.

We're filling the room with great referrals, and the real estate seat is the one we'd love you to see. BNI chapters allow only ONE real estate agent — whoever claims the seat gets every real estate referral the group generates, with zero competition in the room. In one morning you'll meet the lenders, title reps, inspectors, contractors, insurance agents, and attorneys who could be sending you business every week.

📅 Thursday, Sept 10, 2026 · 11:30 AM – 1:00 PM
📍 Mike Duffy's · 124 W Jefferson Ave, Kirkwood, MO 63122
💰 Free to attend

More visitors. More referrals. More business. Register below to save your spot.`,
      delay_days: 0,
      cta_text: 'Register at tb.visitbni.us →',
      cta_url: ctaUrl,
      image_url: CARD_IMAGE,
    },
    {
      step: 2,
      subject: `The Realtor seat at our chapter — one agent only`,
      body: `Hi [name],

Quick follow-up on Visitor Day for the Realtor Seat (Sept 10).

Here's what makes it worth your Thursday morning: BNI chapters allow only ONE real estate agent per chapter. Whoever claims the seat gets every real estate referral the group generates — with zero competition inside the room.

At the event you'll meet the members who could be sending you referrals: lenders, title reps, home inspectors, contractors, insurance agents. These are the exact partners that fuel a steady real estate pipeline.

📅 Thursday, Sept 10 · 11:30 AM – 1:00 PM
📍 Mike Duffy's · 124 W Jefferson Ave, Kirkwood, MO 63122

Come see if it's a fit — no pressure, no commitment.`,
      delay_days: 2,
      cta_text: 'Save My Seat for Sept 10 →',
      cta_url: ctaUrl,
      image_url: CARD_IMAGE,
    },
    {
      step: 3,
      subject: `Last call — Visitor Day for the Realtor Seat is this week`,
      body: `Hi [name],

Visitor Day for the Realtor Seat is almost here — Thursday, September 10th at 11:30 AM.

If you've been looking for a reliable source of referrals that doesn't cost you ad dollars, this is the room to be in. One visit, no obligation, and you'll leave knowing whether it's right for your business.

📅 Thursday, Sept 10 · 11:30 AM – 1:00 PM
📍 Mike Duffy's · 124 W Jefferson Ave, Kirkwood, MO 63122

Spots are limited for the event. Grab yours below and I'll make sure you're on the list.`,
      delay_days: 3,
      cta_text: "I'll Be There →",
      cta_url: ctaUrl,
      image_url: CARD_IMAGE,
    },
  ]
}
