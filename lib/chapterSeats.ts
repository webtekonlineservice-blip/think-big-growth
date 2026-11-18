/**
 * Think Big St. Louis seat list: one seat per business category.
 *
 * This is the single source of truth for seat names, their power team
 * (categories that refer each other the most), and the words used to
 * match a member's role or a prospect's profession to a seat.
 *
 * Matching is whole-word (see lib/seatAliases.ts): "roofing - residential"
 * matches the alias "roofing", but "home cleaning" never matches
 * "home inspector".
 */

export type PowerTeam = 'Home Services' | 'Money & Legacy' | 'Business Services' | 'Health & Wellness' | 'Events'

export const POWER_TEAMS: { id: PowerTeam; blurb: string }[] = [
  { id: 'Home Services', blurb: 'Buying, fixing and caring for a home. The strongest referral circle in Kirkwood.' },
  { id: 'Money & Legacy', blurb: 'Taxes, wealth, insurance, estates and senior transitions.' },
  { id: 'Business Services', blurb: 'Everything a growing local business buys.' },
  { id: 'Health & Wellness', blurb: 'Feeling better, moving better, looking better.' },
  { id: 'Events', blurb: 'Weddings, parties and company events.' },
]

export interface SeatDef {
  name: string
  team: PowerTeam
  aliases: string[]
}

