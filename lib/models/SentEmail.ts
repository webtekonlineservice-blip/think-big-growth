import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Logs every broadcast/announcement email sent to members or groups.
 * Separate from OutreachLog (which is visitor drip automation).
 * Powers the Send Log UI.
 */
export interface ISentEmail extends Document {
  type: string          // 'announcement' | 'broadcast' | 'test'
  subject: string
  to: string            // recipient email
  recipient_name: string
  status: 'sent' | 'failed'
  error?: string
  resend_id?: string
  batch_id?: string     // groups a "send to all" batch together
  sent_at: Date
}

const SentEmailSchema = new Schema<ISentEmail>(
  {
    type: { type: String, default: 'announcement' },
    subject: { type: String, required: true },
    to: { type: String, required: true },
    recipient_name: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String },
    resend_id: { type: String },
    batch_id: { type: String },
    sent_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

SentEmailSchema.index({ sent_at: -1 })

const SentEmail: Model<ISentEmail> =
  mongoose.models.SentEmail ?? mongoose.model<ISentEmail>('SentEmail', SentEmailSchema)

export default SentEmail
