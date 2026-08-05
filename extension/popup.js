/**
 * Popup script — manages the extension UI.
 */

let leads = []

const campaignSelect = document.getElementById('campaign-select')
const leadsList = document.getElementById('leads-list')
const leadCount = document.getElementById('lead-count')
const btnScrape = document.getElementById('btn-scrape')
const btnImport = document.getElementById('btn-import')
const btnClear = document.getElementById('btn-clear')
const statusEl = document.getElementById('status')

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadCampaigns()
  await loadSavedLeads()
})

// ── Load campaigns ───────────────────────────────────────────────────────────
async function loadCampaigns() {
  chrome.runtime.sendMessage({ type: 'GET_CAMPAIGNS' }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('error', 'Extension error. Try reloading.')
      return
    }
    if (response?.error) {
      showStatus('error', response.error)
      campaignSelect.innerHTML = '<option value="">⚠ ' + escHtml(response.error) + '</option>'
      return
    }
    if (!response?.length) {
      campaignSelect.innerHTML = '<option value="">No campaigns — create one in admin</option>'
      return
    }
    campaignSelect.innerHTML = response
      .map((c) => `<option value="${c.id}">${escHtml(c.name)} (${c.total_prospects})</option>`)
      .join('')

    chrome.storage.local.get('lastCampaign', (data) => {
      if (data.lastCampaign) campaignSelect.value = data.lastCampaign
    })
  })
}

// ── Scrape page ──────────────────────────────────────────────────────────────
btnScrape.addEventListener('click', async () => {
  btnScrape.disabled = true
  btnScrape.textContent = 'Scanning...'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab.url || ''

    // Determine which scraper to inject based on URL
    let scriptFile = 'content/generic.js'
    if (url.includes('google.com/maps') || url.includes('maps.google')) {
      scriptFile = 'content/google-maps.js'
    } else if (url.includes('yelp.com')) {
      scriptFile = 'content/yelp.js'
    } else if (url.includes('chambermaster.com') || url.includes('kirkwooddesperes.com')) {
      scriptFile = 'content/chambermaster.js'
    } else if (url.includes('chamberofcommerce.com')) {
      scriptFile = 'content/chamber.js'
    }

    // Always inject the script fresh to ensure latest version runs
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [scriptFile],
    })

    // Small delay then ask for results
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' }, (response) => {
        if (chrome.runtime.lastError) {
          // Try generic as last fallback
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/generic.js'],
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' }, (resp) => {
                handleScrapeResult(resp?.leads || [])
              })
            }, 400)
          })
        } else {
          handleScrapeResult(response?.leads || [])
        }
      })
    }, 300)
  } catch (err) {
    showStatus('error', 'Failed: ' + err.message)
    resetScrapeBtn()
  }
})

function handleScrapeResult(newLeads) {
  if (newLeads.length > 0) {
    addLeads(newLeads)
    showStatus('success', `Found ${newLeads.length} leads!`)
  } else {
    showStatus('info', 'No leads found. Try a business directory page or add manually.')
  }
  resetScrapeBtn()
}

function resetScrapeBtn() {
  btnScrape.disabled = false
  btnScrape.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Scrape Page`
}

// ── Import ───────────────────────────────────────────────────────────────────
btnImport.addEventListener('click', () => {
  const campaignId = campaignSelect.value
  if (!campaignId) { showStatus('error', 'Select a campaign first.'); return }
  if (!leads.length) return

  btnImport.disabled = true
  btnImport.textContent = 'Importing...'

  chrome.storage.local.set({ lastCampaign: campaignId })

  chrome.runtime.sendMessage({
    type: 'IMPORT_PROSPECTS',
    campaignId,
    prospects: leads,
  }, (response) => {
    if (response?.error) {
      showStatus('error', response.error)
      btnImport.disabled = false
    } else {
      showStatus('success', `✓ Imported ${response.imported} leads! (${response.skipped} duplicates skipped)`)
      // Reset everything
      leads = []
      renderLeads()
    }
    resetImportBtn()
  })
})

function resetImportBtn() {
  btnImport.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Import <span id="import-count">${leads.length}</span>`
  btnImport.disabled = leads.length === 0
}

// ── Clear all ────────────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => {
  if (leads.length === 0) return
  if (!confirm(`Clear all ${leads.length} captured leads?`)) return
  leads = []
  chrome.storage.local.set({ savedLeads: [] })
  renderLeads()
  showStatus('info', 'Cleared.')
})

// ── Manual add ───────────────────────────────────────────────────────────────
document.getElementById('btn-manual-add').addEventListener('click', () => {
  const name = document.getElementById('manual-name').value.trim()
  const email = document.getElementById('manual-email').value.trim()
  const company = document.getElementById('manual-company').value.trim()
  const profession = document.getElementById('manual-profession').value.trim()
  const phone = document.getElementById('manual-phone').value.trim()

  if (!email) { showStatus('error', 'Email is required.'); return }

  addLeads([{ name: name || company, email, company, profession, phone, source: 'manual' }])
  showStatus('success', 'Lead added.')

  // Clear form
  ;['manual-name', 'manual-email', 'manual-company', 'manual-profession', 'manual-phone'].forEach(id => {
    document.getElementById(id).value = ''
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function addLeads(newLeads) {
  const existing = new Set(leads.map((l) => l.email.toLowerCase()))
  let added = 0
  for (const lead of newLeads) {
    if (!lead.email) continue
    const em = lead.email.toLowerCase()
    if (!existing.has(em)) {
      leads.push(lead)
      existing.add(em)
      added++
    }
  }
  chrome.storage.local.set({ savedLeads: leads })
  renderLeads()
  return added
}

function removeLead(index) {
  leads.splice(index, 1)
  chrome.storage.local.set({ savedLeads: leads })
  renderLeads()
}

function renderLeads() {
  leadCount.textContent = leads.length
  const ic = document.getElementById('import-count')
  if (ic) ic.textContent = leads.length
  btnImport.disabled = leads.length === 0
  btnClear.style.display = leads.length > 0 ? 'inline-flex' : 'none'

  if (leads.length === 0) {
    leadsList.innerHTML = '<p class="empty-state">Browse a business directory and click<br/>"Scrape Page" to capture contacts.</p>'
    return
  }

  leadsList.innerHTML = leads
    .map((l, i) => `
      <div class="lead-item">
        <div class="lead-info">
          <div class="lead-name">${escHtml(l.name || l.company || 'Unknown')}</div>
          <div class="lead-email">${escHtml(l.email)}${l.phone ? ' · ' + escHtml(l.phone) : ''}</div>
        </div>
        <button class="lead-remove" data-index="${i}" title="Remove">×</button>
      </div>`)
    .join('')

  leadsList.querySelectorAll('.lead-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeLead(parseInt(btn.dataset.index)))
  })
}

async function loadSavedLeads() {
  const data = await chrome.storage.local.get('savedLeads')
  if (data.savedLeads?.length) {
    leads = data.savedLeads
    renderLeads()
  }
}

function showStatus(type, message) {
  statusEl.className = `status ${type}`
  statusEl.textContent = message
  statusEl.classList.remove('hidden')
  clearTimeout(statusEl._timeout)
  statusEl._timeout = setTimeout(() => statusEl.classList.add('hidden'), 4000)
}

function escHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
