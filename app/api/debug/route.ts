import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

// Temporary debug route — remove after fixing the connection issue
export async function GET() {
  try {
    await connectDB()
    return NextResponse.json({ status: 'connected', uri_set: !!process.env.MONGODB_URI })
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      message: String(err),
      uri_set: !!process.env.MONGODB_URI,
      uri_preview: process.env.MONGODB_URI?.slice(0, 40) + '...',
    })
  }
}
