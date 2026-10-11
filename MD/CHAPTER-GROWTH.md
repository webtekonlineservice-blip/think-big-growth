# Think Big St. Louis — Chapter Growth App

## Goal
Build a member management and marketing platform to grow the Think Big St. Louis BNI chapter.
Increase membership, track visitors/prospects, and manage outreach via SMS and email.

## Chapter Info
- **Chapter**: Think Big St. Louis
- **Location**: Mike Duffy's Pub & Grill, Kirkwood MO
- **Meeting**: Thursdays 11:30 AM
- **URL**: https://bnimidamerica.com/mo-st--louis-think-big-st--louis/en-US/index
- **Current members**: 13

---

## Core Features

### 1. Member Portal (Login Required)
- Each member has a login (Firebase Auth)
- Member dashboard shows their referrals, visitors brought in, stats
- Members can invite prospects via personalized link
- Track who invited who (member → visitor linkage)

### 2. Visitor/Prospect Management
- Log visitors to meetings
- Track status: Invited → Visited → Applied → Member
- Link visitor to the member who invited them
- Notes field per visitor

### 3. SMS Marketing (Twilio)
- Send targeted texts to prospects
- Automated follow-up sequences (text 1 day after visit, 1 week, 1 month)
- Templates: "Thanks for visiting", "Application reminder", "Meeting reminder"
- Opt-out handling (STOP)

### 4. Email Marketing
- Welcome email when visitor registers
- Follow-up drip sequence
- Monthly chapter newsletter
- Automated via Resend or Nodemailer

### 5. Invite System
- Each member gets a unique invite link: `/invite/[memberId]`
- Visitor fills out form (name, email, phone, business type)
- Member gets notified when their invite is used
- Visitor is tracked back to the inviting member

### 6. Analytics Dashboard (Admin)
- Total members vs goal
- Visitors this month / conversion rate
- Most active inviters
- Pipeline by status

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (HttpOnly cookie) + bcrypt |
| SMS | Twilio |
| Email | Resend (simple API, free tier) |
| Hosting | Vercel |
| Admin | Existing admin panel (extend) |

---

## Data Model (MongoDB)

```
members
  ├── name, role, company, email, phone
  ├── password_hash (bcrypt)
  ├── invite_code (unique short code)
  ├── is_admin (boolean)
  ├── display_order
  └── created_at

visitors
  ├── first_name, last_name, email, phone, business_type
  ├── invited_by: member ObjectId
  ├── status: 'invited' | 'visited' | 'applied' | 'member'
  ├── visit_date, notes
  └── created_at

invites
  ├── member_id: ObjectId
  ├── visitor_id: ObjectId
  ├── invite_code
  └── created_at
```

---

## Pages / Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/invite/[code]` | Public | Member's invite landing page |
| `/join` | Public | Visitor registration form |
| `/member` | Member login | Dashboard — my invites, stats |
| `/member/visitors` | Member login | My visitor pipeline |
| `/admin` | Admin | Full chapter management |
| `/admin/members` | Admin | Manage member accounts |
| `/admin/visitors` | Admin | All visitors, status, pipeline |
| `/admin/campaigns` | Admin | Send SMS/email campaigns |
| `/admin/analytics` | Admin | Growth metrics |

---

## SMS Templates

**After visit (Day 1):**
> "Hey [Name]! Great meeting you at Think Big St. Louis today. [Member] thinks you'd be a great fit. Learn more: [link]"

**Follow-up (Day 7):**
> "Hi [Name], it's [Member] from Think Big BNI. Still thinking about joining? Our next meeting is Thursday at 11:30. Reply YES to RSVP!"

**Application reminder:**
> "Hi [Name], just a reminder your BNI application link: [url]. Spots are limited — [Member] saved one for you!"

---

## Email Templates

**Welcome:**
- Subject: "Welcome to Think Big St. Louis!"
- Personalized from inviting member
- Chapter info, meeting details, next steps

**Monthly newsletter:**
- Upcoming events, member spotlight, open categories

---

## Member Roles

| Role | Access |
|------|--------|
| `admin` | Full access — all members, visitors, campaigns |
| `member` | Own dashboard, own visitors, invite system |

---

## Phase 1 — MVP (Build First)
1. Member auth (Firebase Auth — each member gets login)
2. Visitor registration via invite link
3. Member dashboard — see their visitors + status
4. Admin — view all visitors, update status
5. Manual SMS send from admin

## Phase 2 — Automation
1. Automated SMS follow-up sequences
2. Email drip campaigns (Resend)
3. Analytics dashboard
4. Member-to-member referral tracking

## Phase 3 — Growth Features
1. Open category display (what professions are open)
2. Public chapter page with apply button
3. Member testimonials/profiles
4. Integration with BNI Connect

---

## Next Steps
1. Review this spec — add/remove features
2. Set up Firebase Auth for member logins
3. Create `/invite/[code]` landing page
4. Build visitor registration form
5. Build member dashboard
6. Admin visitors management

---

## Notes
- This is a SEPARATE app from BNI-Feud (the game)
- Could live at: `growth.webtek.ai` or `thinkbig.webtek.ai`
- Or extend the existing BNI-Feud app with new routes
- Twilio number +16366892103 can be reused for SMS
