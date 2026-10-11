# Webtek.ai — Think Big St. Louis Command Center

> Admin panel for managing the Think Big St. Louis BNI chapter.
> Every Thursday 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood MO

---

## Navigation Overview

```
Webtek.ai Command Center
│
├── Dashboard
├── Visitors
├── Members
├── Treasurer
├── Marketing
├── Seats
├── Prospects
├── Outbound
├── Campaigns
├── Announce
├── Email Test
├── Analytics
└── Send Log
```

---

## Dashboard

**Purpose:** The command center home screen — a mobile-first snapshot of everything happening in the chapter right now.

**What it shows:**
- **This Thursday card** — next meeting date, speaker name and photo, venue details. Links to the Speakers tab if no speaker is assigned yet.
- **Key Stats (2-column grid)** — Members (active chapter size), Visitors (total + this month), Outstanding balance (total owed + who owes), Seats Filled (X/34 + active outreach count).
- **Needs Attention** — any member with an unpaid balance (photo + name + amount), plus pending visitors (invited or visited but not yet applied). These are the things that need action today.
- **Quick Actions** — six large tap-friendly buttons: Weekly Bill, Send Reminder, Invoice Member, New Visitor, Social Post, View Report.
- **Status Strips** — Outbound Campaigns (prospects, emails sent, open rate, active) and Marketing (sends last 7 days, scheduled posts, conversion rate).
- **Secondary Stats** — Active campaigns, visitors this month, email open rate, open seats count.
- **Chapter Health bars** — Seats filled %, email open rate, visitor-to-member conversion rate. Starting balance and outstanding shown at the bottom.
- **Refresh button** — pulls latest data from all sources on demand.

**Designed for:** Quick check at a meeting, on the go, or first thing in the morning. Everything important visible without scrolling on a phone.

---

## Visitors

**Purpose:** Track every person who has been invited to or visited the chapter.

**What it shows:**
- Full visitor list with status badges: `invited` → `visited` → `applied` → `member`
- Filter by status + search by name, email, company, or phone
- Per-visitor detail: first/last name, email, phone, company, business type, referral source, who invited them, visit date, notes
- Status update (move visitor through the pipeline)
- Add visitor manually
- SMS a visitor directly from their row
- Notes and visit-date drawer (inline edit)

**Purpose of the pipeline:**
- `invited` — was given an invite link but hasn't come yet
- `visited` — attended at least one meeting
- `applied` — submitted the BNI application
- `member` — accepted and joined the chapter

**Used by:** Chapter president and membership committee to track who's in the funnel and follow up with warm leads.

---

## Members

**Purpose:** Manage all active chapter members — their profiles, credentials, and communication assets.

**What it shows:**
- Full member table with avatar (photo or initials), name, BNI role/profession, company, email, invite link, admin flag
- Edit any member: name, email, role, company, phone, invite code, display order, admin toggle
- Upload a **headshot photo** (used on social graphics and the treasurer ledger)
- Upload a **business logo** (used on spotlight marketing cards)
- Reset password
- Remove a member
- Send announcement email to all members or a test to yourself

**Key features:**
- Each member gets a personal `/invite/[code]` link for referral tracking
- Photo uploads are compressed to ~20KB JPEG for fast loading
- Photos auto-appear on the Treasurer ledger, Social post cards, and Dashboard

**Used by:** Chapter treasurer and administrator for roster management.

---

## Treasurer

**Purpose:** The full financial operating system for the chapter — lunch billing, dues tracking, member balances, income/expense, speaker rotation, social media, and Google Slides integration.

**Tabs inside Treasurer:**

### Lunch Ledger
Track what each member owes and has paid.
- Member cards with photo/avatar, colored status ring (red = owes, green = paid, blue = credit)
- Per-member entry history (charges, payments, dishes for cross-reference)
- Inline edit on any entry (amount, date, description, status, dish, notes)
- **Weekly Entry form:** choose meeting date, mark who ate ($24 flat incl. dues), mark non-eaters ($4 dues), add visitors who ate, enter 50/50 raffle amounts, paste receipt for AI parsing
- **Paste Receipt:** paste the Toast POS receipt → AI (DeepSeek) extracts date, total, and item list; you confirm before posting
- **Record Payment form:** member or visitor, SMS/email/WhatsApp supported, notes (Cash, Venmo, etc.)

### Income/Expense
All chapter income and expenses (not member-specific).
- Filter by All / Income / Expense
- Add transaction manually
- **Inline edit** on any transaction (type, category, amount, date, description, notes)
- Categories: Member Payment, Guest Fee, Event Income, Dues, 50/50 Collected, Weekly Lunch, 50/50 Payout, Room Rental, Supplies, Marketing, Event Expense, Other

