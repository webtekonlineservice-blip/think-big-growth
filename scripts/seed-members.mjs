/**
 * Seed script — creates all 13 chapter members.
 * Edit the MEMBERS array below with real names, emails, roles, etc.
 * Run: node scripts/seed-members.mjs
 *
 * Safe to re-run — skips members whose email already exists.
 */

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) return
  process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
})

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const MemberSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password_hash: String,
  role: { type: String, default: '' },
  company: { type: String, default: '' },
  phone: { type: String, default: '' },
  invite_code: { type: String, unique: true },
  display_order: { type: Number, default: 0 },
  is_admin: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
})

const Member = mongoose.models.Member ?? mongoose.model('Member', MemberSchema)

// ─────────────────────────────────────────────────────────────────────────────
// EDIT THIS LIST — replace placeholder values with real member details.
//
// Fields:
//   name         Full name
//   email        Login email (must be unique)
//   password     Temporary password — member should change after first login
//   role         BNI business category / profession
//   company      Company or business name
//   phone        Mobile number for SMS notifications (optional)
//   invite_code  Short unique slug used in /invite/<code> links
//   display_order Controls sort order in admin list (0 = first)
//   is_admin     true = can access /admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PASSWORD = 'ThinkBig2024!'   // all members start with this

const MEMBERS = [
  {
    name: 'Member One',
    email: 'member1@example.com',
    role: 'Realtor',
    company: 'Acme Realty',
    phone: '',
    invite_code: 'member1',
    display_order: 1,
    is_admin: false,
  },
  {
    name: 'Member Two',
    email: 'member2@example.com',
    role: 'Financial Advisor',
    company: 'Wealth Partners',
    phone: '',
    invite_code: 'member2',
    display_order: 2,
    is_admin: false,
  },
  {
    name: 'Member Three',
    email: 'member3@example.com',
    role: 'Attorney',
    company: 'Smith Law Group',
    phone: '',
    invite_code: 'member3',
    display_order: 3,
    is_admin: false,
  },
  {
    name: 'Member Four',
    email: 'member4@example.com',
    role: 'Insurance Agent',
    company: 'Safe Harbor Insurance',
    phone: '',
    invite_code: 'member4',
    display_order: 4,
    is_admin: false,
  },
  {
    name: 'Member Five',
    email: 'member5@example.com',
    role: 'Mortgage Broker',
    company: 'First Rate Lending',
    phone: '',
    invite_code: 'member5',
    display_order: 5,
    is_admin: false,
  },
  {
    name: 'Member Six',
    email: 'member6@example.com',
    role: 'Accountant',
    company: 'Clear Books CPA',
    phone: '',
    invite_code: 'member6',
    display_order: 6,
    is_admin: false,
  },
  {
    name: 'Member Seven',
    email: 'member7@example.com',
    role: 'Marketing Consultant',
    company: 'Spark Marketing',
    phone: '',
    invite_code: 'member7',
    display_order: 7,
    is_admin: false,
  },
  {
    name: 'Member Eight',
    email: 'member8@example.com',
    role: 'IT Consultant',
    company: 'TechSolve STL',
    phone: '',
    invite_code: 'member8',
    display_order: 8,
    is_admin: false,
  },
  {
    name: 'Member Nine',
    email: 'member9@example.com',
    role: 'Contractor',
    company: 'Build Right Construction',
    phone: '',
    invite_code: 'member9',
    display_order: 9,
    is_admin: false,
  },
  {
    name: 'Member Ten',
    email: 'member10@example.com',
    role: 'Chiropractor',
    company: 'Align Health',
    phone: '',
    invite_code: 'member10',
    display_order: 10,
    is_admin: false,
  },
  {
    name: 'Member Eleven',
    email: 'member11@example.com',
    role: 'Photographer',
    company: 'Shutter & Light',
    phone: '',
    invite_code: 'member11',
    display_order: 11,
    is_admin: false,
  },
  {
    name: 'Member Twelve',
    email: 'member12@example.com',
    role: 'Web Designer',
    company: 'Pixel Studio STL',
    phone: '',
    invite_code: 'member12',
    display_order: 12,
    is_admin: false,
  },
  {
    name: 'Member Thirteen',
    email: 'member13@example.com',
    role: 'Landscaper',
    company: 'Green Thumb Outdoors',
    phone: '',
    invite_code: 'member13',
    display_order: 13,
    is_admin: false,
  },
]
// ─────────────────────────────────────────────────────────────────────────────

await mongoose.connect(MONGODB_URI)
console.log('Connected to MongoDB\n')

const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 12)
let created = 0
let skipped = 0

for (const m of MEMBERS) {
  const exists = await Member.findOne({ email: m.email })
  if (exists) {
    console.log(`  SKIP  ${m.name} (${m.email}) — already exists`)
    skipped++
    continue
  }

  // Also check invite_code uniqueness
  const codeExists = await Member.findOne({ invite_code: m.invite_code })
  if (codeExists) {
    console.log(`  SKIP  ${m.name} — invite_code "${m.invite_code}" already taken`)
    skipped++
    continue
  }

  await Member.create({ ...m, password_hash })
  console.log(`  ✓     ${m.name} (${m.email}) — invite: /invite/${m.invite_code}`)
  created++
}

console.log(`\nDone. ${created} created, ${skipped} skipped.`)
console.log(`Default password for all new members: ${DEFAULT_PASSWORD}`)

await mongoose.disconnect()
process.exit(0)
