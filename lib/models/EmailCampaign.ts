import mongoose, { Schema, Document, Model } from 'mongoose'

export interface EmailSequenceStep {
  step: number          // 1, 2, 3
  subject: string
  body: string          // plain text with [name], [company] placeholders
  delay_days: number    // days after previous email (0 for first)
  cta_text?: string
  cta_url?: string
}

export interface IEmailCampaign extends Document {
  name: string
  description: string
  invite_code: string               // member invite code for CTA link attribution
  sequence: EmailSequenceStep[]
  batch_size: number                // emails per cron run (default 10)
  active: boolean
  total_prospects: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_unsubscribed: number
  created_at: Date
}

const EmailSequenceStepSchema = new Schema<EmailSequenceStep>(
  {
    step: { type: Number, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    delay_days: { type: Number, default: 0 },
    cta_text: { type: String },
    cta_url: { type: String },
  },
  { _id: false }
)

const EmailCampaignSchema = new Schema<IEmailCampaign>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    invite_code: { type: String, default: 'patrick' },
    sequence: { type: [EmailSequenceStepSchema], required: true },
    batch_size: { type: Number, default: 10 },
    active: { type: Boolean, default: true },
    total_prospects: { type: Number, default: 0 },
    total_sent: { type: Number, default: 0 },
    total_opened: { type: Number, default: 0 },
    total_clicked: { type: Number, default: 0 },
    total_unsubscribed: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const EmailCampaign: Model<IEmailCampaign> =
  mongoose.models.EmailCampaign ?? mongoose.model<IEmailCampaign>('EmailCampaign', EmailCampaignSchema)

export default EmailCampaign
