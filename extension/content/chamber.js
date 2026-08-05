/**
 * Content script: Chamber of Commerce directories
 * Scrapes member listings from chamber websites.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const leads = scrapeChamber()
    sendResponse({ leads })
  }
})

function scrapeChamber() {
  const leads = []

  const cards = document.querySelectorAll(
    '.card, .member-card, .business-card, .listing-item, ' +
    '[class*="member"], [class*="listing"], [class*="directory-item"], ' +
    '.gz-results-card, .mn-search-result'
  )

  cards.forEach((card) => {
    const name = card.querySelector('h2, h3, h4, .card-title, [class*="name"], [class*="title"]')?.textContent?.trim() || ''
    const phone = extractPhone(card.textContent || '')
    const email = extractEmail(card.innerHTML || '')
    const website = card.querySelector('a[href*="http"]:not([href*="chamber"])')?.href || ''
    const category = card.querySelector('[class*="category"], [class*="type"], .badge, .tag')?.textContent?.trim() || ''

    if (name && (email || phone)) {
      leads.push({
        name,
        email: email || '',
        company: name,
        profession: category,
        phone: phone || '',
        website,
        source: 'chamber_directory',
      })
    }
  })

  // Fallback: tables
  if (leads.length === 0) {
    const tables = document.querySelectorAll('table')
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr')
      rows.forEach((row, i) => {
        if (i === 0) return
        const cells = row.querySelectorAll('td')
        if (cells.length < 2) return

        const name = cells[0]?.textContent?.trim() || ''
        const email = extractEmail(row.innerHTML)
        const phone = extractPhone(row.textContent || '')

        if (name && (email || phone)) {
          leads.push({
            name,
            email: email || '',
            company: name,
            profession: '',
            phone: phone || '',
            website: '',
            source: 'chamber_directory',
          })
        }
      })
    })
  }

  return leads
}

function extractPhone(text) {
  const match = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
  return match ? match[0] : ''
}

function extractEmail(html) {
  const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}
