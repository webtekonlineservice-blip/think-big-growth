/**
 * Content script: ChamberMaster / GrowthZone directories
 * Works on: business.kirkwooddesperes.com, *.chambermaster.com
 *
 * Page structure (observed from Kirkwood-Des Peres):
 * Each business is in a container with:
 *   - A heading link with the business name
 *   - Address block with city/state/zip
 *   - Phone number in text
 *   - "Visit Website" link
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const leads = scrapeChamberMaster()
    sendResponse({ leads })
  }
  return true
})

function scrapeChamberMaster() {
  const leads = []
  const seen = new Set()

  // The page text contains structured blocks for each business
  // Strategy: find all phone numbers on the page and work backwards to find the business name
  const bodyText = document.body.innerText || ''
  const bodyHtml = document.body.innerHTML || ''

  // Approach 1: Find all links that look like business names (heading links)
  // On ChamberMaster, business names are typically in heading elements or bold links
  const allLinks = document.querySelectorAll('a')
  const businessLinks = []

  allLinks.forEach((link) => {
    const href = link.href || ''
    const text = link.textContent?.trim() || ''
    // Business detail links typically go to /list/member/... or contain the member name
    if (text.length > 2 && text.length < 100 &&
        !href.includes('javascript:') &&
        !text.includes('Visit Website') &&
        !text.includes('Search') &&
        !text.includes('Directory') &&
        !text.includes('Events') &&
        !text.includes('Contact') &&
        !text.includes('Hot Deals') &&
        !text.includes('Job Post') &&
        !text.includes('Member To Member') &&
        (href.includes('/list/') || href.includes('/member/')) &&
        !seen.has(text.toLowerCase())) {

      // This is likely a business name link
      businessLinks.push({ name: text, element: link })
      seen.add(text.toLowerCase())
    }
  })

  // For each business name, find the nearest phone number and website
  businessLinks.forEach(({ name, element }) => {
    // Walk up to find the containing block
    let container = element.parentElement
    for (let i = 0; i < 6; i++) {
      if (container?.parentElement) container = container.parentElement
      // Stop if container has enough content
      const text = container?.textContent || ''
      if (text.length > 50 && text.includes(name)) break
    }

    const containerText = container?.textContent || ''
    const containerHtml = container?.innerHTML || ''

    // Extract phone
    const phoneMatch = containerText.match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/)
    const phone = phoneMatch ? phoneMatch[0] : ''

    // Extract website (look for external links, not chamber links)
    let website = ''
    const links = container?.querySelectorAll('a[href]') || []
    links.forEach((a) => {
      const h = a.href || ''
      const t = a.textContent?.trim() || ''
      if (t === 'Visit Website' || (h.includes('http') &&
          !h.includes('kirkwooddesperes') && !h.includes('chambermaster') &&
          !h.includes('growthzone') && !h.includes('mailto:') &&
          !h.includes('tel:') && !h.includes('maps.google'))) {
        website = h
      }
    })

    // Extract email if present
    const emailMatch = containerHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const email = emailMatch ? emailMatch[0] : ''

    // Extract city
    let city = ''
    const cityMatch = containerText.match(/(?:Kirkwood|Des Peres|Saint Louis|St\. Louis|Clayton|Fenton|Manchester|Valley Park|Webster Groves|University City|Eureka|Warson Woods)/i)
    if (cityMatch) city = cityMatch[0]

    // Only add if we have a name and at least a phone or website
    if (name && (phone || website || email)) {
      leads.push({
        name,
        email,
        company: name,
        profession: '',
        phone,
        website,
        source: 'kirkwood_chamber',
      })
    }
  })

  return leads
}
