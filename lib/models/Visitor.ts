import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type VisitorStatus = 'invited' | 'visited' | 'applied' | 'member'

export interface IVisitor extends Document {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  business_type: string
  referral_source: string
  invited_by: Types.ObjectId | null   // ref: 'Member'
  status: VisitorStatus
  visit_date: Date | null
  notes: string
  created_at: Date
}

const VisitorSchema = new Schema<IVisitor>(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    business_type: { type: String, required: true, trim: true },
    referral_source: { type: String, required: true, trim: true },
    invited_by: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    status: {
      type: String,
      enum: ['invited', 'visited', 'applied', 'member'],
      default: 'invited',
    },
    visit_date: { type: Date, default: null },
    notes: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const Visitor: Model<IVisitor> =
  mongoose.models.Visitor ?? mongoose.model<IVisitor>('Visitor', VisitorSchema)

export default Visitor
