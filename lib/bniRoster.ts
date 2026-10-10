/**
 * BNI chapter roster scraper.
 *
 * The public chapter page renders its member table client-side via a POST to
 * /bnicms/v3/frontend/chapterdetail/display. We hit that endpoint directly and
 * parse the returned HTML fragment into structured member rows.
 *
 * Config comes from env (with sane defaults for "Think Big St. Louis"):
 *   BNI_BASE_URL      default https://bnimidamerica.com
 *   BNI_CHAPTER_ID    default viZZ9xMXzJhLipNl7y/swA==
 *   BNI_WEBSITE_TYPE  default 2
 *   BNI_WEBSITE_ID    default 2113
 */

export interface BniMember {
  name: string
  company: string
  /** Full BNI category path, e.g. "Construction > Roofing - Residential" */
  category: string
  /** Last segment of the category path — closest to a job title/role */
  profession: string
  phone: string
}

const BASE_URL = process.env.BNI_BASE_URL || 'https://bnimidamerica.com'
const CHAPTER_ID = process.env.BNI_CHAPTER_ID || 'viZZ9xMXzJhLipNl7y/swA=='
const WEBSITE_TYPE = process.env.BNI_WEBSITE_TYPE || '2'
const WEBSITE_ID = process.env.BNI_WEBSITE_ID || '2113'

/** Strip tags and collapse whitespace from an HTML cell. */
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Last segment of a "A > B > C" category path. */
function lastSegment(category: string): string {
  const parts = category.split('>').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : category
}

/**
 * Fetch the chapter member roster from BNI.
 * Throws if the endpoint is unreachable or returns no parseable rows.
 */
export async function fetchBniRoster(): Promise<BniMember[]> {
  const html = await fetchBniPageHtml()
  return parseBniRoster(html)
}

/**
 * Parse the HTML fragment into member rows.
 * Exported separately so it can be unit-tested against saved fixtures.
 */
export function parseBniRoster(html: string): BniMember[] {
  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((m) => m[1])
  const members: BniMember[] = []

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => cleanCell(m[1]))
    // Expect at least name, company, category, phone
    if (cells.length < 4) continue

    const [name, company, category, phone] = cells
    if (!name) continue
    // Skip any header/footer artifacts that slipped through
    if (/member name/i.test(name)) continue

    members.push({
      name,
      company,
      category,
      profession: lastSegment(category),
      phone,
    })
  }

  return members
}

/**
 * Parse leadership headshots from the chapter page.
 * Photos appear only in the "Chapter Leadership" cards, each as a
 * networkViewProfileImage URL followed by an <h4 title="Name">.
 * Returns a map of normalized-name → absolute image URL (default avatars skipped).
 */
export function parseBniPhotos(html: string): { name: string; url: string }[] {
  const pairs = Array.from(
    html.matchAll(/networkViewProfileImage\/([0-9a-f]+)\.jpg[\s\S]*?<h4[^>]*title="([^"]+)"/gi)
  )
  const out: { name: string; url: string }[] = []
  const seen = new Set<string>()
  for (const m of pairs) {
    const id = m[1]
    const name = m[2].replace(/\s+/g, ' ').trim()
    if (!id || !name || seen.has(name)) continue
    seen.add(name)
    out.push({ name, url: `https://bniconnectglobal.com/web/open/networkViewProfileImage/${id}.jpg` })
  }
  return out
}

/**
 * Fetch the chapter page HTML once (raw), for callers that want both the
 * roster and the leadership photos without a second request.
 */
export async function fetchBniPageHtml(): Promise<string> {
  const body = new URLSearchParams({
    pageMode: 'Live_Site',
    chapterId: CHAPTER_ID,
    languageLocaleCode: 'en_US',
    website_type: WEBSITE_TYPE,
    website_id: WEBSITE_ID,
    mappedWidgetSettings: '[]',
    planyourvisit: 'y',
  })
  const res = await fetch(`${BASE_URL}/bnicms/v3/frontend/chapterdetail/display`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${BASE_URL}/en-US/chapterdetail?chapterId=${encodeURIComponent(CHAPTER_ID)}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ThinkBigRosterSync/1.0)',
    },
    body: body.toString(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`BNI page returned ${res.status}`)
  return res.text()
}

/** Download an image URL (following redirects) and return a base64 data URI. */
export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1000) return null // skip tiny/placeholder responses
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
