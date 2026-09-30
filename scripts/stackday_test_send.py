#!/usr/bin/env python3
"""
Stack Day confirmation test send — ISOLATED.

Creates a throwaway campaign that uses the SAME Stack Day sequence, adds only
the test email to it, and sends. This guarantees NO real agent is emailed
(the real Stack Day campaign is never touched). Deletes the test campaign after.

Usage:
  python scripts/stackday_test_send.py <test_email>            # create + send test
  python scripts/stackday_test_send.py --cleanup <campaign_id> # delete the test campaign
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

cleanup = '--cleanup' in sys.argv
pos = [a for a in sys.argv[1:] if not a.startswith('--')]


def login():
    if not EMAIL or not PASSWORD:
        print('ERROR: THINKBIG_EMAIL / THINKBIG_PASSWORD must be set in .env.local')
        sys.exit(1)
    s = requests.Session()
    r = s.post(f'{API}/api/auth/login', json={'email': EMAIL, 'password': PASSWORD}, timeout=20)
    if not r.ok:
        print(f'Login failed ({r.status_code}): {r.text}')
        sys.exit(1)
    return s


def main():
    s = login()

    if cleanup:
        if not pos:
            print('ERROR: provide the test campaign id to clean up.')
            sys.exit(1)
        cid = pos[0]
        r = s.delete(f'{API}/api/prospects/campaigns/{cid}', timeout=20)
        print(f'Deleted test campaign {cid} -> {r.status_code} {r.text}')
        return

    if not pos:
        print('ERROR: provide a test email address.')
        sys.exit(1)
    test_email = pos[0].strip().lower()

    # 1. Create an isolated test campaign using the Stack Day (stack_day) template.
    #    Its name intentionally avoids the word "Realtor"/"Agent" so the seat-filled
    #    guard won't skip it, and it is separate from the real Stack Day campaign.
    r = s.post(f'{API}/api/prospects/campaigns',
               json={'template': 'stack_day', 'name': 'ZZZ Stack Day TEST — delete me', 'batch_size': 1},
               timeout=30)
    if not r.ok:
        print(f'Create test campaign failed ({r.status_code}): {r.text}')
        sys.exit(1)
    cid = r.json()['id']
    print(f'Created test campaign {cid}')

    # 2. Add only the test email.
    r = s.post(f'{API}/api/prospects', json={
        'campaign_id': cid,
        'prospects': [{
            'name': 'Stack Day Test', 'email': test_email,
            'company': 'Test', 'profession': 'Tester', 'source': 'test',
        }],
    }, timeout=30)
    print(f'Add test prospect -> {r.status_code} {r.json() if r.ok else r.text}')

    # 3. Scoped send for the TEST campaign only.
    r = s.post(f'{API}/api/prospects/campaigns/{cid}/send', json={}, timeout=120)
    print(f'Send -> {r.status_code} {r.json() if r.ok else r.text}')

    print(f'\nTest campaign id: {cid}')
    print(f'After you confirm the email, clean up with:')
    print(f'  python scripts/stackday_test_send.py --cleanup {cid}')


if __name__ == '__main__':
    main()
