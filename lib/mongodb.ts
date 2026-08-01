import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local')
}

/**
 * Global cache prevents multiple Mongoose connections during hot-reload in dev.
 * In production each serverless function invocation reuses the cached promise.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
}

const cached = globalThis._mongooseCache ?? { conn: null, promise: null }
globalThis._mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
