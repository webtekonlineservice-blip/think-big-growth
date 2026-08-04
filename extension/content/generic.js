/**
 * Content script: Generic page scraper
 * Fallback for any page — looks for emails, phones, and business names.
 */

// Only inject message listener once
if (!window.__tbgGenericInjected) {
  window.__tbgGenericInjected = true

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCRAPE') {
      const leads = scrapeGeneric()
      sendResponse({ leads })
    }
  })
}

function scrapeGeneric() {
  const leads = []
  const pageText = document.body.innerText || ''
  const pageHtml = document.body.innerHTML || ''

  // Find all emails on the page
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = [...new Set((pageHtml.match(emailRegex) || []))]
    .filter((e) => !e.includes('example.com') && !e.includes('sentry') && !e.includes('wix'))

  // Find all phone numbers
  const phoneRegex = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
  const phones = [...new Set((pageText.match(phoneRegex) || []))]

  // Try to find business cards / structured blocks
  const cards = document.querySelectorAll(
    'article, .card, [class*="business"], [class*="member"], [class*="listing"], [class*="result"], ' +
    '[class*="contact"], [class*="directory"], li[class]'
  )

  if (cards.length > 0 && cards.length < 200) {
    cards.forEach((card) => {
      const text = card.textContent || ''
      const html = card.innerHTML || ''
      const name = card.querySelector('h2, h3, h4, [class*="name"], [class*="title"], strong')?.textContent?.trim() || ''
      const email = (html.match(emailRegex) || [])[0] || ''
      const phone = (text.match(phoneRegex) || [])[0] || ''

      if (name && (email || phone)) {
        leads.push({
          name,
          email,
          company: name,
          profession: '',
          phone,
          website: '',
          source: 'web_scrape',
        })
      }
    })
  }

  // Fallback: if no structured cards, just return emails as prospects
  if (leads.length === 0 && emails.length > 0) {
    emails.slice(0, 50).forEach((email) => {
      leads.push({
        name: '',
        email,
        company: '',
        profession: '',
        phone: '',
        website: '',
        source: 'web_scrape',
      })
    })
  }

  return leads
}
