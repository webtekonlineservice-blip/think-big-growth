#!/usr/bin/env python3
"""
Google Maps Scraper + Enrich + Import — Think Big St. Louis
One command: scrape businesses, find emails, import to a MongoDB campaign.

Usage:
  # Scrape a search, enrich emails, import to campaign
  python scripts/scrape_maps.py "Dentist in Kirkwood MO" --campaign <campaign_id>

  # Scrape only, save to CSV (no import)
  python scripts/scrape_maps.py "Plumber in Webster Groves MO" --csv-only

  # Import an existing CSV (skip scraping)
  python scripts/scrape_maps.py --import-csv Leads/dentists.csv --campaign <campaign_id>

Requirements:
  pip install google-maps-scraper requests pymongo python-dotenv --break-system-packages
  playwright install chromium
"""

import os
import sys
import time
import argparse
import re
import csv
import asyncio
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests
from pymongo import MongoClient

MONGODB_URI = os.getenv('MONGODB_URI')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

IGNORE = ['placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
          'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg', '.gif',
          'godaddy', 'cloudflare']


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL ENRICHMENT (regex + DeepSeek fallback)
# ══════════════════════════════════════════════════════════════════════════════

def find_email(website: str, company: str = '') -> str:
    if not website:
        return ''
    if not website.startswith('http'):
        website = 'https://' + website

    # Regex scrape of contact pages
    for path in ['/contact', '/contact-us', '/about', '']:
        url = website.rstrip('/') + path
        try:
            r = requests.get(url, timeout=8,
                headers={'User-Agent': 'Mozilla/5.0 (compatible; ThinkBigBot/1.0)'},
                allow_redirects=True)
            if not r.ok:
                continue
            emails = re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', r.text)
            valid = [e for e in emails if not any(x in e.lower() for x in IGNORE)]
            if valid:
                preferred = next((e for e in valid if
                    re.match(r'^(contact|info|hello|office|admin|mail|desk|reception|hi)@', e.lower())), None)
                return (preferred or valid[0]).lower()
        except Exception:
            continue

    return ''


# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE MAPS SEARCH → PLACE URLS
# ══════════════════════════════════════════════════════════════════════════════

