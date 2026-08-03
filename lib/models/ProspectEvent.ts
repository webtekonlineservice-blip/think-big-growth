import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export type EventType = 'sent' | 'open' | 'click' | 'unsubscribe'

export interface IProspectEvent extends Document {
  prospect_id: Types.ObjectId
  campaign_id: Types.ObjectId
  type: EventType
  step: number                    // which sequence step
  url?: string                    // for click events
  ip?: string
  user_agent?: string
  created_at: Date
}

const ProspectEventSchema = new Schema<IProspectEvent>(
  {
    prospect_id: { type: Schema.Types.ObjectId, ref: 'Prospect', required: true },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', required: true },
    type: { type: String, enum: ['sent', 'open', 'click', 'unsubscribe'], required: true },
    step: { type: Number, required: true },
    url: { type: String },
    ip: { type: String },
    user_agent: { type: String },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

ProspectEventSchema.index({ prospect_id: 1, type: 1 })
ProspectEventSchema.index({ campaign_id: 1, type: 1 })

const ProspectEvent: Model<IProspectEvent> =
  mongoose.models.ProspectEvent ?? mongoose.model<IProspectEvent>('ProspectEvent', ProspectEventSchema)

export default ProspectEvent
