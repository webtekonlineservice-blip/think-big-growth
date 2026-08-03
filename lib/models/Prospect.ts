import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type ProspectStatus = 'new' | 'sequence_1' | 'sequence_2' | 'sequence_3' | 'converted' | 'unsubscribed'

export interface IProspect extends Document {
  name: string
  email: string
  company: string
  profession: string
  phone: string
  website: string
  source: string                    // e.g. 'google_maps', 'yelp', 'csv_import'
  campaign_id: Types.ObjectId | null
  status: ProspectStatus
  unsubscribed: boolean
  unsubscribe_token: string
  sequence_step: number             // 0 = not started, 1/2/3 = which email was last sent
  last_sent_at: Date | null
  opened_count: number
  clicked_count: number
  created_at: Date
}

const ProspectSchema = new Schema<IProspect>(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
    company: { type: String, default: '' },
    profession: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    source: { type: String, default: 'csv_import' },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', default: null },
    status: {
      type: String,
      enum: ['new', 'sequence_1', 'sequence_2', 'sequence_3', 'converted', 'unsubscribed'],
      default: 'new',
    },
    unsubscribed: { type: Boolean, default: false },
    unsubscribe_token: { type: String, required: true, unique: true },
    sequence_step: { type: Number, default: 0 },
    last_sent_at: { type: Date, default: null },
    opened_count: { type: Number, default: 0 },
    clicked_count: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

// Prevent duplicate emails within a campaign
ProspectSchema.index({ email: 1, campaign_id: 1 }, { unique: true })
ProspectSchema.index({ campaign_id: 1, status: 1, sequence_step: 1 })

const Prospect: Model<IProspect> =
  mongoose.models.Prospect ?? mongoose.model<IProspect>('Prospect', ProspectSchema)

export default Prospect
