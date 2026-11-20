import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import Visitor from '@/lib/models/Visitor'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function validWebsite(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return value === ''
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname
  } catch {
    return false
  }
}

/** PUT /api/marketing/business-profile — save an admin-approved profile to a member or visitor. */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    if ((body.subject_type !== 'member' && body.subject_type !== 'visitor') ||
        typeof body.subject_id !== 'string' || !mongoose.isValidObjectId(body.subject_id)) {
      return NextResponse.json({ error: 'A valid member or visitor is required.' }, { status: 400 })
    }

    const profile = body.profile
    if (!profile || typeof profile !== 'object' ||
        typeof profile.summary !== 'string' || !profile.summary.trim() ||
        typeof profile.services !== 'string' || typeof profile.website !== 'string' ||
        !profile.website.trim() || !validWebsite(profile.website)) {
      return NextResponse.json({ error: 'A valid business summary, services, and website are required.' }, { status: 400 })
    }
    if (profile.summary.length > 2000 || profile.services.length > 2000) {
      return NextResponse.json({ error: 'Business profile text is too long.' }, { status: 400 })
    }

    const sources = Array.isArray(profile.sources) ? profile.sources.slice(0, 5) : []
    if (sources.some((source: unknown) =>
      !source || typeof source !== 'object' ||
      typeof (source as Record<string, unknown>).title !== 'string' ||
      typeof (source as Record<string, unknown>).url !== 'string' ||
      !validWebsite((source as Record<string, unknown>).url))) {
      return NextResponse.json({ error: 'Every research source must have a title and valid URL.' }, { status: 400 })
    }
    const researchedAt = profile.researched_at ? new Date(profile.researched_at) : null
    if (researchedAt && Number.isNaN(researchedAt.getTime())) {
      return NextResponse.json({ error: 'Research date is invalid.' }, { status: 400 })
    }

    const businessProfile = {
      website: profile.website.trim(),
      summary: profile.summary.trim(),
      services: profile.services.trim(),
      sources: sources.map((source: { title: string; url: string }) => ({
        title: source.title.slice(0, 120),
        url: source.url,
      })),
      researched_at: researchedAt,
    }

    await connectDB()
    const updated = body.subject_type === 'member'
      ? await Member.findByIdAndUpdate(
        body.subject_id,
        { $set: { business_profile: businessProfile } },
        { new: true, runValidators: true }
      ).select('_id business_profile').lean()
      : await Visitor.findByIdAndUpdate(
        body.subject_id,
        { $set: { business_profile: businessProfile } },
        { new: true, runValidators: true }
      ).select('_id business_profile').lean()
    if (!updated) return NextResponse.json({ error: 'Member or visitor record not found.' }, { status: 404 })

    return NextResponse.json({ ok: true, business_profile: updated.business_profile })
  } catch (err) {
    console.error('PUT /api/marketing/business-profile error:', err)
    return NextResponse.json({ error: 'Could not save the business profile.' }, { status: 500 })
  }
}
