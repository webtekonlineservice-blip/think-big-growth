#!/usr/bin/env python3
"""
Lead Gen Pipeline — Think Big St. Louis
One command: scrape Google Maps → enrich emails → create campaign → import via API.

Bypasses the local MongoDB SSL issue by importing through the deployed API.

Usage:
  python scripts/leadgen.py "Plumber in Kirkwood MO"
  python scripts/leadgen.py "Dentist in Webster Groves MO" --profession Dentist --max 20
  python scripts/leadgen.py "Realtor in Kirkwood MO" --campaign <existing_id>

Setup (one time):
  Set THINKBIG_EMAIL and THINKBIG_PASSWORD in .env.local, or pass --email / --password

Requirements:
  pip install requests python-dotenv playwright google-maps-scraper --break-system-packages
  playwright install firefox
"""

import os
import sys
import re
import csv
import time
import json
import argparse
import asyncio
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests

API_URL = os.getenv('NEXT_PUBLIC_APP_URL', 'https://thinkbig.webtek.ai').rstrip('/')
EMAIL = os.getenv('THINKBIG_EMAIL', 'theplebjd@proton.me')
PASSWORD = os.getenv('THINKBIG_PASSWORD', '123456')

IGNORE = ['placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
          'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg', '.gif',
          'godaddy', 'cloudflare', 'yext']


def log(msg): print(msg, flush=True)


# ══════════════════════════════════════════════════════════════════════════════
# 1. AUTH — get session token from the API
# ══════════════════════════════════════════════════════════════════════════════

def get_session(email: str, password: str):
    s = requests.Session()
    r = s.post(f'{API_URL}/api/auth/login',
        json={'email': email, 'password': password}, timeout=20)
    if not r.ok:
        log(f'ERROR: login failed — {r.text}')
        sys.exit(1)
    log(f'✓ Logged in as {email}')
    return s


# ══════════════════════════════════════════════════════════════════════════════
# 2. SCRAPE — Google Maps search → place URLs → details
# ══════════════════════════════════════════════════════════════════════════════

