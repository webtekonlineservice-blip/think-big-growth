#!/usr/bin/env python3
"""
Consolidate agent/realtor prospects into the Stack Day campaign — deduped.

Pulls every prospect from the SOURCE campaigns, drops placeholder emails,
dedupes by lowercased email (and skips any already in the Stack Day campaign),
then imports the unique set into the TARGET campaign.

Dry-run by default — shows the deduped count without writing.
Add --commit to actually import.

Usage:
  python scripts/consolidate_agents.py              # dry run (no writes)
  python scripts/consolidate_agents.py --commit     # perform the import
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests

API = os.getenv('NEXT_PUBLIC_APP_URL', 'https://thinkbig.webtek.ai').rstrip('/')
EMAIL = os.getenv('THINKBIG_EMAIL')
PASSWORD = os.getenv('THINKBIG_PASSWORD')

# The 5 paused agent/realtor campaigns to pull from.
SOURCE_CAMPAIGNS = [
    '6a98b9bd7b2ee63529dace29',  # Agents Outreach (235)
    '6a989c699ac97787ccd5f136',  # Real Estate Agent Outreach (89)
    '6a98bbaba9af0d386a9ff997',  # Realtor Outreach (4)
    '6a977e881ca1af1acbf28e24',  # Realtor Outreach (7)
    '6a9764df90bd5f5c5319c10b',  # Realtor Outreach (4)
]

# Stack Day — Sept 10
TARGET_CAMPAIGN = '6a9740867aa5574a5330abf6'

COMMIT = '--commit' in sys.argv


def login():
    if not EMAIL or not PASSWORD:
        print('ERROR: THINKBIG_EMAIL and THINKBIG_PASSWORD must be set in .env.local')
        sys.exit(1)
    s = requests.Session()
    r = s.post(f'{API}/api/auth/login', json={'email': EMAIL, 'password': PASSWORD}, timeout=20)
    if not r.ok:
        print(f'Login failed ({r.status_code}): {r.text}')
        sys.exit(1)
    return s


def fetch_all_prospects(s, campaign_id):
    """Page through all prospects for a campaign."""
    out = []
    page = 1
    while True:
        r = s.get(f'{API}/api/prospects',
                  params={'campaign_id': campaign_id, 'page': page, 'limit': 100},
                  timeout=30)
        if not r.ok:
            print(f'  WARN: fetch failed for {campaign_id} page {page}: {r.status_code}')
            break
        data = r.json()
        out.extend(data.get('prospects', []))
        if page >= data.get('pages', 1):
            break
        page += 1
    return out


def is_real_email(email):
    e = (email or '').strip().lower()
    return e and '@' in e and 'placeholder.local' not in e


def main():
    s = login()
    print(f'Mode: {"COMMIT (will write)" if COMMIT else "DRY RUN (no writes)"}\n')

    # 1. Emails already in the Stack Day campaign — skip these to avoid dupes on re-run.
    existing = fetch_all_prospects(s, TARGET_CAMPAIGN)
    existing_emails = {p['email'].strip().lower() for p in existing if is_real_email(p.get('email'))}
    print(f'Stack Day already has {len(existing)} prospects ({len(existing_emails)} real emails).\n')

    # 2. Pull + dedupe from source campaigns.
    seen = set(existing_emails)  # don't re-add ones already in Stack Day
    unique = []
    total_seen = 0
    placeholders = 0
    dupes = 0

    for cid in SOURCE_CAMPAIGNS:
        rows = fetch_all_prospects(s, cid)
        print(f'  {cid}: {len(rows)} prospects')
        for p in rows:
            total_seen += 1
            email = (p.get('email') or '').strip().lower()
            if not is_real_email(email):
                placeholders += 1
                continue
            if email in seen:
                dupes += 1
                continue
            seen.add(email)
            unique.append({
                'name': p.get('name', ''),
                'email': email,
                'company': p.get('company', ''),
                'profession': p.get('profession') or 'Real Estate Agent',
                'phone': p.get('phone', ''),
                'source': p.get('source', 'consolidated'),
            })

    print('\n' + '=' * 60)
    print(f'  Scanned:            {total_seen}')
    print(f'  Placeholder (skip): {placeholders}')
    print(f'  Duplicate (skip):   {dupes}')
    print(f'  UNIQUE to import:   {len(unique)}')
    print('=' * 60)

    if not COMMIT:
        print('\nDry run — nothing written. Re-run with --commit to import.')
        return

    if not unique:
        print('\nNothing to import.')
        return

    # 3. Import into Stack Day in chunks.
    print(f'\nImporting {len(unique)} into Stack Day ({TARGET_CAMPAIGN})...')
    imported = skipped = 0
    for i in range(0, len(unique), 100):
        chunk = unique[i:i + 100]
        r = s.post(f'{API}/api/prospects',
                   json={'campaign_id': TARGET_CAMPAIGN, 'prospects': chunk}, timeout=90)
        if r.ok:
            d = r.json()
            imported += d.get('imported', 0)
            skipped += d.get('skipped', 0)
            print(f'  chunk {i // 100 + 1}: imported {d.get("imported", 0)}, skipped {d.get("skipped", 0)}')
        else:
            print(f'  chunk {i // 100 + 1} FAILED ({r.status_code}): {r.text[:200]}')

    print(f'\nDone. Imported: {imported} | Skipped: {skipped}')


if __name__ == '__main__':
    main()
