import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * A photo taken in-app (or uploaded) for use in social graphics.
 * `data` is a compressed JPEG data URI (max ~1600px). `thumb` is a ~320px
 * preview so the library list stays light — list endpoints never return `data`.
 */
export interface ISocialPhoto extends Document {
  data: string
  thumb: string
  label: string
  member_id: string     // optional: the member shown in the photo
  created_at: Date
}

const SocialPhotoSchema = new Schema<ISocialPhoto>(
  {
    data: { type: String, required: true },
    thumb: { type: String, required: true },
    label: { type: String, default: '' },
    member_id: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

SocialPhotoSchema.index({ created_at: -1 })

const SocialPhoto: Model<ISocialPhoto> =
  mongoose.models.SocialPhoto ?? mongoose.model<ISocialPhoto>('SocialPhoto', SocialPhotoSchema)

export default SocialPhoto
