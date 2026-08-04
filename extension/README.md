# Think Big Lead Capture — Chrome Extension

Scrape business contacts from any page and push them directly into the Think Big Growth outbound email system.

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (toggle top right)
3. Click **Load unpacked**
4. Select this `extension/` folder

## Setup

1. Click the extension icon → **Settings** (bottom left)
2. Set your API URL: `https://thinkbig.webtek.ai`
3. Get your auth token:
   - Log in at `https://thinkbig.webtek.ai/member/login`
   - Open DevTools → Application → Cookies → copy `tbg_session` value
   - OR hit `POST /api/ext/auth` with your email/password to get a token
4. Paste the token and save

## Usage

1. Browse to a page with business listings:
   - Google Maps search results
   - Yelp search results
   - Chamber of Commerce directories (kirkwoodarea.com, etc.)
   - Any page with business contacts
2. Click the extension icon
3. Click **Scrape Page** → preview captured leads
4. Select a campaign from the dropdown
5. Click **Import** → leads go straight to your outbound queue

## Supported Sites (Auto-Detect)

- Google Maps (search results + detail panels)
- Yelp (search results + business pages)
- Chamber of Commerce directories
- Generic fallback (extracts emails + phones from any page)

## Manual Add

Click "+ Add manually" in the popup to type in a lead by hand.

## Notes

- Leads are deduplicated by email — same email won't import twice
- The extension stores unsent leads locally until you import
- Each lead is tied to the campaign you select at import time
- The daily cron (10/day) handles sending — importing just queues them
