import mongoose, { Schema, Document, Model, Types } from 'mongoose'

/**
 * Tracks every automated message sent to a visitor.
 * Used to prevent duplicate sends across cron runs.
 *
 * step values:
 *   'welcome_sms'      — sent immediately on registration
 *   'welcome_email'    — sent immediately on registration
 *   'day1_sms'         — sent 1 day after visit_date set
 *   'day7_sms'         — sent 7 days after visit_date set
 *   'day14_email'      — sent 14 days after visit_date set
 */
export type OutreachStep =
  | 'welcome_sms'
  | 'welcome_email'
  | 'day1_sms'
  | 'day7_sms'
  | 'day14_email'

export interface IOutreachLog extends Document {
  visitor_id: Types.ObjectId
  step: OutreachStep
  channel: 'sms' | 'email'
  to: string          // phone or email address
  status: 'sent' | 'failed'
  error?: string
  sent_at: Date
}

const OutreachLogSchema = new Schema<IOutreachLog>(
  {
    visitor_id: { type: Schema.Types.ObjectId, ref: 'Visitor', required: true },
    step: {
      type: String,
      enum: ['welcome_sms', 'welcome_email', 'day1_sms', 'day7_sms', 'day14_email'],
      required: true,
    },
    channel: { type: String, enum: ['sms', 'email'], required: true },
    to: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String },
    sent_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

// Compound index — fast lookup to check if a step was already sent
OutreachLogSchema.index({ visitor_id: 1, step: 1 }, { unique: true })

const OutreachLog: Model<IOutreachLog> =
  mongoose.models.OutreachLog ??
  mongoose.model<IOutreachLog>('OutreachLog', OutreachLogSchema)

export default OutreachLog
