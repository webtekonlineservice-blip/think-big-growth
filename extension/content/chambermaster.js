/**
 * Content script: ChamberMaster directories
 * Used by Kirkwood-Des Peres Chamber and hundreds of other chambers.
 * URL pattern: business.*.com/list, *.chambermaster.com/list
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const leads = scrapeChamberMaster()
    sendResponse({ leads })
  }
})

function scrapeChamberMaster() {
  const leads = []

  // ChamberMaster uses cards with class "card" or "mn-search-result"
  // Also works on their alphabetical listing pages
  const cards = document.querySelectorAll(
    '.card.mn-search-result, .mn-search-result, .card-body, ' +
    '[class*="gz-list-card"], [class*="gz-results"], ' +
    '.list-group-item, .mn-member-row'
  )

  if (cards.length > 0) {
    cards.forEach((card) => {
      const nameEl = card.querySelector(
        'h5 a, h4 a, h3 a, .mn-member-name a, .card-title a, [class*="name"] a, ' +
        '.mn-searchresult-name a, a.mn-search-result-link'
      )
      const name = nameEl?.textContent?.trim() || ''

      // Phone — look for tel: links or formatted numbers
      let phone = ''
      const telLink = card.querySelector('a[href^="tel:"]')
      if (telLink) {
        phone = telLink.textContent?.trim() || telLink.href.replace('tel:', '')
      } else {
        const phoneMatch = (card.textContent || '').match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
        if (phoneMatch) phone = phoneMatch[0]
      }

      // Website link
      let website = ''
      const links = card.querySelectorAll('a[href]')
      links.forEach((a) => {
        const href = a.href || ''
        if (href.includes('http') && !href.includes('chambermaster') &&
            !href.includes('kirkwooddesperes') && !href.includes('mailto:') &&
            !href.includes('tel:') && !href.includes('google.com/maps')) {
          website = href
        }
      })

      // Email
      let email = ''
      const emailLink = card.querySelector('a[href^="mailto:"]')
      if (emailLink) {
        email = emailLink.href.replace('mailto:', '').split('?')[0]
      } else {
        const emailMatch = (card.innerHTML || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        if (emailMatch) email = emailMatch[0]
      }

      // Category
      const category = card.querySelector(
        '.mn-search-result-category, [class*="category"], .badge, .mn-cat'
      )?.textContent?.trim() || ''

      // Address
      const address = card.querySelector(
        '.mn-search-result-address, [class*="address"], .card-text'
      )?.textContent?.trim() || ''

      if (name) {
        leads.push({
          name,
          email,
          company: name,
          profession: category,
          phone,
          website,
          source: 'kirkwood_chamber',
        })
      }
    })
  }

  // Fallback: alphabetical listing pages (simpler structure)
  if (leads.length === 0) {
    // These pages often have simpler list structures
    const listItems = document.querySelectorAll('.list-group-item, .mn-alphabetical-item, tr')
    listItems.forEach((item) => {
      const nameEl = item.querySelector('a')
      const name = nameEl?.textContent?.trim() || ''
      const phone = ((item.textContent || '').match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [])[0] || ''
      const emailMatch = (item.innerHTML || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      const email = emailMatch ? emailMatch[0] : ''

      if (name && name.length > 2 && (email || phone)) {
        leads.push({
          name,
          email,
          company: name,
          profession: '',
          phone,
          website: '',
          source: 'kirkwood_chamber',
        })
      }
    })
  }

  return leads
}
