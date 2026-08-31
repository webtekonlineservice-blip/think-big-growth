#!/usr/bin/env python3
"""
Email Enrichment Script — Think Big St. Louis
Finds contact emails from business websites using regex + DeepSeek AI fallback.

Usage:
  python scripts/enrich.py                    # enrich all prospects missing emails
  python scripts/enrich.py --limit 20         # enrich up to 20 prospects
  python scripts/enrich.py --dry-run          # preview without saving
  python scripts/enrich.py --csv leads.csv    # enrich a CSV file directly

Requirements:
  pip install requests pymongo python-dotenv --break-system-packages
"""

import os
import sys
import time
import argparse
import re
import json
import csv
from pathlib import Path
from datetime import datetime

# Load .env.local
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests
from pymongo import MongoClient

MONGODB_URI = os.getenv('MONGODB_URI')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

if not MONGODB_URI:
    print('ERROR: MONGODB_URI not set in .env.local')
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
IGNORE = ['placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
          'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg', '.gif']

def find_email_regex(website: str) -> str:
    """Fast regex scrape — visits contact page and homepage."""
    if not website:
        return ''
    if not website.startswith('http'):
        website = 'https://' + website

    urls = [
        website.rstrip('/') + '/contact',
        website.rstrip('/') + '/contact-us',
        website.rstrip('/') + '/about',
        website,
    ]

    for url in urls:
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
                    re.match(r'^(contact|info|hello|office|admin|mail|desk|reception)@', e.lower())), None)
                return (preferred or valid[0]).lower()
        except Exception:
            continue
    return ''


def find_email_deepseek(website: str, company: str) -> str:
    """AI-powered email extraction — uses DeepSeek to intelligently find emails."""
    if not DEEPSEEK_API_KEY or not website:
        return ''
    if not website.startswith('http'):
        website = 'https://' + website

    prompt = f"""Visit the contact page of {website} and extract the contact email address for {company}.
Return ONLY the email address as plain text. If no email found, return empty string."""

    try:
        r = requests.post(
            'https://api.deepseek.com/chat/completions',
            headers={'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 50,
                'temperature': 0,
            },
            timeout=20
        )
        if r.ok:
            text = r.json()['choices'][0]['message']['content'].strip()
            emails = re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', text)
            if emails:
                return emails[0].lower()
    except Exception:
        pass
    return ''


def enrich_prospect(name: str, website: str) -> str:
    """Try regex first, fall back to DeepSeek if nothing found."""
    # Step 1 — fast regex scrape
    email = find_email_regex(website)
    if email:
        return email

    # Step 2 — DeepSeek AI (only if key available)
    if DEEPSEEK_API_KEY:
        email = find_email_deepseek(website, name)

    return email


def main():
    parser = argparse.ArgumentParser(description='Enrich prospect emails')
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--campaign', type=str, default=None)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--delay', type=float, default=1.5)
    parser.add_argument('--csv', type=str, default=None, help='Enrich a CSV file directly')
    args = parser.parse_args()

    # ── CSV mode ──────────────────────────────────────────────────────────────
    if args.csv:
        enrich_csv(args.csv, args.dry_run, args.delay, args.limit)
        return

    # ── MongoDB mode ──────────────────────────────────────────────────────────
    print('Connecting to MongoDB...')
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        client.server_info()
        db = client['think-big-growth']
        print('Connected.')
    except Exception as e:
        print(f'MongoDB connection failed: {e}')
        sys.exit(1)

    query = {
        'website': {'$exists': True, '$ne': ''},
        '$or': [
            {'email': {'$regex': 'placeholder.local'}},
            {'email': ''},
        ]
    }
    if args.campaign:
        from bson import ObjectId
        query['campaign_id'] = ObjectId(args.campaign)

    prospects = list(db.prospects.find(query).limit(args.limit))

    if not prospects:
        print('No prospects need enrichment. Upload more CSVs first!')
        client.close()
        return

    print(f'Found {len(prospects)} prospects to enrich')
    print(f'Mode: {"DRY RUN" if args.dry_run else "LIVE"}')
    print(f'DeepSeek AI: {"ENABLED" if DEEPSEEK_API_KEY else "disabled (regex only)"}')
    print('-' * 60)

    enriched = 0
    failed = 0

    for i, p in enumerate(prospects):
        name = p.get('name') or p.get('company') or 'Unknown'
        website = p.get('website', '')
        print(f'[{i+1}/{len(prospects)}] {name}')
        print(f'  Website: {website or "none"}')

        if not website:
            print('  SKIP: no website')
            failed += 1
            continue

        email = enrich_prospect(name, website)

        if email:
            print(f'  ✓ FOUND: {email}')
            if not args.dry_run:
                db.prospects.update_one(
                    {'_id': p['_id']},
                    {'$set': {'email': email, 'enriched': True, 'enriched_at': datetime.utcnow()}}
                )
            enriched += 1
        else:
            print('  ✗ NOT FOUND')
            failed += 1

        if i < len(prospects) - 1:
            time.sleep(args.delay)

    print()
    print('=' * 60)
    print(f'Done. Found: {enriched} | Not found: {failed} | Total: {len(prospects)}')

    if not args.dry_run and enriched > 0:
        # Update campaign counters
        for c in db.emailcampaigns.find({}):
            real = db.prospects.count_documents({
                'campaign_id': c['_id'],
                'email': {'$not': {'$regex': 'placeholder.local'}, '$ne': ''}
            })
            db.emailcampaigns.update_one({'_id': c['_id']}, {'$set': {'total_prospects': real}})
        print('Campaign counters updated.')

    client.close()


def enrich_csv(csv_path: str, dry_run: bool, delay: float, limit: int):
    """Enrich a CSV file and output results."""
    if not Path(csv_path).exists():
        print(f'ERROR: {csv_path} not found')
        sys.exit(1)

    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f'CSV: {csv_path} — {len(rows)} rows')
    print(f'Mode: {"DRY RUN" if dry_run else "LIVE"}')
    print(f'DeepSeek AI: {"ENABLED" if DEEPSEEK_API_KEY else "disabled (regex only)"}')
    print('-' * 60)

    # Normalize headers
    results = []
    enriched = 0
    failed = 0

    for i, row in enumerate(rows[:limit]):
        name = row.get('Title') or row.get('name') or row.get('business_name') or ''
        website = row.get('WebsiteURL') or row.get('website') or row.get('url') or ''
        existing_email = row.get('email') or row.get('Email') or ''

        if existing_email and '@' in existing_email:
            print(f'[{i+1}] {name} — already has email: {existing_email}')
            row['email'] = existing_email
            results.append(row)
            enriched += 1
            continue

        print(f'[{i+1}/{min(len(rows), limit)}] {name}')

        email = enrich_prospect(name, website) if website else ''

        if email:
            print(f'  ✓ {email}')
            enriched += 1
        else:
            print('  ✗ not found')
            failed += 1

        row['email'] = email
        results.append(row)

        if i < len(rows) - 1:
            time.sleep(delay)

    print()
    print('=' * 60)
    print(f'Done. Found: {enriched} | Not found: {failed}')

    if not dry_run:
        out_path = csv_path.replace('.csv', '_enriched.csv')
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            if results:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)
        print(f'Saved enriched CSV: {out_path}')


if __name__ == '__main__':
    main()
