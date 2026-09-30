#!/usr/bin/env python3
"""
Stack Day real send — set batch_size and trigger ONE scoped batch.

Usage:
  python scripts/stackday_send.py --batch 100          # set batch_size only
  python scripts/stackday_send.py --batch 100 --send    # set batch_size AND send one batch
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
STACK_DAY = '6a9740867aa5574a5330abf6'


def arg_val(flag, default=None):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


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
    batch = int(arg_val('--batch', '100'))
    do_send = '--send' in sys.argv
    s = login()

    r = s.patch(f'{API}/api/prospects/campaigns/{STACK_DAY}',
                json={'batch_size': batch}, timeout=20)
    print(f'Set batch_size={batch} -> {r.status_code} {r.json() if r.ok else r.text}')

    if not do_send:
        print('batch_size set. No send triggered (add --send to send one batch now).')
        return

    r = s.post(f'{API}/api/prospects/campaigns/{STACK_DAY}/send', json={}, timeout=300)
    if r.ok:
        d = r.json()
        print(f'Send -> {r.status_code}  sent={d.get("sent")}  errors={d.get("errors")}  skipped={d.get("skipped")}')
        print(f'  full: {d.get("results")}')
    else:
        print(f'Send FAILED ({r.status_code}): {r.text}')


if __name__ == '__main__':
    main()
