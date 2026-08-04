/**
 * Content script: Yelp
 * Scrapes business listings from Yelp search results.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const leads = scrapeYelp()
    sendResponse({ leads })
  }
})

function scrapeYelp() {
  const leads = []

  // Search results page
  const resultCards = document.querySelectorAll('[class*="container__"] [class*="searchResult"], li.border-color--default, [data-testid="serp-ia-card"]')

  if (resultCards.length > 0) {
    resultCards.forEach((card) => {
      const name = card.querySelector('a[class*="businessName"], h3 a, [class*="heading"]')?.textContent?.trim() || ''
      const category = card.querySelector('[class*="category"], [class*="priceCategory"] span')?.textContent?.trim() || ''
      const phone = card.querySelector('[class*="phone"], .text-size--small')?.textContent?.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || ''

      if (name) {
        leads.push({
          name,
          email: '',
          company: name,
          profession: category,
          phone,
          website: '',
          source: 'yelp',
        })
      }
    })
  }

  // Single business page
  if (leads.length === 0) {
    const singleName = document.querySelector('h1')?.textContent?.trim()
    if (singleName) {
      let phone = ''
      let website = ''
      let category = ''

      // Phone
      const phoneEl = document.querySelector('[href^="tel:"], [class*="phone"]')
      if (phoneEl) phone = phoneEl.textContent?.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || ''

      // Website
      const websiteEl = document.querySelector('a[href*="biz_redir"]')
      if (websiteEl) website = websiteEl.href || ''

      // Category
      const catEls = document.querySelectorAll('[class*="category"] a, a[href*="/search?cflt="]')
      const cats = Array.from(catEls).map((e) => e.textContent?.trim()).filter(Boolean)
      category = cats.join(', ')

      leads.push({
        name: singleName,
        email: '',
        company: singleName,
        profession: category,
        phone,
        website,
        source: 'yelp',
      })
    }
  }

  return leads
}
