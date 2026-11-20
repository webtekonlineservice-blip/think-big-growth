import { Schema } from 'mongoose'

export interface BusinessProfileSource {
  title: string
  url: string
}

export interface BusinessProfileData {
  website: string
  summary: string
  services: string
  sources: BusinessProfileSource[]
  researched_at: Date | null
}

const BusinessProfileSourceSchema = new Schema<BusinessProfileSource>(
  {
    title: { type: String, default: '' },
    url: { type: String, required: true },
  },
  { _id: false }
)

export const BusinessProfileSchema = new Schema<BusinessProfileData>(
  {
    website: { type: String, default: '' },
    summary: { type: String, default: '' },
    services: { type: String, default: '' },
    sources: { type: [BusinessProfileSourceSchema], default: [] },
    researched_at: { type: Date, default: null },
  },
  { _id: false }
)
