import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export interface ISpeakerRotation extends Document {
  date: string          // YYYY-MM-DD (the meeting date)
  member_id: Types.ObjectId | null  // ref: 'Member' (null for free-text / guest)
  name: string          // speaker display name ('Speaker Name' placeholder when unset)
  created_at: Date
}

const SpeakerRotationSchema = new Schema<ISpeakerRotation>(
  {
    date: { type: String, required: true, unique: true },
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    name: { type: String, default: 'Speaker Name', trim: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const SpeakerRotation: Model<ISpeakerRotation> =
  mongoose.models.SpeakerRotation ?? mongoose.model<ISpeakerRotation>('SpeakerRotation', SpeakerRotationSchema)

export default SpeakerRotation
