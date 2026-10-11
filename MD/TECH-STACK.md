# Think Big St. Louis — Technical Reference

A portable reference for replicating or adapting this project's architecture.

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14 (App Router) | Full-stack React with SSR + API routes |
| Hosting | Vercel | Auto-deploy from GitHub, serverless functions |
| Database | MongoDB Atlas + Mongoose | Cloud-hosted NoSQL, Mongoose ODM |
| Auth | JWT (HttpOnly cookie) | Session-based auth, bcrypt password hashing |
| SMS | Twilio | Outbound text messaging |
| Styling | Tailwind CSS | Utility-first, custom theme colors |

---

## Architecture Pattern

```
Browser (Next.js client)
  ├── fetch('/api/auth/me') → check session on page load
  ├── fetch('/api/auth/login') → POST credentials → receives JWT cookie
  └── fetch('/api/...') → API routes (cookie sent automatically)

Next.js API Routes (serverless)
  ├── lib/auth.ts → getSession(req) reads JWT from HttpOnly cookie
  ├── lib/mongodb.ts → Mongoose connection (cached for serverless)
  ├── lib/models/ → Member, Visitor, Invite Mongoose schemas
  └── lib/twilio.ts → Twilio SDK for SMS

Vercel
  ├── Builds from GitHub on push to main
  ├── Serves SSR + static pages
  └── Runs API routes as serverless functions
```

---

## Key Patterns

### MongoDB Connection (Serverless-safe)
```typescript
// lib/mongodb.ts
import mongoose from 'mongoose'

declare global {
  var _mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
}

const cached = globalThis._mongooseCache ?? { conn: null, promise: null }
globalThis._mongooseCache = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI!, { bufferCommands: false })
  }
  cached.conn = await cached.promise
  return cached.conn
}
```

### JWT Session Auth
```typescript
// lib/auth.ts
import jwt from 'jsonwebtoken'

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export function getSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get('tbg_session')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as SessionPayload
  } catch {
    return null
  }
}
```

### Protecting an API Route
```typescript
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  await connectDB()
  const data = await SomeModel.find().lean()
  return NextResponse.json(data)
}
```

### Login Flow (Client)
```typescript
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
// Cookie is set automatically by the server response
if (res.ok) router.push('/member')
```

### Check Session on Page Load
```typescript
useEffect(() => {
  fetch('/api/auth/me')
    .then(async (res) => {
      if (!res.ok) { router.push('/member/login'); return }
      const { user } = await res.json()
      setUser(user)
    })
    .catch(() => router.push('/member/login'))
    .finally(() => setLoading(false))
}, [router])
```

### Logout
```typescript
await fetch('/api/auth/logout', { method: 'POST' })
router.push('/')
```

### Sending SMS (Twilio)
```typescript
import { sendSms } from '@/lib/twilio'
await sendSms('+13145551234', 'Your message here')
```

### Mongoose Model Pattern
```typescript
// lib/models/Member.ts
import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMember extends Document { ... }

const MemberSchema = new Schema<IMember>({ ... })

const Member: Model<IMember> =
  mongoose.models.Member ?? mongoose.model<IMember>('Member', MemberSchema)

export default Member
```

---

## Environment Variables

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/think-big-growth?retryWrites=true&w=majority&appName=Cluster0

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1...

# App
NEXT_PUBLIC_APP_URL=https://thinkbig.webtek.ai
```

---

## Project Structure

```
app/
├── page.tsx                        # Home / landing
├── join/page.tsx                   # Visitor registration form
├── invite/[code]/page.tsx          # Member invite landing page
├── member/
│   ├── page.tsx                    # Member dashboard (auth protected)
│   └── login/page.tsx              # Login page
├── admin/page.tsx                  # Admin dashboard (admin only)
└── api/
    ├── auth/
    │   ├── login/route.ts          # POST — email/password → JWT cookie
    │   ├── logout/route.ts         # POST — clears cookie
    │   └── me/route.ts             # GET — returns current session
    ├── visitors/
    │   ├── route.ts                # GET all visitors (admin)
    │   └── [id]/route.ts           # PATCH visitor status/notes
    ├── members/
    │   ├── route.ts                # GET all members (admin) or self (?uid=)
    │   └── visitors/route.ts       # GET visitors by member (?uid=)
    ├── join/route.ts               # POST visitor registration + SMS
    └── invite/[code]/route.ts      # GET member info by invite code
lib/
├── mongodb.ts                      # Mongoose connection helper
├── auth.ts                         # JWT sign/verify/getSession
├── twilio.ts                       # Twilio SMS helper
└── models/
    ├── Member.ts                   # Member schema
    ├── Visitor.ts                  # Visitor schema
    └── Invite.ts                   # Invite record schema
scripts/
└── seed-admin.mjs                  # Create first admin account
```

---

## Deployment

### Vercel
1. Connect GitHub repo to Vercel
2. Add all env vars in **Project Settings → Environment Variables**
3. Push to `main` → auto-builds and deploys

### MongoDB Atlas Setup
1. Create free cluster at mongodb.com/atlas
2. Create a database user (**Database Access**)
3. Allow network access (**Network Access → 0.0.0.0/0** for Vercel)
4. Copy the `mongodb+srv://` connection string
5. Add `/think-big-growth` as the database name in the URI

### First Admin Account
```bash
node scripts/seed-admin.mjs
```

### Twilio Setup
1. Get a phone number in Twilio Console
2. Set `TWILIO_PHONE_NUMBER` in env vars

---

## Data Models

### Member
```
_id, name, email, password_hash, role, company, phone,
invite_code (unique), display_order, is_admin, created_at
```

### Visitor
```
_id, first_name, last_name, email, phone, company,
business_type, referral_source, invited_by (ref: Member),
status (invited|visited|applied|member), visit_date, notes, created_at
```

### Invite
```
_id, member_id (ref: Member), visitor_id (ref: Visitor),
invite_code, created_at
```