export const SEAT_DEFS: SeatDef[] = [
  // ── Home Services ──
  { name: 'Realtor', team: 'Home Services', aliases: ['realtor', 'real estate agent', 'real estate', 'realty', 'real estate broker', 'residential real estate', 'commercial real estate'] },
  { name: 'Mortgage Broker', team: 'Home Services', aliases: ['mortgage broker', 'mortgage', 'mortgages', 'home loans', 'home loan', 'mortgage lender', 'loan officer'] },
  { name: 'Title Company', team: 'Home Services', aliases: ['title company', 'title insurance', 'title agency', 'escrow', 'closing services'] },
  { name: 'Home Inspector', team: 'Home Services', aliases: ['home inspector', 'home inspection', 'property inspector'] },
  { name: 'Contractor / Builder', team: 'Home Services', aliases: ['general contractor', 'contractor', 'builder', 'home builder', 'construction', 'design build'] },
  { name: 'Remodeler / Handyman', team: 'Home Services', aliases: ['remodeler', 'remodeling', 'renovation', 'renovations', 'handyman', 'home repair', 'kitchen and bath'] },
  { name: 'Roofing', team: 'Home Services', aliases: ['roofing', 'roofer', 'roof', 'roofing contractor'] },
  { name: 'Painter', team: 'Home Services', aliases: ['painter', 'painting', 'painting contractor', 'house painter'] },
  { name: 'Flooring', team: 'Home Services', aliases: ['flooring', 'floors', 'carpet', 'hardwood', 'tile', 'flooring contractor'] },
  { name: 'HVAC', team: 'Home Services', aliases: ['hvac', 'heating', 'air conditioning', 'heating and cooling', 'furnace', 'hvac contractor'] },
  { name: 'Plumber', team: 'Home Services', aliases: ['plumber', 'plumbing', 'plumbing contractor'] },
  { name: 'Electrician', team: 'Home Services', aliases: ['electrician', 'electrical', 'electrical contractor', 'electric contractor'] },
  { name: 'Restoration', team: 'Home Services', aliases: ['restoration', 'water damage', 'fire damage', 'mold remediation', 'water restoration', 'damage restoration'] },
  { name: 'Home Cleaning', team: 'Home Services', aliases: ['home cleaning', 'house cleaning', 'maid service', 'residential cleaning', 'cleaning service', 'carpet cleaning', 'floor cleaning'] },
  { name: 'Pest Control', team: 'Home Services', aliases: ['pest control', 'exterminator', 'termite'] },
  { name: 'Moving Company', team: 'Home Services', aliases: ['moving company', 'movers', 'moving'] },
  { name: 'Windows / Garage Doors', team: 'Home Services', aliases: ['windows', 'window replacement', 'garage door', 'garage doors', 'doors and windows'] },
  { name: 'Landscaper', team: 'Home Services', aliases: ['landscaper', 'landscaping', 'lawn care', 'lawn service'] },
  { name: 'Interior Designer', team: 'Home Services', aliases: ['interior designer', 'interior design', 'interior decorator'] },
  { name: 'Property Manager', team: 'Home Services', aliases: ['property manager', 'property management'] },
  { name: 'Solar / Energy', team: 'Home Services', aliases: ['solar', 'solar energy', 'renewable energy', 'energy consultant'] },

  // ── Money & Legacy ──
  { name: 'Accountant / CPA', team: 'Money & Legacy', aliases: ['accountant', 'cpa', 'accounting', 'certified public accountant'] },
  { name: 'Bookkeeper', team: 'Money & Legacy', aliases: ['bookkeeper', 'bookkeeping'] },
  { name: 'Tax Consultant', team: 'Money & Legacy', aliases: ['tax consultant', 'tax advisor', 'tax preparation', 'tax preparer', 'tax services'] },
  { name: 'Financial Advisor', team: 'Money & Legacy', aliases: ['financial advisor', 'financial planner', 'financial planning', 'wealth management', 'investment advisor', 'investments', 'financial services'] },
  { name: 'Banker', team: 'Money & Legacy', aliases: ['banker', 'banking', 'bank', 'commercial banking', 'banking services'] },
  { name: 'Insurance Agent', team: 'Money & Legacy', aliases: ['insurance agent', 'insurance', 'insurance broker', 'commercial insurance', 'property and casualty insurance', 'life insurance', 'health insurance', 'auto insurance', 'p and c insurance'] },
  { name: 'Attorney / Lawyer', team: 'Money & Legacy', aliases: ['attorney', 'lawyer', 'law firm', 'legal services', 'estate planning', 'estate planning law', 'litigation', 'law'] },
  { name: 'Senior Care Advisor', team: 'Money & Legacy', aliases: ['senior care', 'home care', 'senior living', 'senior placement', 'assisted living', 'elder care', 'senior move'] },
  { name: 'Funeral & Pre-Planning', team: 'Money & Legacy', aliases: ['funeral', 'funeral home', 'cremation', 'pre planning', 'preplanning'] },

  // ── Business Services ──
  { name: 'Business Coach', team: 'Business Services', aliases: ['business coach', 'business consultant', 'business consulting', 'executive coach', 'management consultant'] },
  { name: 'Digital Marketing', team: 'Business Services', aliases: ['digital marketing', 'seo', 'social media marketing', 'online marketing', 'ppc', 'search engine optimization'] },
  { name: 'Marketing Consultant', team: 'Business Services', aliases: ['marketing consultant', 'marketing agency', 'advertising', 'marketing'] },
  { name: 'Web Designer / Developer', team: 'Business Services', aliases: ['web designer', 'web developer', 'web development', 'website design', 'website designer', 'website developer'] },
  { name: 'IT / Tech Consultant', team: 'Business Services', aliases: ['it consultant', 'it services', 'managed it', 'it support', 'tech consultant', 'technology consultant', 'cybersecurity', 'computer repair'] },
  { name: 'HR Consultant', team: 'Business Services', aliases: ['hr consultant', 'human resources', 'hr services'] },
  { name: 'Recruiter', team: 'Business Services', aliases: ['recruiter', 'recruiting', 'staffing', 'headhunter', 'talent acquisition'] },
  { name: 'Payroll / PEO', team: 'Business Services', aliases: ['payroll', 'peo', 'payroll services'] },
  { name: 'Commercial Cleaning', team: 'Business Services', aliases: ['commercial cleaning', 'janitorial', 'office cleaning'] },
  { name: 'Printer / Promotional', team: 'Business Services', aliases: ['printing', 'printer', 'print shop', 'promotional products', 'promotional'] },
  { name: 'Sign Company', team: 'Business Services', aliases: ['sign company', 'signs', 'signage'] },
  { name: 'Photographer', team: 'Business Services', aliases: ['photographer', 'photography', 'headshots'] },
  { name: 'Videographer', team: 'Business Services', aliases: ['videographer', 'video production', 'video'] },
  { name: 'Auto Sales', team: 'Business Services', aliases: ['auto sales', 'car sales', 'auto dealer', 'car dealership'] },
  { name: 'Travel Agent', team: 'Business Services', aliases: ['travel agent', 'travel agency', 'travel advisor'] },

  // ── Health & Wellness ──
  { name: 'Chiropractor', team: 'Health & Wellness', aliases: ['chiropractor', 'chiropractic', 'chiro'] },
  { name: 'Dentist', team: 'Health & Wellness', aliases: ['dentist', 'dental', 'orthodontist', 'orthodontics'] },
  { name: 'Physical Therapist', team: 'Health & Wellness', aliases: ['physical therapist', 'physical therapy', 'physiotherapy'] },
  { name: 'Health & Wellness', team: 'Health & Wellness', aliases: ['health and wellness', 'wellness', 'health coach', 'health and wellness products', 'holistic health'] },
  { name: 'Nutritionist', team: 'Health & Wellness', aliases: ['nutritionist', 'dietitian', 'nutrition'] },
  { name: 'Massage Therapist', team: 'Health & Wellness', aliases: ['massage', 'massage therapist', 'massage therapy'] },
  { name: 'Med Spa', team: 'Health & Wellness', aliases: ['med spa', 'medical spa', 'aesthetics', 'esthetician', 'skincare'] },
  { name: 'Personal Trainer', team: 'Health & Wellness', aliases: ['personal trainer', 'personal training', 'fitness', 'fitness studio', 'gym'] },
  { name: 'Life Coach', team: 'Health & Wellness', aliases: ['life coach', 'life coaching'] },

  // ── Events ──
  { name: 'Event Planner', team: 'Events', aliases: ['event planner', 'event planning', 'wedding planner'] },
  { name: 'Florist', team: 'Events', aliases: ['florist', 'flowers', 'floral'] },
  { name: 'Caterer', team: 'Events', aliases: ['caterer', 'catering'] },
  { name: 'DJ / Entertainment', team: 'Events', aliases: ['dj', 'disc jockey', 'entertainment'] },
  { name: 'Event Venue', team: 'Events', aliases: ['event venue', 'venue', 'banquet hall', 'event space'] },
]

/** All seat names, in display order. */
export const ALL_SEATS: string[] = SEAT_DEFS.map((s) => s.name)

export function seatTeam(name: string): PowerTeam | null {
  return SEAT_DEFS.find((s) => s.name === name)?.team ?? null
}
