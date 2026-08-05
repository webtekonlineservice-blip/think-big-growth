/**
 * Background service worker — handles API communication and badge management.
 */

// Update badge when leads are stored
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.savedLeads) {
    const count = changes.savedLeads.newValue?.length || 0
    updateBadge(count)
  }
})

// Set badge on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('savedLeads', (data) => {
    updateBadge(data.savedLeads?.length || 0)
  })
})

// Also set on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('savedLeads', (data) => {
    updateBadge(data.savedLeads?.length || 0)
  })
})

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) })
    chrome.action.setBadgeBackgroundColor({ color: '#06B6D4' })
  } else {
    chrome.action.setBadgeText({ text: '' })
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'IMPORT_PROSPECTS') {
    importProspects(msg.campaignId, msg.prospects)
      .then((result) => {
        // Clear leads and badge after successful import
        chrome.storage.local.set({ savedLeads: [] })
        updateBadge(0)
        sendResponse(result)
      })
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (msg.type === 'GET_CAMPAIGNS') {
    fetchCampaigns()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (msg.type === 'SCRAPE_GENERIC') {
    // Inject generic scraper into the specified tab
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ['content/generic.js'],
    }).then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (msg.type === 'UPDATE_BADGE') {
    updateBadge(msg.count)
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
  if (!authToken) throw new Error('No auth token set. Open Settings to configure.')

  const res = await fetch(`${apiUrl}/api/prospects/campaigns`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (res.status === 401 || res.status === 403) throw new Error('Auth failed. Update your token in Settings.')
  if (!res.ok) throw new Error('Failed to fetch campaigns.')
  return res.json()
}

async function importProspects(campaignId, prospects) {
  const { apiUrl, authToken } = await getConfig()
  if (!authToken) throw new Error('No auth token set. Open Settings to configure.')

  const res = await fetch(`${apiUrl}/api/prospects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ campaign_id: campaignId, prospects }),
  })
  if (res.status === 401 || res.status === 403) throw new Error('Auth failed. Update your token in Settings.')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Import failed.')
  }
  return res.json()
}
