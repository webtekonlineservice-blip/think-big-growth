// Options page script — separate file for Chrome extension CSP compliance

const apiUrlInput = document.getElementById('api-url')
const authTokenInput = document.getElementById('auth-token')
const btnSave = document.getElementById('btn-save')
const statusEl = document.getElementById('status')

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiUrl', 'authToken'], (data) => {
    if (data.apiUrl) apiUrlInput.value = data.apiUrl
    if (data.authToken) authTokenInput.value = data.authToken
  })
})

// Save
btnSave.addEventListener('click', () => {
  const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '') || 'https://thinkbig.webtek.ai'
  const authToken = authTokenInput.value.trim()

  if (!authToken) {
    showStatus('error', 'Auth token is required.')
    return
  }

  chrome.storage.sync.set({ apiUrl, authToken }, () => {
    if (chrome.runtime.lastError) {
      showStatus('error', 'Failed to save: ' + chrome.runtime.lastError.message)
    } else {
      showStatus('success', 'Settings saved! You can close this tab.')
    }
  })
})

function showStatus(type, msg) {
  statusEl.textContent = msg
  statusEl.className = `${type} show`
}
