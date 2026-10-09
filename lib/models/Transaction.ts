import mongoose, { Schema, Document, Model } from 'mongoose'

export type TransactionType = 'income' | 'expense'

export interface ITransaction extends Document {
  type: TransactionType
  category: string
  description: string
  amount: number
  date: string          // YYYY-MM-DD
  notes: string
  seed_key?: string     // idempotency key for seed imports
  created_at: Date
}

export const INCOME_CATEGORIES = [
  'Member Payment', 'Guest Fee', 'Event Income', 'Dues', '50/50 Collected', 'Other Income',
]
export const EXPENSE_CATEGORIES = [
  'Weekly Lunch', '50/50 Payout', 'Room Rental', 'Supplies', 'Marketing', 'Event Expense', 'Other Expense',
]

const TransactionSchema = new Schema<ITransaction>(
  {
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    notes: { type: String, default: '' },
    seed_key: { type: String, unique: true, sparse: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', TransactionSchema)

export default Transaction
