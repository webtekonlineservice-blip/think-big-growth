/**
 * Chamber of Commerce directory scraper — St. Louis metro area.
 *
 * All chambers here use the ChamberMaster SaaS platform, which means they
 * share an identical URL pattern and HTML structure. One parser handles all.
 *
 * Pattern: https://{slug}.chambermaster.com/list/searchalpha/{a-z}
 * OR the chamber's own domain when it has a custom host:
 *   https://business.kirkwooddesperes.com/list/searchalpha/{a-z}
 *   https://www.chesterfieldmochamber.com/list/searchalpha/{a-z}
 */

export interface Chamber {
  id: string
  name: string
  area: string          // e.g. "Kirkwood / Des Peres"
  baseUrl: string       // full https URL to the directory root
  alphaPath: string     // path template — {letter} is replaced
  estimatedMembers: number
  priority: 'high' | 'medium' | 'low'
  note?: string
}

export interface ScrapedMember {
  name: string
  phone: string
  website: string
  address: string
  city: string
  description: string
  chamberId: string
  chamberName: string
}

export const CHAMBERS: Chamber[] = [
  {
    id: 'kirkwood',
    name: 'Kirkwood-Des Peres Area Chamber',
    area: 'Kirkwood / Des Peres',
    baseUrl: 'https://business.kirkwooddesperes.com',
    alphaPath: '/list/searchalpha/{letter}',
    estimatedMembers: 400,
    priority: 'high',
    note: 'Home base — highest priority for BNI Think Big St. Louis',
  },
  {
    id: 'chesterfield',
    name: 'Chesterfield Regional Chamber',
    area: 'Chesterfield / West County',
    baseUrl: 'https://www.chesterfieldmochamber.com',
    alphaPath: '/list/searchalpha/{letter}',
    estimatedMembers: 500,
    priority: 'high',
    note: 'Large chamber, west St. Louis County',
  },
  {
    id: 'southwest',
    name: 'Southwest Area Chamber (Crestwood / Sunset Hills)',
    area: 'Crestwood / Sunset Hills',
    baseUrl: 'https://crestwoodsunset.chambermaster.com',
    alphaPath: '/list/searchalpha/{letter}',
    estimatedMembers: 250,
    priority: 'high',
    note: 'Overlaps with Kirkwood geographically',
  },
  {
    id: 'arnold',
    name: 'Arnold Chamber of Commerce',
    area: 'Arnold / Jefferson County',
    baseUrl: 'https://arnoldmo.chambermaster.com',
    alphaPath: '/list/searchalpha/{letter}',
    estimatedMembers: 300,
    priority: 'medium',
    note: 'South county — good small business density',
  },
  {
    id: 'westcounty',
    name: 'West St. Louis County Chamber',
    area: 'Ballwin / Wildwood / Manchester',
    baseUrl: 'https://cca.westcountychamber.com',
    alphaPath: '/WebForms/{Letter}_memberdirectory.aspx',  // different format
    estimatedMembers: 500,
    priority: 'high',
    note: 'Large west county chamber — custom URL format',
  },
  {
    id: 'hispanic',
    name: 'Hispanic Chamber of Commerce of Metro St. Louis',
    area: 'Metro St. Louis',
    baseUrl: 'https://hccstl.chambermaster.com',
    alphaPath: '/list/searchalpha/{letter}',
    estimatedMembers: 200,
    priority: 'medium',
  },
]

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const IGNORE_EMAILS = [
  'placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
  'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg',
  'godaddy', 'cloudflare', 'yext', 'noreply', 'no-reply',
  'donotreply', 'privacy', 'legal',
]

