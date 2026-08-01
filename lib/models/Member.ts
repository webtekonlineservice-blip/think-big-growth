import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMember extends Document {
  name: string
  email: string
  password_hash: string
  role: string
  company: string
  phone: string
  invite_code: string
  display_order: number
  is_admin: boolean
  created_at: Date
}

const MemberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: '' },          // BNI role, e.g. "Realtor"
    company: { type: String, default: '' },
    phone: { type: String, default: '' },
    invite_code: { type: String, required: true, unique: true },
    display_order: { type: Number, default: 0 },
    is_admin: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const Member: Model<IMember> =
  mongoose.models.Member ?? mongoose.model<IMember>('Member', MemberSchema)

export default Member
