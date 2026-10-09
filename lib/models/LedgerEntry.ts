import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type LedgerType = 'opening' | 'charge' | 'payment'
export type LedgerStatus = 'unpaid' | 'paid' | 'waived'

export interface ILedgerEntry extends Document {
  member_id: Types.ObjectId | null  // ref: 'Member'
  member_name: string
  type: LedgerType
  description: string
  amount: number
  date: string          // YYYY-MM-DD
  status: LedgerStatus
  notes: string
  item?: string         // reference-only dish name for lunch charges (payment cross-ref)
  seed_key?: string     // idempotency key for seed imports
  created_at: Date
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    member_name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['opening', 'charge', 'payment'], required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['unpaid', 'paid', 'waived'], default: 'unpaid' },
    notes: { type: String, default: '' },
    item: { type: String, default: '' },
    seed_key: { type: String, unique: true, sparse: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ?? mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema)

export default LedgerEntry
