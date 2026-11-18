import mongoose, { Schema, Document, Model } from 'mongoose'

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram'
export type SocialType =
  | 'meeting_promo' | 'speaker' | 'spotlight' | 'visitor_invite' | 'win' | 'open_seats' | 'custom'
  | 'meeting_day' | 'recap' | 'evergreen' | 'photo' | 'welcome'
export type SocialStatus = 'idea' | 'drafted' | 'scheduled' | 'posted'

export const SOCIAL_TYPES: SocialType[] = [
  'meeting_promo', 'speaker', 'spotlight', 'visitor_invite', 'win', 'open_seats', 'custom',
  'meeting_day', 'recap', 'evergreen', 'photo', 'welcome',
]
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram']
export const SOCIAL_STATUSES: SocialStatus[] = ['idea', 'drafted', 'scheduled', 'posted']

/** What is needed to re-render a post's image. Photos are referenced, never embedded. */
export interface SocialGraphicSpec {
  kind: string
  title: string
  subtitle?: string
  lines?: string[]
  caption?: string       // short line printed on the image
  footerCta?: string
  dateLabel?: string
  wrapper?: string       // photo template style: overlay | frame | banner
}

export interface ISocialPost extends Document {
  date: string                       // YYYY-MM-DD planned/post date
  platform: SocialPlatform
  type: SocialType
  content: string                    // full caption text
  status: SocialStatus
  member_id: string                  // featured member ('' if none)
  photo_id: string                   // SocialPhoto id ('' if none)
  graphic: SocialGraphicSpec | null
  format: 'square' | 'portrait' | 'landscape'
  week_of: string                    // the Thursday this plan post belongs to
  source: 'plan' | 'manual'
  created_at: Date
}

const SocialPostSchema = new Schema<ISocialPost>(
  {
    date: { type: String, required: true },
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    type: { type: String, enum: SOCIAL_TYPES, default: 'custom' },
    content: { type: String, default: '' },
    status: { type: String, enum: SOCIAL_STATUSES, default: 'drafted' },
    member_id: { type: String, default: '' },
    photo_id: { type: String, default: '' },
    graphic: { type: Schema.Types.Mixed, default: null },
    format: { type: String, enum: ['square', 'portrait', 'landscape'], default: 'square' },
    week_of: { type: String, default: '' },
    source: { type: String, enum: ['plan', 'manual'], default: 'manual' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

SocialPostSchema.index({ date: -1 })
SocialPostSchema.index({ week_of: 1, type: 1 })

const SocialPost: Model<ISocialPost> =
  mongoose.models.SocialPost ?? mongoose.model<ISocialPost>('SocialPost', SocialPostSchema)

export default SocialPost
