import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * One record per scraping run — tracks when each seat was scraped,
 * what was searched, and the results. Used by the Seats page widget.
 */
export interface IScrapingLog extends Document {
  profession: string       // e.g. "Chiropractor"
  search_query: string     // e.g. "Chiropractor in Kirkwood MO"
  location: string         // e.g. "Kirkwood MO"
  found: number            // total business results returned
  imported: number         // new prospects added to DB
  skipped: number          // duplicates / no-email skipped
  enriched: number         // emails found via enrichment
  source: 'leadgen_script' | 'api_trigger' | 'manual' | 'cron'
  triggered_by?: string    // admin name or 'cron'
  ran_at: Date
}

const ScrapingLogSchema = new Schema<IScrapingLog>(
  {
    profession:   { type: String, required: true },
    search_query: { type: String, default: '' },
    location:     { type: String, default: 'Kirkwood MO' },
    found:        { type: Number, default: 0 },
    imported:     { type: Number, default: 0 },
    skipped:      { type: Number, default: 0 },
    enriched:     { type: Number, default: 0 },
    source:       { type: String, enum: ['leadgen_script', 'api_trigger', 'manual', 'cron'], default: 'manual' },
    triggered_by: { type: String, default: '' },
    ran_at:       { type: Date, default: Date.now },
  },
  { timestamps: false }
)

ScrapingLogSchema.index({ ran_at: -1 })
ScrapingLogSchema.index({ profession: 1, ran_at: -1 })

const ScrapingLog: Model<IScrapingLog> =
  mongoose.models.ScrapingLog ?? mongoose.model<IScrapingLog>('ScrapingLog', ScrapingLogSchema)

export default ScrapingLog
