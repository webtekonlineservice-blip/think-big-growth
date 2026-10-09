/**
 * Lunch receipt parser (DeepSeek) for Toast POS receipts from the chapter venue.
 *
 * Receipts are often OCR'd and messy (garbled dates like "10/8/28", prices
 * detached from labels, stray BOM chars). We ask the model to extract clean
 * structured data, then sanity-check it. The caller always confirms before saving.
 */

export interface ParsedReceipt {
  date: string            // YYYY-MM-DD (best guess; caller confirms)
  total: number           // grand total — the chapter lunch expense
  subtotal?: number
  tax?: number
  gratuity?: number       // "Large Party" / tip
  discount?: number
  check_number?: string
  items: { name: string; price?: number }[]
  warnings: string[]      // things the caller should eyeball (e.g. odd year)
}

const CURRENT_YEAR = new Date().getFullYear()

/** Clamp an implausible year (OCR often mangles it) to the current year. */
function normalizeDate(raw: string, warnings: string[]): string {
  const m = raw?.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw
  let [, y] = m
  const year = Number(y)
  if (year < CURRENT_YEAR - 1 || year > CURRENT_YEAR + 1) {
    warnings.push(`Receipt year looked like ${year}; defaulted to ${CURRENT_YEAR}. Please confirm.`)
    return raw.replace(/\d{4}/, String(CURRENT_YEAR))
  }
  return raw
}

/**
 * Parse a pasted receipt into structured data via DeepSeek.
 * Throws on missing key / API failure so the caller can show the raw box.
 */
export async function parseReceipt(rawText: string): Promise<ParsedReceipt> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY is not set.')

  const system = [
    'You extract structured data from restaurant receipts (often OCR-garbled).',
    'Return STRICT JSON only, no markdown, with this shape:',
    '{ "date": "YYYY-MM-DD", "total": number, "subtotal": number|null, "tax": number|null, "gratuity": number|null, "discount": number|null, "check_number": string|null, "items": [{ "name": string, "price": number|null }] }',
    'Rules:',
    `- The grand total is the final amount due/paid. If OCR garbled a price like "817.50", infer the likely value ($17.50).`,
    `- "Large Party" or auto-gratuity is the gratuity field.`,
    '- Dates may be mangled (e.g. "10/8/28"); produce the most likely YYYY-MM-DD. Prefer the current year when ambiguous.',
    '- items = the ordered food lines (entrées/dishes), not modifiers like "Extra Ranch" or "Medium". Attach a price when one is clearly associated.',
    '- Never invent items that are not present. Output valid JSON only.',
  ].join('\n')

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Receipt text:\n\n${rawText}` },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DeepSeek returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek returned no content.')

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content)
  } catch {
    // Strip any accidental code fences and retry
    const cleaned = String(content).replace(/```json|```/g, '').trim()
    parsed = JSON.parse(cleaned)
  }

  const warnings: string[] = []
  const num = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
    return isNaN(n) ? undefined : n
  }

  const rawDate = typeof parsed.date === 'string' ? parsed.date : ''
  const date = normalizeDate(rawDate, warnings)

  const total = num(parsed.total)
  if (total == null) warnings.push('Could not read a total — please enter it manually.')

  const items = Array.isArray(parsed.items)
    ? (parsed.items as Record<string, unknown>[])
        .map((it) => ({ name: String(it.name ?? '').trim(), price: num(it.price) }))
        .filter((it) => it.name)
    : []

  return {
    date,
    total: total ?? 0,
    subtotal: num(parsed.subtotal),
    tax: num(parsed.tax),
    gratuity: num(parsed.gratuity),
    discount: num(parsed.discount),
    check_number: parsed.check_number ? String(parsed.check_number) : undefined,
    items,
    warnings,
  }
}
