/**
 * Background service worker — handles API communication with the Think Big app.
 */

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'IMPORT_PROSPECTS') {
    importProspects(msg.campaignId, msg.prospects)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
    return true // keeps channel open for async response
  }

  if (msg.type === 'GET_CAMPAIGNS') {
    fetchCampaigns()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (msg.type === 'SCRAPE_PAGE') {
    // Inject generic scraper into the active tab
    chrome.scripting.executeScript({
      target: { tabId: sender.tab?.id || msg.tabId },
      files: ['content/generic.js'],
    })
    sendResponse({ ok: true })
    return false
  }
})

async function getConfig() {
  const data = await chrome.storage.sync.get(['apiUrl', 'authToken'])
  const apiUrl = data.apiUrl || 'https://thinkbig.webtek.ai'
  const authToken = data.authToken || ''
  return { apiUrl, authToken }
}

async function fetchCampaigns() {
  const { apiUrl, authToken } = await getConfig()
  const res = await fetch(`${apiUrl}/api/prospects/campaigns`, {
    headers: { Authorization: `Bearer ${authToken}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch campaigns. Check your auth token.')
  return res.json()
}

async function importProspects(campaignId, prospects) {
  const { apiUrl, authToken } = await getConfig()
  const res = await fetch(`${apiUrl}/api/prospects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ campaign_id: campaignId, prospects }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Import failed.')
  }
  return res.json()
}
