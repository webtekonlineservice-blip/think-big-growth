/**
 * Canonical seat names → alias terms.
 *
 * When checking if a seat is "filled" or matching a profession string to a
 * canonical seat, we test both directions: does the input contain any alias,
 * or does any alias contain the input?
 *
 * Add more aliases here as your chapter's member roles evolve.
 */
export const SEAT_ALIASES: Record<string, string[]> = {
  'Realtor': [
    'realtor', 'real estate agent', 'real estate', 'realty', 'real estate broker',
    'residential real estate', 'commercial real estate',
  ],
  'Attorney / Lawyer': [
    'attorney', 'lawyer', 'law', 'legal', 'estate planning law', 'estate planning',
    'litigation', 'counsel',
  ],
  'Banker': [
    'banker', 'banking', 'banking services', 'bank', 'commercial banking',
  ],
  'Business Coach': [
    'business coach', 'business consultant', 'business consulting', 'consultant',
    'coaching', 'executive coach',
  ],
  'Chiropractor': [
    'chiropractor', 'chiropractic', 'chiro',
  ],
  'Contractor / Builder': [
    'contractor', 'builder', 'general contractor', 'construction', 'roofing',
    'roofing - residential', 'roofing residential', 'roofer', 'remodeling',
    'renovation',
  ],
  'Dentist': [
    'dentist', 'dental', 'orthodontist', 'orthodontics',
  ],
  'Digital Marketing': [
    'digital marketing', 'seo', 'social media', 'online marketing', 'ppc',
    'search engine optimization',
  ],
  'Financial Advisor': [
    'financial advisor', 'financial planner', 'wealth management', 'investment advisor',
    'financial planning', 'advisor',
  ],
  'Health & Wellness': [
    'health & wellness', 'health and wellness', 'wellness', 'health coach',
    'health & wellness products', 'nutrition', 'holistic health',
  ],
  'Home Inspector': [
    'home inspector', 'home inspection', 'property inspector',
  ],
  'Insurance Agent': [
    'insurance agent', 'insurance', 'insurance broker', 'commercial insurance',
    'property & casualty insurance', 'property and casualty', 'life insurance',
    'health insurance', 'auto insurance', 'p&c insurance',
  ],
  'IT / Tech Consultant': [
    'it consultant', 'tech consultant', 'technology consultant', 'it services',
    'managed it', 'cybersecurity', 'web development', 'software development',
    'web developer', 'web designer',
  ],
  'Landscaper': [
    'landscaper', 'landscaping', 'lawn care', 'lawn service', 'grounds',
  ],
  'Mortgage Broker': [
    'mortgage broker', 'mortgage', 'home loans', 'mortgage lender', 'loan officer',
    'residential mortgages', 'residential mortgage', 'home mortgage',
  ],
  'Photographer': [
    'photographer', 'photography', 'photo', 'videographer', 'video production',
  ],
  'Physical Therapist': [
    'physical therapist', 'physical therapy', 'pt', 'physiotherapy',
  ],
  'Property Manager': [
    'property manager', 'property management', 'property management company',
  ],
  'Recruiter': [
    'recruiter', 'recruiting', 'staffing', 'headhunter', 'talent acquisition',
    'hr consultant', 'human resources',
  ],
  'Solar / Energy': [
    'solar', 'solar energy', 'renewable energy', 'energy consultant',
  ],
  'Tax Consultant': [
    'tax consultant', 'tax advisor', 'tax preparation', 'tax preparer', 'cpa',
    'accountant', 'accounting',
  ],
  'Accountant / CPA': [
    'accountant', 'cpa', 'accounting', 'bookkeeper', 'bookkeeping',
    'certified public accountant',
  ],
  'Web Designer / Developer': [
    'web designer', 'web developer', 'web development', 'website designer',
    'website developer', 'front end developer', 'full stack developer',
  ],
}

/**
 * Given any profession string (e.g. from a member role or prospect field),
 * return the canonical seat name from ALL_SEATS, or null if no match found.
 */
export function canonicalizeProfession(input: string): string | null {
  if (!input) return null
  const lower = input.toLowerCase().trim()

  for (const [canonical, aliases] of Object.entries(SEAT_ALIASES)) {
    // Direct match against canonical name
    if (canonical.toLowerCase() === lower) return canonical

    // Alias match
    for (const alias of aliases) {
      if (lower.includes(alias) || alias.includes(lower)) return canonical
    }
  }

  return null
}

/**
 * Returns true if a given profession string matches a canonical seat,
 * considering all known aliases. Used in the seat-filled guard.
 */
export function professionMatchesSeat(profession: string, seatName: string): boolean {
  if (!profession || !seatName) return false
  const p = profession.toLowerCase().trim()
  const s = seatName.toLowerCase().trim()

  // Direct substring match (original behavior)
  if (p.includes(s) || s.includes(p)) return true
  // First-word match (original behavior)
  if (p.split(' ')[0] === s.split(' ')[0]) return true

  // Alias-aware match
  const canonicalFromProfession = canonicalizeProfession(profession)
  const canonicalFromSeat = canonicalizeProfession(seatName)
  if (canonicalFromProfession && canonicalFromSeat) {
    return canonicalFromProfession === canonicalFromSeat
  }
  if (canonicalFromProfession && canonicalFromProfession.toLowerCase() === s) return true
  if (canonicalFromSeat && canonicalFromSeat.toLowerCase() === p) return true

  return false
}

/**
 * Given a list of filled member roles, returns true if the given seat/profession
 * is already covered by a member — using full alias-aware matching.
 */
export function isSeatFilledByMembers(
  profession: string,
  filledRoles: string[]
): boolean {
  return filledRoles.some((role) => professionMatchesSeat(profession, role))
}