/** Fetch one alphabetical page and extract members from ChamberMaster HTML. */
async function scrapeAlphaPage(chamber: Chamber, letter: string): Promise<ScrapedMember[]> {
  const path = chamber.alphaPath
    .replace('{letter}', letter)
    .replace('{Letter}', letter.toUpperCase())
  const url = chamber.baseUrl + path

  try {
    const res = await fetch(url, {
      headers: SCRAPE_HEADERS,
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const html = await res.text()
    return parseChamberMasterHtml(html, chamber)
  } catch {
    return []
  }
}

/** Parse ChamberMaster HTML — extract name, phone, website, address per member. */
function parseChamberMasterHtml(html: string, chamber: Chamber): ScrapedMember[] {
  const members: ScrapedMember[] = []
  const seen = new Set<string>()

  // ChamberMaster renders each member as a repeating block.
  // We split on phone-number patterns as natural section boundaries.
  // Phone formats: (314) 555-0100  |  314-555-0100  |  3145550100
  const phoneRe = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g

  // Split the text content into sections around phone numbers
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Extract all text nodes with structure
  const textContent = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')

  const lines = textContent.split('\n').map((l) => l.trim()).filter(Boolean)

  // Extract websites from original HTML (before tag stripping)
  const websiteRe = /href="(https?:\/\/(?!(?:maps\.google|goo\.gl|google\.|googleapis\.|kirkwooddesperes\.com|chesterfieldmochamber\.com|westcountychamber\.com|chambermaster\.com|facebook\.com\/sharer|twitter\.com\/intent|linkedin\.com\/share))[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^"]*?)"/gi
  const allWebsites: string[] = []
  let wm
  while ((wm = websiteRe.exec(html)) !== null) {
    const w = wm[1].split('?')[0].split('#')[0] // strip query/anchor
    if (w && !allWebsites.includes(w)) allWebsites.push(w)
  }
  let websiteIdx = 0

  // Walk lines looking for business name → address → phone → website blocks
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip short/junk lines
    if (line.length < 4 || /^(results found|visit website|map|directions|print|contact|sort by|a-z|email|menu|home|about|events|join|login|search|button|dropdown|click|toggle)/i.test(line)) {
      i++; continue
    }

    // Look for a business name: not a phone, not an address, meaningful length
    const isPhone = /^\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/.test(line)
    const isAddress = /^\d+\s+[A-Z]/.test(line) || /\b(MO|IL|MO\s+\d{5})\b/.test(line)
    const isCity = /^(Kirkwood|Des Peres|Webster|Chesterfield|Ballwin|Wildwood|Manchester|Fenton|Arnold|Crestwood|Sunset Hills|St\. Louis|Saint Louis|Clayton|Ladue|Creve Coeur|Town & Country|Glendale)\b/i.test(line)

    if (!isPhone && !isAddress && !isCity && line.length >= 5 && line.length <= 120) {
      const nameKey = line.toLowerCase()
      if (seen.has(nameKey)) { i++; continue }

      // Collect the next ~8 lines as context for this member
      const ctx = lines.slice(i, i + 8).join('\n')

      // Extract phone from context
      const phoneMatch = ctx.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)
      const phone = phoneMatch ? phoneMatch[0] : ''

      // Extract city
      const cityMatch = ctx.match(/\b(Kirkwood|Des Peres|Webster Groves|Chesterfield|Ballwin|Wildwood|Manchester|Fenton|Arnold|Crestwood|Sunset Hills|St\.\s*Louis|Saint Louis|Clayton|Ladue|Creve Coeur|Glendale|Maplewood|Rock Hill|Shrewsbury)\b/i)
      const city = cityMatch ? cityMatch[1] : ''

      // Extract address (line starting with digits then street name)
      const addrMatch = ctx.match(/\d+[^,\n]{5,50}(?:Rd|St|Ave|Blvd|Dr|Ln|Way|Pkwy|Ct|Hwy|Road|Street|Avenue|Drive|Blvd\.?)[^,\n]*/i)
      const address = addrMatch ? addrMatch[0].trim() : ''

      // Get website — next available one that we haven't used yet
      const website = allWebsites[websiteIdx] || ''
      if (allWebsites[websiteIdx]) websiteIdx++

      // Skip obvious non-businesses
      if (/^(Results Found|Business Directory|Hot Deals|Member To Member|Marketspace|Sort by|Print|Contact these)/i.test(line)) {
        i++; continue
      }

      seen.add(nameKey)
      members.push({
        name: line,
        phone,
        website,
        address,
        city,
        description: '',
        chamberId: chamber.id,
        chamberName: chamber.name,
      })

      if (phone) i += 4 // jump past the context block
    }
    i++
  }

  return members
}

/** Find email from a website — tries contact/about pages, mailto links first. */
async function findEmail(website: string): Promise<string> {
  if (!website) return ''
  const base = website.startsWith('http') ? website : `https://${website}`

  for (const path of ['/contact', '/contact-us', '/about', '']) {
    const url = base.replace(/\/$/, '') + path
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThinkBigBot/1.0)' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 0 },
      })
      if (!res.ok) continue
      const text = await res.text()

      // mailto: links are most reliable
      const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi
      const mailto: string[] = []
      let mm: RegExpExecArray | null
      while ((mm = mailtoRe.exec(text)) !== null) {
        const e = mm[1].toLowerCase()
        if (!IGNORE_EMAILS.some((x) => e.includes(x))) mailto.push(e)
      }
      if (mailto.length) {
        const pref = mailto.find((e) => /^(contact|info|hello|office|admin|mail|reception)@/.test(e))
        return pref || mailto[0]
      }

      // general regex scan
      const emailRe = /[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi
      const emails: string[] = []
      let em: RegExpExecArray | null
      while ((em = emailRe.exec(text)) !== null) {
        const e = em[0].toLowerCase()
        if (!IGNORE_EMAILS.some((x) => e.includes(x)) && !emails.includes(e)) emails.push(e)
      }
      if (emails.length) {
        const pref = emails.find((e) => /^(contact|info|hello|office|admin|mail|reception)@/.test(e))
        return pref || emails[0]
      }
    } catch {
      // timeout or network error — continue to next path
    }
  }
  return ''
}