async def search_to_urls(query: str, max_results: int) -> list:
    from playwright.async_api import async_playwright
    urls, seen = [], set()
    search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page()
        await page.goto(search_url, timeout=30000)
        await page.wait_for_timeout(3000)
        try:
            feed = await page.query_selector('div[role="feed"]')
            for _ in range(max(1, max_results // 7)):
                if feed:
                    await feed.evaluate('el => el.scrollTop = el.scrollHeight')
                await page.wait_for_timeout(2000)
        except Exception:
            pass
        links = await page.query_selector_all('a[href*="/maps/place/"]')
        for link in links:
            href = await link.get_attribute('href')
            if href and href not in seen:
                seen.add(href)
                urls.append(href)
                if len(urls) >= max_results:
                    break
        await browser.close()
    return urls


async def scrape_details(urls: list) -> list:
    from gmaps_scraper import scrape_batch, ScrapeConfig
    config = ScrapeConfig(headless=True, concurrency=3, delay_min=1, delay_max=3)
    results = await scrape_batch(urls, config=config)
    out = []
    for r in results:
        place = getattr(r, 'place', None) or getattr(r, 'data', None)
        if not place:
            continue
        name = _clean(getattr(place, 'name', ''))
        if not name or name.lower() in ('hours', 'menu', 'directions', 'website'):
            continue
        out.append({
            'name': name,
            'phone': _clean(getattr(place, 'phone', '')),
            'website': _clean(getattr(place, 'website', '')),
            'category': _clean(getattr(place, 'category', '')),
            'address': _clean(getattr(place, 'address', '')),
        })
    return out


def _clean(v):
    return ' '.join(str(v).split()).strip() if v else ''


# ══════════════════════════════════════════════════════════════════════════════
# 3. ENRICH — find emails from websites
# ══════════════════════════════════════════════════════════════════════════════

def find_email(website: str) -> str:
    if not website:
        return ''
    if not website.startswith('http'):
        website = 'https://' + website
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
                pref = next((e for e in valid if re.match(
                    r'^(contact|info|hello|office|admin|mail|desk|reception|hi|front)@', e.lower())), None)
                return (pref or valid[0]).lower()
        except Exception:
            continue
    return ''


# ══════════════════════════════════════════════════════════════════════════════
# 4. CAMPAIGN — create or reuse
# ══════════════════════════════════════════════════════════════════════════════

def ensure_campaign(session, profession: str, campaign_id: str = None) -> str:
    if campaign_id:
        return campaign_id
    r = session.post(f'{API_URL}/api/prospects/campaigns',
        json={'profession': profession}, timeout=20)
    if not r.ok:
        log(f'ERROR: campaign creation failed — {r.text}')
        sys.exit(1)
    data = r.json()
    log(f'✓ Created campaign "{data["name"]}" ({data["sequence_count"]} emails)')
    return data['id']


# ══════════════════════════════════════════════════════════════════════════════
# 5. IMPORT — push prospects via API
# ══════════════════════════════════════════════════════════════════════════════

def import_prospects(session, campaign_id: str, prospects: list) -> dict:
    r = session.post(f'{API_URL}/api/prospects',
        json={'campaign_id': campaign_id, 'prospects': prospects}, timeout=60)
    if not r.ok:
        log(f'ERROR: import failed — {r.text}')
        return {'imported': 0, 'skipped': 0}
    return r.json()


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Full lead-gen pipeline')
    parser.add_argument('query', help='Search query e.g. "Plumber in Kirkwood MO"')
    parser.add_argument('--profession', help='Profession label for the campaign (default: inferred from query)')
    parser.add_argument('--campaign', help='Existing campaign ID (skips creation)')
    parser.add_argument('--max', type=int, default=20, help='Max businesses (default 20)')
    parser.add_argument('--email', default=EMAIL)
    parser.add_argument('--password', default=PASSWORD)
    parser.add_argument('--no-enrich', action='store_true')
    args = parser.parse_args()

    # Infer profession from query if not given (first word before "in")
    profession = args.profession
    if not profession:
        profession = re.split(r'\s+in\s+', args.query, flags=re.I)[0].strip()

    log(f'\n{"="*60}')
    log(f'  LEAD GEN: {args.query}')
    log(f'  Profession: {profession}')
    log(f'{"="*60}\n')

    # 1. Auth
    session = get_session(args.email, args.password)

    # 2. Scrape
    log(f'\n[1/4] Searching Google Maps...')
    async def run():
        urls = await search_to_urls(args.query, args.max)
        log(f'  Found {len(urls)} places')
        return await scrape_details(urls)
    businesses = asyncio.run(run())
    log(f'  Scraped {len(businesses)} businesses')

    if not businesses:
        log('No businesses found. Try a different query.')
        return

    # Save raw CSV
    safe = re.sub(r'[^a-z0-9]+', '_', args.query.lower())
    csv_path = Path(__file__).parent.parent / 'Leads' / f'{safe}.csv'
    csv_path.parent.mkdir(exist_ok=True)
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['name', 'phone', 'website', 'category', 'address'])
        w.writeheader()
        w.writerows(businesses)
    log(f'  Saved: {csv_path}')

    # 3. Enrich
    prospects = []
    if not args.no_enrich:
        log(f'\n[2/4] Finding emails...')
        for i, b in enumerate(businesses):
            email = find_email(b['website'])
            if email:
                log(f'  ✓ {b["name"]} — {email}')
                prospects.append({
                    'name': b['name'], 'email': email, 'company': b['name'],
                    'profession': profession, 'phone': b['phone'],
                    'website': b['website'], 'source': 'google_maps',
                })
            else:
                log(f'  ✗ {b["name"]} — no email')
            time.sleep(0.5)
    else:
        for b in businesses:
            prospects.append({
                'name': b['name'], 'email': '', 'company': b['name'],
                'profession': profession, 'phone': b['phone'],
                'website': b['website'], 'source': 'google_maps',
            })

    prospects_with_email = [p for p in prospects if p['email']]
    log(f'\n  {len(prospects_with_email)} prospects with emails')

    if not prospects_with_email:
        log('No emails found — nothing to import.')
        return

    # 4. Campaign + import
    log(f'\n[3/4] Setting up campaign...')
    campaign_id = ensure_campaign(session, profession, args.campaign)

    log(f'\n[4/4] Importing prospects...')
    result = import_prospects(session, campaign_id, prospects_with_email)

    log(f'\n{"="*60}')
    log(f'  DONE — Imported {result.get("imported", 0)} | Skipped {result.get("skipped", 0)}')
    log(f'  Campaign: {campaign_id}')
    log(f'  These will start the drip on the next daily cron.')
    log(f'{"="*60}\n')


if __name__ == '__main__':
    main()
