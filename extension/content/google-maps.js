/**
 * Content script: Google Maps
 * Scrapes business listings from Google Maps search results.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const leads = scrapeGoogleMaps()
    sendResponse({ leads })
  }
})

function scrapeGoogleMaps() {
  const leads = []

  // Try to find the results panel items
  const resultCards = document.querySelectorAll('[data-result-index], .Nv2PK, .bfdHYd')

  if (resultCards.length > 0) {
    resultCards.forEach((card) => {
      const name = card.querySelector('.qBF1Pd, .NrDZNb, [class*="fontHeadlineSmall"]')?.textContent?.trim() || ''
      const category = card.querySelector('.W4Efsd:first-of-type .rllt__details div:first-child, .W4Efsd .rllt__details, [class*="fontBodyMedium"] > span')?.textContent?.trim() || ''

      // Phone and website from the info sections
      let phone = ''
      let website = ''

      const infoTexts = card.querySelectorAll('.W4Efsd, [class*="fontBodyMedium"]')
      infoTexts.forEach((el) => {
        const text = el.textContent || ''
        const phoneMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
        if (phoneMatch) phone = phoneMatch[0]

        const link = el.querySelector('a[href*="http"]')
        if (link && !link.href.includes('google.com')) website = link.href
      })

      // Try to extract from aria-labels
      const ariaLabel = card.getAttribute('aria-label') || ''

      if (name) {
        leads.push({
          name,
          email: '', // Maps rarely shows email
          company: name,
          profession: category,
          phone,
          website,
          source: 'google_maps',
        })
      }
    })
  }

  // Also try the side panel detail view (single business)
  if (leads.length === 0) {
    const singleName = document.querySelector('h1.DUwDvf, h1[class*="header"]')?.textContent?.trim()
    if (singleName) {
      let phone = ''
      let website = ''
      let category = ''

      const buttons = document.querySelectorAll('[data-tooltip], button[aria-label]')
      buttons.forEach((btn) => {
        const label = btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || ''
        const phoneMatch = label.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
        if (phoneMatch) phone = phoneMatch[0]
        if (label.includes('http') || label.includes('.com')) website = label
      })

      // Category from subtitle
      category = document.querySelector('.DkEaL, [class*="category"]')?.textContent?.trim() || ''

      leads.push({
        name: singleName,
        email: '',
        company: singleName,
        profession: category,
        phone,
        website,
        source: 'google_maps',
      })
    }
  }

  return leads
}
