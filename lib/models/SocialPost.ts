import mongoose, { Schema, Document, Model } from 'mongoose'

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram'
export type SocialType = 'meeting_promo' | 'speaker' | 'spotlight' | 'visitor_invite' | 'win' | 'open_seats' | 'custom'
export type SocialStatus = 'idea' | 'drafted' | 'scheduled' | 'posted'

export interface ISocialPost extends Document {
  date: string            // YYYY-MM-DD — the planned/post date
  platform: SocialPlatform
  type: SocialType
  content: string         // the caption text
  status: SocialStatus
  created_at: Date
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram']
export const SOCIAL_STATUSES: SocialStatus[] = ['idea', 'drafted', 'scheduled', 'posted']

const SocialPostSchema = new Schema<ISocialPost>(
  {
    date: { type: String, required: true },
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    type: {
      type: String,
      enum: ['meeting_promo', 'speaker', 'spotlight', 'visitor_invite', 'win', 'open_seats', 'custom'],
      default: 'custom',
    },
    content: { type: String, default: '' },
    status: { type: String, enum: SOCIAL_STATUSES, default: 'drafted' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const SocialPost: Model<ISocialPost> =
  mongoose.models.SocialPost ?? mongoose.model<ISocialPost>('SocialPost', SocialPostSchema)

export default SocialPost