### Report
Chapter-level financial summary.
- Bank/starting balance, outstanding owed, income this month, net
- **Member Balances grid** — compact 3-column layout, Paid / $X due / No activity, "Owing only" filter
- **Balances CSV** — export member balance summary
- **Line Items CSV** — export every ledger charge/payment including dish for payment cross-reference
- **Preview & Send** — email the full treasurer report (member balances + transactions) to any address

### Slides
Generate copy-ready content for slides 93, 94, and 95 in the chapter meeting deck.
- **Push to Slides** button — writes live values directly into the Google Slides deck via the Slides API (one click, deck updates in ~2 seconds)
- **Slide 93** — per-member dues status (Paid / $X due / Pending), tap any member to toggle Pending manually
- **Slide 94** — chapter summary (Starting Balance → Dues Collected → 50/50 → Expenses → Total in Account)
- **Slide 95** — speaker rotation (next 4 meetings with dates and speaker names)
- Copy blocks for each slide (paste manually if preferred)

### Speakers
Manage the weekly speaker rotation that feeds slide 95 and the Social tab.
- Add/update a speaker for any meeting date (pick a member or type a guest name)
- Date picker opens a calendar on tap
- Speaker rotation list (delete any slot)

### Social
AI-powered social media content for Facebook, LinkedIn, and Instagram.
- **Post types:** Weekly Meeting Promo, Speaker of the Week, Member Spotlight, Visitor-Day Invite, Win/Testimonial, Open Seats (recruiting), Custom
- **Generate with AI** — DeepSeek generates a charismatic, story-driven caption pulling from real chapter data (speaker name/company, member name/role/company, open seats list)
- **Graphic preview** — live 1080×1080 canvas card with BNI branding, member photo, name, role, and the AI caption rendered inside the card
- **Download PNG** — download the card for direct posting
- **Platform-aware tone:** LinkedIn (professional), Facebook (warm/community), Instagram (punchy/emoji-heavy)
- **Save Draft / Schedule** — save posts with a planned date and status (idea → drafted → scheduled → posted)
- **Post plan** — weekly calendar of scheduled posts with status management

---

## Marketing

**Purpose:** Send SMS, WhatsApp, and email communications to chapter members. Test-first — all sends route to the admin test address until you flip to Live mode.

**Tabs inside Marketing:**

### Member Invoice
Send an individual member their current balance and recent charges via SMS, email, or WhatsApp.
- Pick a member → see their photo, phone, and email on file
- Choose channels (SMS / Email / WhatsApp)
- **Test mode (default)** — routes to webtekdigitalai@gmail.com / +13149223810
- Invoice shows: balance due, recent charges with dates and dish names, payment instructions

### Meeting Reminder
Broadcast the weekly meeting reminder to all members.
- Auto-fills speaker name from the Speakers tab for the chosen date
- Preview the exact message before sending
- Channels: SMS, WhatsApp
- Shows how many members have a phone number on file (and how many will be skipped)
- Test mode sends once to your test number

### Announcement
Send a custom message to all members.
- Free-text message field (meeting details appended automatically)
- Channels: SMS, WhatsApp
- Live count of members who will receive it

### Send Log
Full history of every marketing send.
- Channel, type, recipient name, timestamp, status (sent / failed)
- Expandable rows showing the full message body and any error
- Refresh button

---

## Seats

**Purpose:** Manage the 34 BNI profession seats — which are filled, which have active outreach, and which are open.

**What it shows:**
- All 34 profession categories with status: `filled` (member in chapter), `active` (outreach campaign running), `paused` (campaign exists but paused), `open` (no campaign, no member)
- Filter by status (All / Open / Active / Paused / Filled)
- Search by profession name
- For each seat: who fills it (member name + company), campaign name, prospects count, emails sent/opened
- **Toggle outreach** — activate or pause a seat's campaign with one tap (cap: max 5 active at once)
- **Scrape prospects** — trigger Google Maps scraping for that profession in Kirkwood MO
- Summary cards: seats filled, active outreach, available slots

**Business rule:** Only one member per profession. The seat is considered "filled" using alias-aware matching (e.g. "Roofing - Residential" matches the "Contractor / Builder" seat).

---

## Prospects

**Purpose:** Organize and manage all scraped leads on a Kanban board, grouped by profession/category.

**What it shows:**
- **Board view** — Kanban columns per profession, each card shows name, company, phone, email, email sequence progress
- **List view** — table of all prospects with category badge and status
- Column headers show if a BNI seat is **Open** (green — high priority to recruit) or **Filled** (grey)
- Drag a card between columns to re-categorize a prospect
- **Enrichment bar** — how many prospects have real emails vs. placeholders, with "Find Emails" button (scrapes prospect websites for contact emails)
- **CSV import** — paste a Google Maps or other data export; auto-maps common field names
- **+ Campaign button** per column — one click creates a tailored 3-email drip campaign for that profession
- Search (client-side, by name/company/profession)

**Data collected per prospect:** name, company, profession, email, phone, website, source, campaign, sequence step, opens, clicks, unsubscribed flag.

---

## Outbound

