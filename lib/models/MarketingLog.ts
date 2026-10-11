import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type MarketingChannel = 'sms' | 'whatsapp' | 'email'
export type MarketingType =
  | 'member_invoice'
  | 'meeting_reminder'
  | 'chapter_announcement'
  | 'visitor_followup'
  | 'test'

export interface IMarketingLog extends Document {
  /** Member, visitor, or prospect id — optional for broadcast sends */
  recipient_id?: Types.ObjectId
  recipient_name: string
  channel: MarketingChannel
  type: MarketingType
  to: string              // phone number or email address
  subject?: string        // email only
  body: string            // the message/email body sent
  test: boolean           // true = sent to test address, not the real recipient
  status: 'sent' | 'failed'
  error?: string
  sent_at: Date
}

const MarketingLogSchema = new Schema<IMarketingLog>(
  {
    recipient_id: { type: Schema.Types.ObjectId, default: null },
    recipient_name: { type: String, required: true },
    channel: { type: String, enum: ['sms', 'whatsapp', 'email'], required: true },
    type: {
      type: String,
      enum: ['member_invoice', 'meeting_reminder', 'chapter_announcement', 'visitor_followup', 'test'],
      required: true,
    },
    to: { type: String, required: true },
    subject: { type: String },
    body: { type: String, required: true },
    test: { type: Boolean, default: false },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String },
    sent_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

MarketingLogSchema.index({ sent_at: -1 })
MarketingLogSchema.index({ type: 1, channel: 1 })

const MarketingLog: Model<IMarketingLog> =
  mongoose.models.MarketingLog ??
  mongoose.model<IMarketingLog>('MarketingLog', MarketingLogSchema)

export default MarketingLog
