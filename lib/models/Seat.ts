import mongoose, { Schema, Document, Model, Types } from 'mongoose'

/**
 * A BNI chapter seat — one per profession category.
 *
 * status is intentionally NOT stored here for "filled" — that is always
 * derived live from Member.role so it stays in sync automatically.
 * We only persist whether outreach is enabled (active) or not (open/paused).
 */
export type SeatOutreachStatus = 'open' | 'active' | 'paused'

export interface ISeat extends Document {
  profession: string                    // e.g. "Chiropractor" — matches ALL_CATEGORIES exactly
  outreach_status: SeatOutreachStatus   // open=never run, active=running, paused=was running
  campaign_id: Types.ObjectId | null    // linked EmailCampaign (null until first activation)
  search_query: string                  // Google Maps query e.g. "Chiropractor in Kirkwood MO"
  location: string                      // e.g. "Kirkwood MO" — used to build search_query
  last_scraped: Date | null
  prospects_count: number               // cached count of real-email prospects
  created_at: Date
  updated_at: Date
}

const SeatSchema = new Schema<ISeat>(
  {
    profession: { type: String, required: true, unique: true, trim: true },
    outreach_status: {
      type: String,
      enum: ['open', 'active', 'paused'],
      default: 'open',
    },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', default: null },
    search_query: { type: String, default: '' },
    location: { type: String, default: 'Kirkwood MO' },
    last_scraped: { type: Date, default: null },
    prospects_count: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

SeatSchema.index({ outreach_status: 1 })

const Seat: Model<ISeat> =
  mongoose.models.Seat ?? mongoose.model<ISeat>('Seat', SeatSchema)

export default Seat
