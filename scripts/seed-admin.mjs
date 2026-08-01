/**
 * Seed script — creates the first admin member account.
 * Run once: node scripts/seed-admin.mjs
 */

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) return
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (key) process.env[key] = val
})

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local')
  process.exit(1)
}

// ── Member schema (inline so script is self-contained) ──────────────────────
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

// ── Admin account details — change these before running ─────────────────────
const ADMIN = {
  name: 'Gilbert Godfry',
  email: 'admin@thinkbig.webtek.ai',
  password: 'ThinkBig2024!',       // change after first login
  role: 'President',
  company: 'Think Big St. Louis',
  phone: '',
  invite_code: 'gilbert',
  display_order: 0,
  is_admin: true,
}
// ────────────────────────────────────────────────────────────────────────────

await mongoose.connect(MONGODB_URI)
console.log('Connected to MongoDB')

const existing = await Member.findOne({ email: ADMIN.email })
if (existing) {
  console.log(`Admin account already exists for ${ADMIN.email} — skipping.`)
  await mongoose.disconnect()
  process.exit(0)
}

const password_hash = await bcrypt.hash(ADMIN.password, 12)

await Member.create({ ...ADMIN, password_hash })

console.log('✓ Admin member created:')
console.log(`  Email:    ${ADMIN.email}`)
console.log(`  Password: ${ADMIN.password}`)
console.log(`  Invite:   /invite/${ADMIN.invite_code}`)
console.log('')
console.log('Change the password after your first login.')

await mongoose.disconnect()
process.exit(0)
