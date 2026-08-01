import mongoose, { Schema, Document, Model, Types } from 'mongoose'

export interface IInvite extends Document {
  member_id: Types.ObjectId    // ref: 'Member'
  visitor_id: Types.ObjectId   // ref: 'Visitor'
  invite_code: string
  created_at: Date
}

const InviteSchema = new Schema<IInvite>(
  {
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    visitor_id: { type: Schema.Types.ObjectId, ref: 'Visitor', required: true },
    invite_code: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

const Invite: Model<IInvite> =
  mongoose.models.Invite ?? mongoose.model<IInvite>('Invite', InviteSchema)

export default Invite