async def search_to_urls(query: str, max_results: int = 30) -> list:
    """Search Google Maps and collect place URLs."""
    from playwright.async_api import async_playwright

    urls = []
    search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        await page.goto(search_url, timeout=30000)
        await page.wait_for_timeout(3000)

        # Scroll the results feed to load more
        try:
            feed = await page.query_selector('div[role="feed"]')
            for _ in range(max(1, max_results // 7)):
                if feed:
                    await feed.evaluate('el => el.scrollTop = el.scrollHeight')
                await page.wait_for_timeout(2000)
        except Exception:
            pass

        # Collect place links
        links = await page.query_selector_all('a[href*="/maps/place/"]')
        seen = set()
        for link in links:
            href = await link.get_attribute('href')
            if href and href not in seen:
                seen.add(href)
                urls.append(href)
                if len(urls) >= max_results:
                    break

        await browser.close()

    return urls


# ══════════════════════════════════════════════════════════════════════════════
# SCRAPE PLACE DETAILS
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_places_async(urls: list) -> list:
    """Scrape details for a list of Google Maps place URLs."""
    from gmaps_scraper import scrape_batch, ScrapeConfig

    config = ScrapeConfig(headless=True, concurrency=3, delay_min=1, delay_max=3)
    results = await scrape_batch(urls, config=config)

    businesses = []
    for r in results:
        place = getattr(r, 'place', None) or getattr(r, 'data', None)
        success = getattr(r, 'success', place is not None)
        if success and place:
            name = (getattr(place, 'name', '') or '').strip()
            # Skip junk rows
            if not name or name.lower() in ('hours', 'menu', 'directions', 'website'):
                continue
            businesses.append({
                'name': name,
                'phone': _clean(getattr(place, 'phone', '')),
                'website': _clean(getattr(place, 'website', '')),
                'category': _clean(getattr(place, 'category', '')),
                'address': _clean(getattr(place, 'address', '')),
            })
    return businesses


def _clean(val) -> str:
    """Strip whitespace/newlines from scraped values."""
    if not val:
        return ''
    return ' '.join(str(val).split()).strip()


def scrape_places(urls: list) -> list:
    return asyncio.run(scrape_places_async(urls))


# ══════════════════════════════════════════════════════════════════════════════
# IMPORT TO MONGODB
# ══════════════════════════════════════════════════════════════════════════════

def import_to_campaign(businesses: list, campaign_id: str, enrich: bool = True) -> dict:
    import secrets

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=15000)
    db = client['think-big-growth']

    from bson import ObjectId
    campaign = db.emailcampaigns.find_one({'_id': ObjectId(campaign_id)})
    if not campaign:
        print(f'ERROR: campaign {campaign_id} not found')
        client.close()
        return {'imported': 0, 'skipped': 0}

    imported = 0
    skipped = 0

    for b in businesses:
        email = ''
        if enrich and b['website']:
            email = find_email(b['website'], b['name'])
            time.sleep(0.5)

        if not email:
            email = f"noemail_{secrets.token_hex(4)}@placeholder.local"

        # Skip duplicates
        existing = db.prospects.find_one({'email': email, 'campaign_id': ObjectId(campaign_id)})
        if existing and 'placeholder' not in email:
            skipped += 1
            continue

        db.prospects.insert_one({
            'name': b['name'],
            'email': email,
            'company': b['name'],
            'profession': b['category'],
            'phone': b['phone'],
            'website': b['website'],
            'source': 'google_maps',
            'campaign_id': ObjectId(campaign_id),
            'status': 'new',
            'unsubscribed': False,
            'unsubscribe_token': secrets.token_hex(24),
            'sequence_step': 0,
            'last_sent_at': None,
            'opened_count': 0,
            'clicked_count': 0,
            'enriched': bool(email and 'placeholder' not in email),
            'created_at': datetime.utcnow(),
        })
        imported += 1
        status = email if 'placeholder' not in email else '(no email)'
        print(f'  + {b["name"]} — {status}')

    # Update campaign counter
    real = db.prospects.count_documents({
        'campaign_id': ObjectId(campaign_id),
        'email': {'$not': {'$regex': 'placeholder.local'}, '$ne': ''}
    })
    db.emailcampaigns.update_one({'_id': ObjectId(campaign_id)}, {'$set': {'total_prospects': real}})

    client.close()
    return {'imported': imported, 'skipped': skipped}


# ══════════════════════════════════════════════════════════════════════════════
# CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════

def load_csv(path: str) -> list:
    with open(path, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    businesses = []
    for row in rows:
        businesses.append({
            'name': row.get('Title') or row.get('name') or row.get('business_name') or '',
            'phone': row.get('PhoneNumber') or row.get('phone') or '',
            'website': row.get('WebsiteURL') or row.get('website') or '',
            'category': row.get('Category') or row.get('category') or row.get('profession') or '',
            'address': row.get('Address') or row.get('address') or '',
            'email': row.get('Email') or row.get('email') or '',
        })
    return businesses


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Scrape Google Maps + enrich + import')
    parser.add_argument('query', nargs='?', help='Search query e.g. "Dentist in Kirkwood MO"')
    parser.add_argument('--campaign', help='Campaign ID to import into')
    parser.add_argument('--max', type=int, default=30, help='Max results (default 30)')
    parser.add_argument('--csv-only', action='store_true', help='Save CSV, do not import')
    parser.add_argument('--import-csv', help='Import an existing CSV instead of scraping')
    parser.add_argument('--no-enrich', action='store_true', help='Skip email enrichment')
    args = parser.parse_args()

    if not MONGODB_URI and not args.csv_only:
        print('ERROR: MONGODB_URI not set')
        sys.exit(1)

    # ── CSV import mode ──
    if args.import_csv:
        if not args.campaign:
            print('ERROR: --campaign required with --import-csv')
            sys.exit(1)
        print(f'Loading {args.import_csv}...')
        businesses = load_csv(args.import_csv)
        print(f'{len(businesses)} businesses. Importing + enriching...')
        result = import_to_campaign(businesses, args.campaign, enrich=not args.no_enrich)
        print(f'\nDone. Imported: {result["imported"]} | Skipped: {result["skipped"]}')
        return

    # ── Scrape mode ──
    if not args.query:
        print('ERROR: provide a search query or use --import-csv')
        sys.exit(1)

    print(f'Searching Google Maps: "{args.query}"')

    async def run_scrape():
        urls = await search_to_urls(args.query, args.max)
        print(f'Found {len(urls)} places. Scraping details...')
        return await scrape_places_async(urls)

    businesses = asyncio.run(run_scrape())
    print(f'Scraped {len(businesses)} businesses.')

    # Save CSV always
    safe = re.sub(r'[^a-z0-9]+', '_', args.query.lower())
    out = Path(__file__).parent.parent / 'Leads' / f'{safe}.csv'
    out.parent.mkdir(exist_ok=True)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['name', 'phone', 'website', 'category', 'address'])
        w.writeheader()
        w.writerows(businesses)
    print(f'Saved CSV: {out}')

    if args.csv_only:
        return

    if not args.campaign:
        print('\nNo --campaign given. CSV saved but not imported.')
        print('Import later with: python scripts/scrape_maps.py --import-csv "%s" --campaign <id>' % out)
        return

    print('\nImporting + enriching...')
    result = import_to_campaign(businesses, args.campaign, enrich=not args.no_enrich)
    print(f'\nDone. Imported: {result["imported"]} | Skipped: {result["skipped"]}')


if __name__ == '__main__':
    main()