**Purpose:** Manage outbound email drip campaigns targeting prospects for open BNI seats.

**What it shows:**
- Campaign tabs (one per profession or event target)
- Per-campaign stats: Prospects, Emails Sent, Opened, Clicked, Open Rate, Unsubscribes
- **Automation toggle** — turn the daily cron send on/off per campaign
- **Emails per day** (batch size) — editable per campaign
- **Send Next Batch Now** — manually trigger the next round of drip emails
- **CSV import** — add new prospects to the selected campaign
- **Prospect table** — name, email, company, which email step (1/2/3), opens, clicks, status

**How the drip works:**
- Email 1 (Day 0): intro — the seat is open, come visit
- Email 2 (Day 4): value — how referrals work, why BNI is different
- Email 3 (Day 8): follow-up — last note, no pressure
- Seat-fill guard: if the profession's BNI seat gets filled by a member, the campaign auto-pauses

---

## Campaigns

**Purpose:** Send a one-time blast (email or SMS) to chapter visitors or segments (not a drip — a single broadcast message).

**What it shows:**
- Segment picker: Visited, Applied, Invited, All Visitors
- Channel: SMS, Email, or Both
- Message composer with merge tags and CTA
- Subject line (for email)
- Template library (pre-built messages for common use cases)
- Send to the selected segment

**Difference from Outbound:** Outbound is automated drip sequences to cold prospects. Campaigns is one-time broadcasts to warm contacts (people who've already been to a meeting or are in the visitor pipeline).

---

## Announce

**Purpose:** Send a formatted announcement email to all chapter members at once.

**What it shows:**
- Preview of the email template
- Test mode — send to a specific address first
- "Send to All Members" — broadcasts to every member with a real (non-placeholder) email address
- Shows the count of members who will receive it

**Used for:** Chapter news, event announcements, reminders, dues changes, special meeting details.

---

## Email Test

**Purpose:** Preview and test outbound prospect emails before they go to real leads.

**What it shows:**
- Step selector (Email 1, 2, or 3 of the drip sequence)
- Test recipient email (defaults to your admin email)
- Test merge values: name, company, profession
- Send a preview of exactly what a prospect would receive, with real tracking links and BNI branding

**Used for:** QA before activating a new campaign. Always test here first.

---

## Analytics

**Purpose:** Chapter-level performance metrics — visitor traffic, conversion rates, campaign results, and growth trends.

**What it shows:**
- Visitor volume over time (chart)
- Conversion funnel: Invited → Visited → Applied → Member
- Monthly visitor counts
- Campaign performance summary (open rates, click rates across all campaigns)
- Source breakdown (where visitors are coming from)
- Member growth over time

**Used for:** Monthly chapter reports, tracking what's working, identifying where visitors drop off in the pipeline.

---

## Send Log

**Purpose:** A complete audit trail of every automated outbound email sent to prospects.

**What it shows:**
- Every email sent via the outbound drip system
- Per-row: date sent, prospect name, campaign, email step (1/2/3), status (sent/failed), open count, click count
- Pagination (50 per page)
- Re-preview any email step (sends a copy to your inbox for QA)
- Filter by status

**Difference from Marketing → Send Log:** This Send Log covers outbound prospect emails (the drip campaigns). The Marketing Send Log covers member/visitor communications (SMS, WhatsApp, email via the Marketing page).

---

## Key Concepts

### The $4 / $24 Rule
Every chapter member owes **$4/week** regardless of attendance (weekly dues). If they eat lunch, the charge is **$24 flat** — this includes the $4 dues. The $24 is not stacked on top of $4.

### Test Mode
All marketing sends (SMS, WhatsApp, email) default to **Test mode** — messages route to `webtekdigitalai@gmail.com` and `+13149223810`. You must explicitly turn off test mode to send to real members.

### Seat Aliases
BNI has 34 profession seats. The system uses a 25-category alias map (`seatAliases.ts`) to match free-text profession strings to canonical seat names. Example: "Roofing - Residential", "Roofer", "General Contractor" all match the "Contractor / Builder" seat.

### Google Slides Integration
The Treasurer → Slides tab can push live data directly into slides 93, 94, and 95 of the chapter meeting deck via the Google Slides API. Requires a service account with Editor access to the deck. Tokens: `{{member_1}}` through `{{member_25}}`, `{{status_1}}` through `{{status_25}}` (slide 93), `{{starting_balance}}` etc. (slide 94), `{{speaker_1}}` through `{{speaker_4}}` and `{{speaker_date_1}}` through `{{speaker_date_4}}` (slide 95).

### BNI Roster Sync
A weekly cron (`/api/cron/sync-bni`, Mondays 1 PM UTC) fetches the live BNI chapter page, compares the roster to the DB, auto-adds new members, updates changed contact info, and pulls leadership headshots into member `photo` fields. Removals are flagged for review only — never auto-deleted.

---

*Document maintained alongside the codebase. Update this file when new features are added.*