/** Scrape all A-Z pages for a chamber and return deduplicated members. */
export async function scrapeChamber(
  chamber: Chamber,
  options: { maxPages?: number; concurrency?: number } = {}
): Promise<ScrapedMember[]> {
  const { maxPages = 26, concurrency = 4 } = options
  const letters = 'abcdefghijklmnopqrstuvwxyz'.slice(0, maxPages).split('')
  const all: ScrapedMember[] = []
  const seen = new Set<string>()

  // Process in batches for concurrency control
  for (let i = 0; i < letters.length; i += concurrency) {
    const batch = letters.slice(i, i + concurrency)
    const results = await Promise.all(batch.map((l) => scrapeAlphaPage(chamber, l)))
    for (const page of results) {
      for (const m of page) {
        const key = m.name.toLowerCase().trim()
        if (!seen.has(key) && m.name.length > 2) {
          seen.add(key)
          all.push(m)
        }
      }
    }
    // Brief pause between batches
    if (i + concurrency < letters.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  return all
}

/** Enrich a batch of members with emails (with concurrency limit). */
export async function enrichEmails(
  members: ScrapedMember[],
  concurrency = 5
): Promise<(ScrapedMember & { email: string })[]> {
  const results: (ScrapedMember & { email: string })[] = []

  for (let i = 0; i < members.length; i += concurrency) {
    const batch = members.slice(i, i + concurrency)
    const emails = await Promise.all(batch.map((m) => findEmail(m.website)))
    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], email: emails[j] })
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  return results
}

/** AI-score members against open BNI seats using DeepSeek. */
export async function scoreMembers(
  members: ScrapedMember[],
  openSeats: string[]
): Promise<(ScrapedMember & { email: string; ai_score: number; ai_profession: string; ai_reason: string })[]> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    return (members as (ScrapedMember & { email: string })[]).map((m) => ({
      ...m,
      email: (m as unknown as { email: string }).email || '',
      ai_score: 5,
      ai_profession: '',
      ai_reason: 'No AI key',
    }))
  }

  const BATCH = 20
  const scored: (ScrapedMember & { email: string; ai_score: number; ai_profession: string; ai_reason: string })[] = []
  const openStr = openSeats.slice(0, 15).join(', ')

  for (let i = 0; i < members.length; i += BATCH) {
    const batch = members.slice(i, i + BATCH) as (ScrapedMember & { email: string })[]
    const lines = batch.map((b, idx) =>
      `${idx + 1}. ${b.name}${b.city ? ' (' + b.city + ')' : ''}${b.description ? ' — ' + b.description.slice(0, 60) : ''}`
    ).join('\n')

    const system = `You score local chamber of commerce members as BNI referral networking prospects for Think Big St. Louis BNI chapter in Kirkwood MO.

Score 1-10:
- 9-10: Solo/small local business, profession exactly matches open BNI seat, clearly owner-operated
- 7-8:  Local small business, good match, likely owner-operated  
- 5-6:  Could be a fit, less certain
- 3-4:  Unclear fit, may be chain or profession not ideal for BNI
- 1-2:  National chain, nonprofit, government, school, or clearly not BNI-appropriate

OPEN BNI SEATS TO FILL: ${openStr}

Key: BNI works best for solo/small businesses in professional services where the owner attends weekly.
AVOID scoring high: hospitals, schools, banks (branches), government, nonprofits, large chains.

Respond ONLY with valid JSON: {"results":[{"n":1,"score":8,"profession":"Dentist","reason":"Solo dental practice"}]}`

    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature: 0.2,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Score these ${batch.length} businesses:\n${lines}` },
          ],
        }),
      })
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      const parsed = JSON.parse(content)
      const items: { n: number; score: number; profession: string; reason: string }[] =
        parsed?.results ?? parsed?.scores ?? []

      for (let j = 0; j < batch.length; j++) {
        const item = items.find((x) => x.n === j + 1)
        scored.push({
          ...batch[j],
          ai_score: item ? Math.min(10, Math.max(1, item.score)) : 5,
          ai_profession: item?.profession ?? '',
          ai_reason: item?.reason ?? '',
        })
      }
    } catch {
      for (const m of batch) {
        scored.push({ ...m, ai_score: 5, ai_profession: '', ai_reason: 'Score error' })
      }
    }

    await new Promise((r) => setTimeout(r, 400))
  }

  return scored
}
