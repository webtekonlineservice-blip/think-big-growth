#!/usr/bin/env python3
"""
List outbound campaigns (id + name) from the deployed API.
Reads THINKBIG_EMAIL / THINKBIG_PASSWORD from .env.local.

Usage:
  python scripts/list_campaigns.py
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

s = requests.Session()

# 1. Log in
login = s.post(f'{API}/api/auth/login', json={'email': EMAIL, 'password': PASSWORD}, timeout=20)
print(f'Login status: {login.status_code}')
if not login.ok:
    print(f'Login failed: {login.text}')
    sys.exit(1)

# 2. Fetch campaigns
resp = s.get(f'{API}/api/prospects/campaigns', timeout=20)
print(f'Campaigns status: {resp.status_code}')

try:
    data = resp.json()
except Exception:
    print(f'Non-JSON response: {resp.text[:300]}')
    sys.exit(1)

# Guard against error objects (dict) vs the expected list
if not isinstance(data, list):
    print(f'Unexpected response (not a list): {data}')
    sys.exit(1)

if not data:
    print('No campaigns found.')
    sys.exit(0)

print('\nCampaigns:')
for c in data:
    print(f"  {c['id']}  —  {c['name']}  (prospects: {c.get('total_prospects', '?')}, active: {c.get('active')})")
