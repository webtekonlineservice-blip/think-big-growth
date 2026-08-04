/**
 * Popup script — manages the extension UI.
 */

let leads = []

// DOM refs
const campaignSelect = document.getElementById('campaign-select')
const leadsList = document.getElementById('leads-list')
const leadCount = document.getElementById('lead-count')
const importCount = document.getElementById('import-count')
const btnScrape = document.getElementById('btn-scrape')
const btnImport = document.getElementById('btn-import')
const statusEl = document.getElementById('status')

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadCampaigns()
  await loadSavedLeads()
})

// ── Load campaigns ───────────────────────────────────────────────────────────

async function loadCampaigns() {
  chrome.runtime.sendMessage({ type: 'GET_CAMPAIGNS' }, (response) => {
    if (response?.error) {
      showStatus('error', response.error)
      campaignSelect.innerHTML = '<option value="">⚠ Check settings</option>'
      return
    }

    if (!response?.length) {
      campaignSelect.innerHTML = '<option value="">No campaigns — create one in admin</option>'
      return
    }

    campaignSelect.innerHTML = response
      .map((c) => `<option value="${c.id}">${c.name} (${c.total_prospects} prospects)</option>`)
      .join('')

    // Restore last selected campaign
    chrome.storage.local.get('lastCampaign', (data) => {
      if (data.lastCampaign) campaignSelect.value = data.lastCampaign
    })
  })
}

// ── Scrape page ──────────────────────────────────────────────────────────────

btnScrape.addEventListener('click', async () => {
  btnScrape.disabled = true
  btnScrape.textContent = 'Scraping...'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Try content script first (auto-injected for known sites)
    chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' }, (response) => {
      if (chrome.runtime.lastError || !response?.leads?.length) {
        // Fallback: inject generic scraper
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/generic.js'],
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' }, (resp) => {
              if (resp?.leads?.length) {
                addLeads(resp.leads)
                showStatus('success', `Found ${resp.leads.length} leads`)
              } else {
                showStatus('info', 'No leads found on this page. Try a different page or add manually.')
              }
              btnScrape.disabled = false
              btnScrape.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Scrape Page'
            })
          }, 500)
        })
        return
      }

      addLeads(response.leads)
      showStatus('success', `Found ${response.leads.length} leads`)
      btnScrape.disabled = false
      btnScrape.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Scrape Page'
    })
  } catch (err) {
    showStatus('error', 'Scrape failed: ' + err.message)
    btnScrape.disabled = false
    btnScrape.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Scrape Page'
  }
})

// ── Import to app ────────────────────────────────────────────────────────────

btnImport.addEventListener('click', () => {
  const campaignId = campaignSelect.value
  if (!campaignId) { showStatus('error', 'Select a campaign first.'); return }
  if (!leads.length) { showStatus('error', 'No leads to import.'); return }

  btnImport.disabled = true
  btnImport.textContent = 'Importing...'

  // Save last campaign choice
  chrome.storage.local.set({ lastCampaign: campaignId })

  chrome.runtime.sendMessage({
    type: 'IMPORT_PROSPECTS',
    campaignId,
    prospects: leads,
  }, (response) => {
    if (response?.error) {
      showStatus('error', response.error)
    } else {
      showStatus('success', `Imported ${response.imported} leads (${response.skipped} skipped)`)
      leads = []
      chrome.storage.local.set({ savedLeads: [] })
      renderLeads()
    }
    btnImport.disabled = false
    btnImport.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Import <span id="import-count">0</span>'
  })
})

// ── Manual add ───────────────────────────────────────────────────────────────

document.getElementById('btn-manual-add').addEventListener('click', () => {
  const name = document.getElementById('manual-name').value.trim()
  const email = document.getElementById('manual-email').value.trim()
  const company = document.getElementById('manual-company').value.trim()
  const profession = document.getElementById('manual-profession').value.trim()
  const phone = document.getElementById('manual-phone').value.trim()

  if (!email) { showStatus('error', 'Email is required.'); return }

  addLeads([{ name, email, company, profession, phone, source: 'manual' }])
  showStatus('success', 'Lead added.')

  // Clear form
  document.getElementById('manual-name').value = ''
  document.getElementById('manual-email').value = ''
  document.getElementById('manual-company').value = ''
  document.getElementById('manual-profession').value = ''
  document.getElementById('manual-phone').value = ''
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function addLeads(newLeads) {
  // Deduplicate by email
  const existing = new Set(leads.map((l) => l.email.toLowerCase()))
  for (const lead of newLeads) {
    if (!lead.email) continue
    const em = lead.email.toLowerCase()
    if (!existing.has(em)) {
      leads.push(lead)
      existing.add(em)
    }
  }
  chrome.storage.local.set({ savedLeads: leads })
  renderLeads()
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

  if (leads.length === 0) {
    leadsList.innerHTML = '<p class="empty-state">Click "Scrape Page" to capture business contacts from this page.</p>'
    return
  }

  leadsList.innerHTML = leads
    .map((l, i) => `
      <div class="lead-item">
        <div class="lead-info">
          <div class="lead-name">${escHtml(l.name || l.company || 'Unknown')}</div>
          <div class="lead-email">${escHtml(l.email)}${l.phone ? ' · ' + escHtml(l.phone) : ''}</div>
        </div>
        <button class="lead-remove" data-index="${i}">×</button>
      </div>
    `)
    .join('')

  // Attach remove handlers
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
  setTimeout(() => statusEl.classList.add('hidden'), 5000)
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
