import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Simple key/value store for chapter-level treasurer settings.
 * Currently used for the editable "Starting Balance" shown on slide 94.
 */
export interface IChapterSetting extends Document {
  key: string
  value: number
  // Flexible JSON value for non-numeric settings (e.g. list of pending member ids)
  data?: unknown
  updated_at: Date
}

const ChapterSettingSchema = new Schema<IChapterSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
    data: { type: Schema.Types.Mixed, default: null },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const ChapterSetting: Model<IChapterSetting> =
  mongoose.models.ChapterSetting ?? mongoose.model<IChapterSetting>('ChapterSetting', ChapterSettingSchema)

export const STARTING_BALANCE_KEY = 'starting_balance'
export const STARTING_BALANCE_DEFAULT = 3201.49
export const PENDING_MEMBERS_KEY = 'pending_members'

export default ChapterSetting
