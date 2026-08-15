#!/usr/bin/env python3
"""
Email Enrichment Script — Think Big St. Louis
Uses ScrapeGraphAI to find contact emails from prospect websites.

Usage:
  python scripts/enrich.py                    # enrich all prospects missing emails
  python scripts/enrich.py --limit 20         # enrich up to 20 prospects
  python scripts/enrich.py --campaign <id>    # enrich specific campaign only
  python scripts/enrich.py --dry-run          # preview without saving

Requirements:
  pip install scrapegraphai pymongo python-dotenv playwright
  playwright install chromium
"""

import os
import sys
import time
import argparse
import re
from datetime import datetime
from pathlib import Path

# Load .env.local
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env.local')

from pymongo import MongoClient

MONGODB_URI = os.getenv('MONGODB_URI')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

if not MONGODB_URI:
    print('ERROR: MONGODB_URI not set in .env.local')
    sys.exit(1)

if not DEEPSEEK_API_KEY:
    print('ERROR: DEEPSEEK_API_KEY not set in .env.local')
    sys.exit(1)


# ── ScrapeGraphAI config ──────────────────────────────────────────────────────
GRAPH_CONFIG = {
    'llm': {
        'api_key': DEEPSEEK_API_KEY,
        'model': 'deepseek/deepseek-chat',
        'base_url': 'https://api.deepseek.com',
    },
    'verbose': False,
    'headless': True,
}

SCRAPE_PROMPT = """
Extract the business contact email address from this webpage.
Look for: contact email, info@ email, owner email, general inquiry email.
Return ONLY the email address as a plain string.
If multiple emails found, return the most general contact one (info@, contact@, hello@).
If no email found, return empty string.
"""


def find_email_on_website(website_url: str) -> str:
    """Try to find a contact email on a business website."""
    # Ensure URL has protocol
    if not website_url.startswith('http'):
        website_url = 'https://' + website_url

    # First try the contact page
    contact_urls = [
        website_url.rstrip('/') + '/contact',
        website_url.rstrip('/') + '/contact-us',
        website_url.rstrip('/') + '/about',
        website_url,  # homepage as fallback
    ]

    try:
        from scrapegraphai.graphs import SmartScraperGraph
    except ImportError:
        print('  ERROR: scrapegraphai not installed. Run: pip install scrapegraphai')
        return ''

    for url in contact_urls:
        try:
            scraper = SmartScraperGraph(
                prompt=SCRAPE_PROMPT,
                source=url,
                config=GRAPH_CONFIG,
            )
            result = scraper.run()

            # Extract email from result
            email = ''
            if isinstance(result, dict):
                email = str(result.get('email', '') or result.get('contact_email', '') or '')
            elif isinstance(result, str):
                email = result.strip()

            # Validate it looks like an email
            if email and re.match(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', email):
                return email.lower()

        except Exception as e:
            if 'timeout' in str(e).lower() or '404' in str(e):
                continue  # try next URL
            print(f'  Warning: {url} — {str(e)[:60]}')
            continue

    # Fallback: regex scrape the homepage directly
    try:
        import urllib.request
        req = urllib.request.Request(website_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            html = r.read().decode('utf-8', errors='ignore')
        emails = re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', html)
        # Filter out common non-contact emails
        ignore = ['example.com', 'sentry.io', 'schema.org', 'w3.org', 'wixpress', 'squarespace']
        valid = [e for e in emails if not any(x in e for x in ignore)]
        if valid:
            return valid[0].lower()
    except Exception:
        pass

    return ''


def main():
    parser = argparse.ArgumentParser(description='Enrich prospect emails using ScrapeGraphAI')
    parser.add_argument('--limit', type=int, default=50, help='Max prospects to enrich (default: 50)')
    parser.add_argument('--campaign', type=str, default=None, help='Campaign ID to filter by')
    parser.add_argument('--dry-run', action='store_true', help='Preview without saving to DB')
    parser.add_argument('--delay', type=float, default=2.0, help='Seconds between requests (default: 2)')
    args = parser.parse_args()

    # Connect to MongoDB
    client = MongoClient(MONGODB_URI)
    db = client['think-big-growth']
    prospects_col = db['prospects']
    campaigns_col = db['emailcampaigns']

    # Build query — prospects with website but no real email
    query = {
        'website': {'$exists': True, '$ne': ''},
        '$or': [
            {'email': {'$regex': 'placeholder.local'}},
            {'email': ''},
            {'email': None},
        ]
    }
    if args.campaign:
        from bson import ObjectId
        query['campaign_id'] = ObjectId(args.campaign)

    prospects = list(prospects_col.find(query).limit(args.limit))

    if not prospects:
        print('No prospects need enrichment.')
        return

    print(f'Found {len(prospects)} prospects to enrich')
    print(f'Mode: {"DRY RUN" if args.dry_run else "LIVE"}')
    print('-' * 50)

    enriched = 0
    failed = 0

    for i, p in enumerate(prospects):
        name = p.get('name') or p.get('company') or 'Unknown'
        website = p.get('website', '')
        print(f'[{i+1}/{len(prospects)}] {name} — {website}')

        if not website:
            print('  SKIP: no website')
            failed += 1
            continue

        email = find_email_on_website(website)

        if email:
            print(f'  FOUND: {email}')
            if not args.dry_run:
                prospects_col.update_one(
                    {'_id': p['_id']},
                    {'$set': {
                        'email': email,
                        'enriched_at': datetime.utcnow(),
                        'enriched': True,
                    }}
                )
            enriched += 1
        else:
            print('  NOT FOUND')
            if not args.dry_run:
                prospects_col.update_one(
                    {'_id': p['_id']},
                    {'$set': {'enriched': False, 'enriched_at': datetime.utcnow()}}
                )
            failed += 1

        if i < len(prospects) - 1:
            time.sleep(args.delay)

    print()
    print('=' * 50)
    print(f'Done. Enriched: {enriched} | Not found: {failed} | Total: {len(prospects)}')

    if not args.dry_run and enriched > 0:
        # Update campaign prospect counts
        print('Updating campaign counters...')
        for campaign in campaigns_col.find({}):
            real_count = prospects_col.count_documents({
                'campaign_id': campaign['_id'],
                'email': {'$not': {'$regex': 'placeholder.local'}, '$ne': '', '$ne': None}
            })
            campaigns_col.update_one(
                {'_id': campaign['_id']},
                {'$set': {'total_prospects': real_count}}
            )
        print('Done.')

    client.close()


if __name__ == '__main__':
    main()
