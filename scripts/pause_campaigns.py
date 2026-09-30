#!/usr/bin/env python3
"""
Pause (deactivate) specific outbound campaigns by id via the deployed API.
Reads THINKBIG_EMAIL / THINKBIG_PASSWORD from .env.local.

Usage:
  python scripts/pause_campaigns.py <id> [<id> ...]
  python scripts/pause_campaigns.py --activate <id> [<id> ...]   # re-enable instead
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

if not EMAIL or not PASSWORD:
    print('ERROR: THINKBIG_EMAIL and THINKBIG_PASSWORD must be set in .env.local')
    sys.exit(1)

args = sys.argv[1:]
activate = False
if args and args[0] == '--activate':
    activate = True
    args = args[1:]

ids = args
if not ids:
    print('ERROR: provide one or more campaign ids.')
    sys.exit(1)

s = requests.Session()
login = s.post(f'{API}/api/auth/login', json={'email': EMAIL, 'password': PASSWORD}, timeout=20)
if not login.ok:
    print(f'Login failed ({login.status_code}): {login.text}')
    sys.exit(1)
print(f'Logged in. Setting active={activate} on {len(ids)} campaign(s):\n')

for cid in ids:
    r = s.patch(f'{API}/api/prospects/campaigns/{cid}',
                json={'active': activate}, timeout=20)
    if r.ok:
        data = r.json()
        print(f'  {cid} -> active={data.get("active")}')
    else:
        print(f'  {cid} -> FAILED ({r.status_code}): {r.text}')
