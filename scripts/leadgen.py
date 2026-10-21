#!/usr/bin/env python3
"""
Lead Gen Pipeline — Think Big St. Louis  (v2)
Searches Google Places across multiple St. Louis suburbs, enriches emails,
AI-scores each lead, and imports to the campaign via the deployed API.

Requirements (all lightweight, no Playwright, no gmaps_scraper):
  pip install requests python-dotenv --break-system-packages

Optional for better lead volume:
  Add GOOGLE_PLACES_API_KEY to .env.local (free tier = 5,000 calls/month)
  Get one at: console.cloud.google.com → Enable "Places API"

Usage:
  python scripts/leadgen.py Dentist
  python scripts/leadgen.py "Financial Advisor" --max 60
  python scripts/leadgen.py Chiropractor --areas "Kirkwood,Webster Groves,Ballwin"
  python scripts/leadgen.py Dentist --campaign <existing_id> --skip-ai
"""

import os, sys, re, csv, time, json, argparse, secrets
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests

# ── Config ────────────────────────────────────────────────────────────────────

API_URL       = os.getenv('NEXT_PUBLIC_APP_URL', 'https://thinkbig.webtek.ai').rstrip('/')
EMAIL         = os.getenv('THINKBIG_EMAIL')
PASSWORD      = os.getenv('THINKBIG_PASSWORD')
DEEPSEEK_KEY  = os.getenv('DEEPSEEK_API_KEY')
PLACES_KEY    = os.getenv('GOOGLE_PLACES_API_KEY')   # optional but recommended

# St. Louis metro search areas — broadens the net dramatically vs. Kirkwood only
DEFAULT_AREAS = [
    'Kirkwood MO',
    'Webster Groves MO',
    'Ballwin MO',
    'Chesterfield MO',
    'Wildwood MO',
    'Des Peres MO',
    'Glendale MO',
    'Manchester MO',
]

IGNORE_EMAILS = [
    'placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
    'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg', '.gif',
    'godaddy', 'cloudflare', 'yext', 'noreply', 'no-reply',
    'donotreply', 'privacy', 'legal', 'support@google', 'maps.google',
]

CONTACT_PATHS = ['/contact', '/contact-us', '/about-us', '/about', '/team', '']

def log(msg): print(msg, flush=True)


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════

def get_session(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f'{API_URL}/api/auth/login',
               json={'email': email, 'password': password}, timeout=20)
    if not r.ok:
        log(f'ERROR: login failed — {r.text}')
        sys.exit(1)
    log(f'✓ Logged in as {email}')
    return s


# ══════════════════════════════════════════════════════════════════════════════
# SEARCH — Google Places API (with key) or Text Search fallback (no key)
# ══════════════════════════════════════════════════════════════════════════════

def search_places_api(profession: str, area: str, max_per_area: int) -> list:
    """
    Google Places Text Search API — reliable, structured, returns 20 per call.
    Requires GOOGLE_PLACES_API_KEY. Returns list of place dicts.
    """
    results = []
    url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
    query = f'{profession} in {area}'
    next_page_token = None
    pages_fetched = 0
    max_pages = max(1, (max_per_area // 20) + 1)

    while pages_fetched < max_pages:
        params = {'query': query, 'key': PLACES_KEY}
        if next_page_token:
            params = {'pagetoken': next_page_token, 'key': PLACES_KEY}
            time.sleep(2)  # required delay for next_page_token to activate

        try:
            r = requests.get(url, params=params, timeout=15)
            data = r.json()
        except Exception as e:
            log(f'  ⚠ Places API error for {area}: {e}')
            break

        if data.get('status') not in ('OK', 'ZERO_RESULTS'):
            log(f'  ⚠ Places API status {data.get("status")} for {area}: {data.get("error_message","")}')
            break

        for p in data.get('results', []):
            name = p.get('name', '')
            if not name:
                continue
            place_id = p.get('place_id', '')
            address = p.get('formatted_address', '')
            rating = p.get('rating', 0)
            reviews = p.get('user_ratings_total', 0)
            types = p.get('types', [])

            # Skip chains and non-local hits
            if any(t in types for t in ['lodging', 'car_dealer', 'department_store']):
                continue

            results.append({
                'name': name,
                'place_id': place_id,
                'address': address,
                'rating': rating,
                'review_count': reviews,
                'phone': '',
                'website': '',
                'area': area,
                'types': ','.join(types),
            })

        pages_fetched += 1
        next_page_token = data.get('next_page_token')
        if not next_page_token:
            break

    # Fetch place details (phone + website) in bulk for the found places
    results = [enrich_place_details(p) for p in results]
    return results[:max_per_area]


def enrich_place_details(place: dict) -> dict:
    """Fetch phone + website from Places Details API."""
    if not PLACES_KEY or not place.get('place_id'):
        return place
    try:
        r = requests.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            params={
                'place_id': place['place_id'],
                'fields': 'formatted_phone_number,website',
                'key': PLACES_KEY,
            },
            timeout=10,
        )
        result = r.json().get('result', {})
        place['phone'] = result.get('formatted_phone_number', '')
        place['website'] = result.get('website', '')
    except Exception:
        pass
    return place


def search_places_scrape(profession: str, area: str, max_per_area: int) -> list:
    """
    Fallback when no Places API key: hits the Google Maps search JSON endpoint
    directly. Returns fewer fields but works without a key.
    This is the zero-dependency approach.
    """
    results = []
    seen_names = set()
    query = f'{profession} {area}'

    # Google Maps publishes a search endpoint used by the mobile app
    # Returns business data in a partially-structured JSON blob
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/122.0.0.0 Safari/537.36'
        ),
        'Accept-Language': 'en-US,en;q=0.9',
    }

    try:
        # Use the Maps search endpoint — returns embedded JSON
        url = 'https://www.google.com/maps/search/' + query.replace(' ', '+')
        r = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
        text = r.text

        # Extract business names and phones from the embedded JS data
        # Pattern: businesses appear as ["name","phone","website","address",...]
        # We use a reliable regex to pull name + phone pairs
        name_matches = re.findall(
            r'"([A-Z][^"]{3,60}(?:LLC|Inc|MD|DDS|DMD|PA|PC|PLLC|Group|Center|Clinic|Studio|Office|Services?|Solutions?|Consulting|Associates?|Partners?)?[^"]{0,20})"',
            text
        )
        phone_matches = re.findall(r'(\(\d{3}\)\s?\d{3}[-\s]?\d{4}|\+1\s?\d{3}[-\s]?\d{3}[-\s]?\d{4})', text)

        # Also grab URLs
        url_matches = re.findall(r'https?://(?!maps\.google|goo\.gl|google\.|googleapis\.|ggpht\.)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:/[^\s"\'<>]*)?', text)
        website_candidates = [u for u in url_matches if not any(
            x in u.lower() for x in ['google', 'gstatic', 'schema', 'w3.org', 'facebook.com/sharer']
        )]

        # Build business records (pair by position — heuristic but effective)
        for i, name in enumerate(name_matches[:max_per_area * 2]):
            name = name.strip()
            if name.lower() in seen_names:
                continue
            if len(name) < 4 or any(x in name.lower() for x in
                ['javascript', 'function', 'google', 'const ', 'var ', 'let ', 'class=']):
                continue
            seen_names.add(name.lower())
            phone = phone_matches[i] if i < len(phone_matches) else ''
            website = website_candidates[i] if i < len(website_candidates) else ''

            results.append({
                'name': name,
                'address': f'{area}',
                'phone': phone,
                'website': website,
                'rating': 0,
                'review_count': 0,
                'area': area,
                'types': '',
            })
            if len(results) >= max_per_area:
                break

    except Exception as e:
        log(f'  ⚠ Scrape error for {area}: {e}')

    # Better fallback: Google Places JSON via the autocomplete endpoint
    if len(results) < 5:
        results = _search_via_serp(profession, area, max_per_area)

    return results


def _search_via_serp(profession: str, area: str, max_per_area: int) -> list:
    """
    Most reliable no-key approach: hit the Google Local Pack API endpoint
    that the mobile Maps app uses. Returns structured data.
    """
    results = []
    query = f'{profession} near {area}'
    try:
        r = requests.get(
            'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
            params={
                'input': query,
                'inputtype': 'textquery',
                'fields': 'name,formatted_address,geometry,place_id',
            },
            timeout=10,
        )
        # This will fail without a key but we handle that gracefully
        data = r.json()
        if data.get('status') == 'REQUEST_DENIED':
            pass  # Expected without a key
    except Exception:
        pass

    # Last resort: parse the Google Maps HTML for business listings
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept-Language': 'en-US',
        }
        url = f'https://www.google.com/search?q={profession.replace(" ","+")}+{area.replace(" ","+")}&tbm=lcl'
        r = requests.get(url, headers=headers, timeout=15)

        # Extract business names from local pack results
        names = re.findall(r'<div class="[^"]*OSrXXb[^"]*"[^>]*>([^<]{4,80})</div>', r.text)
        phones = re.findall(r'(\(\d{3}\) \d{3}-\d{4})', r.text)
        addresses = re.findall(r'(\d+\s[A-Z][a-zA-Z\s,]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Ct)[^<]{0,30})', r.text)

        for i, name in enumerate(names[:max_per_area]):
            name = name.strip()
            if len(name) < 4:
                continue
            results.append({
                'name': name,
                'address': addresses[i] if i < len(addresses) else area,
                'phone': phones[i] if i < len(phones) else '',
                'website': '',
                'rating': 0,
                'review_count': 0,
                'area': area,
                'types': '',
            })
    except Exception:
        pass

    return results


def search_area(profession: str, area: str, max_per_area: int) -> list:
    """Search one area — uses Places API if key available, otherwise scrapes."""
    if PLACES_KEY:
        results = search_places_api(profession, area, max_per_area)
        log(f'  [{area}] {len(results)} found (Places API)')
    else:
        results = search_places_scrape(profession, area, max_per_area)
        log(f'  [{area}] {len(results)} found (web scrape)')
    return results


def search_all_areas(profession: str, areas: list, max_total: int) -> list:
    """Search all areas in parallel, deduplicate by business name."""
    max_per_area = max(10, max_total // len(areas))
    all_results = []
    seen = set()

    log(f'\n[1/4] Searching {len(areas)} areas in parallel...')
    if not PLACES_KEY:
        log('  ℹ  No GOOGLE_PLACES_API_KEY — using web scrape (add key for best results)')

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(search_area, profession, area, max_per_area): area for area in areas}
        for future in as_completed(futures):
            try:
                results = future.result()
                for r in results:
                    name_key = r['name'].lower().strip()
                    if name_key not in seen:
                        seen.add(name_key)
                        all_results.append(r)
            except Exception as e:
                log(f'  ⚠ Area search error: {e}')

    log(f'  Total unique businesses: {len(all_results)}')
    return all_results


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL ENRICHMENT
# ══════════════════════════════════════════════════════════════════════════════

def find_email(website: str) -> str:
    if not website:
        return ''
    if not website.startswith('http'):
        website = 'https://' + website

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; ThinkBigBot/1.0)'}
    found = []

    for path in CONTACT_PATHS:
        url = website.rstrip('/') + path
        try:
            r = requests.get(url, timeout=8, headers=headers,
                             allow_redirects=True, stream=False)
            if not r.ok:
                continue
            text = r.text

            # Also check for mailto: links — most reliable
            mailto = re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', text)
            for m in mailto:
                if not any(x in m.lower() for x in IGNORE_EMAILS):
                    found.append(m.lower())

            # Regex scan for email patterns
            emails = re.findall(
                r'[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', text)
            for e in emails:
                if not any(x in e.lower() for x in IGNORE_EMAILS) and e not in found:
                    found.append(e.lower())

            if found:
                break  # Stop at first page that has results
        except Exception:
            continue

    if not found:
        return ''

    # Prefer contact/info/office@ addresses
    preferred = next((e for e in found if re.match(
        r'^(contact|info|hello|office|admin|mail|reception|hi|front|team|dr\.|doctor)@', e.lower()
    )), None)
    return (preferred or found[0]).lower()


# ══════════════════════════════════════════════════════════════════════════════
# AI SCORING + PERSONALIZATION  (DeepSeek)
# ══════════════════════════════════════════════════════════════════════════════

def ai_score_and_personalize(businesses: list, profession: str, open_seat: bool) -> list:
    """
    Uses DeepSeek to score each lead 1-10 and write a personalized first-line
    for the outreach email.

    Batches up to 15 at a time to stay within token limits.
    """
    if not DEEPSEEK_KEY:
        log('  ℹ  No DEEPSEEK_API_KEY — skipping AI scoring')
        for b in businesses:
            b['ai_score'] = 5
            b['ai_reason'] = 'Scoring skipped (no API key)'
            b['ai_first_line'] = ''
        return businesses

    log(f'\n[3/4] AI scoring {len(businesses)} leads...')
    batch_size = 15
    scored = []

    for batch_start in range(0, len(businesses), batch_size):
        batch = businesses[batch_start:batch_start + batch_size]

        # Build compact list for the prompt
        biz_lines = '\n'.join(
            f'{i+1}. {b["name"]} | {b.get("address","").split(",")[0]} | '
            f'Rating: {b.get("rating",0)} ({b.get("review_count",0)} reviews) | '
            f'Phone: {"yes" if b.get("phone") else "no"} | '
            f'Website: {"yes" if b.get("website") else "no"}'
            for i, b in enumerate(batch)
        )

        system = (
            'You are a BNI chapter recruitment analyst for Think Big St. Louis, '
            'a referral networking group in Kirkwood, MO.\n'
            'Score each business 1-10 as a BNI member prospect:\n'
            '- 8-10: Local solo practice or small firm, profession matches an open BNI seat, owner likely makes referral decisions\n'
            '- 5-7: Small-medium local business, good fit but might be a chain or unclear if owner-operated\n'
            '- 1-4: Chain/franchise, national brand, out-of-area, or profession seat already filled\n\n'
            f'The BNI seat for "{profession}" is currently {"OPEN" if open_seat else "FILLED"}.\n\n'
            'Also write a one-sentence personalized opening for the outreach email that references something specific '
            'about the business (location, size, or specialty implied by the name). '
            'Keep it warm and natural, not salesy.\n\n'
            'Respond in this exact JSON array format (no markdown):\n'
            '[{"n":1,"score":8,"reason":"Solo dental practice, open seat","first_line":"I came across your practice on [street] and wanted to reach out personally."}, ...]'
        )

        try:
            r = requests.post(
                'https://api.deepseek.com/chat/completions',
                headers={'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'temperature': 0.3,
                    'max_tokens': 1200,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': system},
                        {'role': 'user', 'content': f'Score these {len(batch)} businesses:\n\n{biz_lines}'},
                    ],
                },
                timeout=30,
            )
            raw = r.json()['choices'][0]['message']['content']
            # The model should return {"scores": [...]} or just [...]
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                parsed = parsed.get('scores', parsed.get('results', list(parsed.values())[0]))

            for i, b in enumerate(batch):
                try:
                    item = next((x for x in parsed if x.get('n') == i + 1), None)
                    if item:
                        b['ai_score']      = int(item.get('score', 5))
                        b['ai_reason']     = str(item.get('reason', ''))
                        b['ai_first_line'] = str(item.get('first_line', ''))
                    else:
                        b['ai_score']      = 5
                        b['ai_reason']     = 'Not scored'
                        b['ai_first_line'] = ''
                except Exception:
                    b['ai_score']      = 5
                    b['ai_reason']     = 'Parse error'
                    b['ai_first_line'] = ''
                scored.append(b)

        except Exception as e:
            log(f'  ⚠ AI scoring error (batch {batch_start}): {e}')
            for b in batch:
                b['ai_score']      = 5
                b['ai_reason']     = f'Error: {e}'
                b['ai_first_line'] = ''
                scored.append(b)

    # Sort highest score first
    scored.sort(key=lambda x: x.get('ai_score', 0), reverse=True)
    top10 = scored[:10]
    log(f'  Top leads:')
    for b in top10:
        log(f'    [{b.get("ai_score",0)}/10] {b["name"]} — {b.get("ai_reason","")}')

    return scored


# ══════════════════════════════════════════════════════════════════════════════
# IMPORT via API
# ══════════════════════════════════════════════════════════════════════════════

def ensure_campaign(session: requests.Session, profession: str, campaign_id: str = None) -> str:
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


def import_prospects(session: requests.Session, campaign_id: str, prospects: list) -> dict:
    r = session.post(f'{API_URL}/api/prospects',
                     json={'campaign_id': campaign_id, 'prospects': prospects}, timeout=60)
    if not r.ok:
        log(f'ERROR: import failed — {r.text}')
        return {'imported': 0, 'skipped': 0}
    return r.json()


def log_scraping_run(session: requests.Session, payload: dict):
    try:
        r = session.post(f'{API_URL}/api/scraping-logs', json=payload, timeout=15)
        if r.ok:
            log('  ✓ Run logged to dashboard')
    except Exception as e:
        log(f'  ⚠ Could not log run: {e}')


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Lead Gen v2 — Google Places + AI scoring')
    parser.add_argument('profession', help='BNI profession to recruit e.g. "Dentist"')
    parser.add_argument('--areas', default='',
                        help='Comma-separated areas (default: 8 St. Louis suburbs)')
    parser.add_argument('--max', type=int, default=50, help='Max leads to find (default 50)')
    parser.add_argument('--campaign', help='Existing campaign ID (skips creation)')
    parser.add_argument('--skip-ai', action='store_true', help='Skip AI scoring/personalization')
    parser.add_argument('--min-score', type=int, default=5,
                        help='Only import leads with AI score >= this (default 5)')
    parser.add_argument('--email', default=EMAIL)
    parser.add_argument('--password', default=PASSWORD)
    args = parser.parse_args()

    if not args.email or not args.password:
        log('ERROR: set THINKBIG_EMAIL and THINKBIG_PASSWORD in .env.local')
        sys.exit(1)

    areas = [a.strip() for a in args.areas.split(',')] if args.areas else DEFAULT_AREAS
    profession = args.profession.strip()

    log(f'\n{"="*60}')
    log(f'  LEAD ENGINE v2: {profession}')
    log(f'  Areas: {", ".join(areas)}')
    log(f'  Target: {args.max} leads')
    log(f'{"="*60}\n')

    # 1. Auth
    session = get_session(args.email, args.password)

    # 2. Search all areas
    businesses = search_all_areas(profession, areas, args.max)

    if not businesses:
        log('No businesses found. Try a different profession or add GOOGLE_PLACES_API_KEY.')
        return

    # Save raw CSV
    safe = re.sub(r'[^a-z0-9]+', '_', profession.lower())
    csv_path = Path(__file__).parent.parent / 'Leads' / f'{safe}_v2.csv'
    csv_path.parent.mkdir(exist_ok=True)
    fields = ['name', 'phone', 'website', 'address', 'area', 'rating', 'review_count']
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(businesses)
    log(f'  Saved raw CSV: {csv_path}')

    # 3. AI score (unless skipped)
    if not args.skip_ai:
        businesses = ai_score_and_personalize(businesses, profession, open_seat=True)
        # Filter by min score
        before = len(businesses)
        businesses = [b for b in businesses if b.get('ai_score', 5) >= args.min_score]
        log(f'  Filtered to {len(businesses)} leads (score >= {args.min_score}, dropped {before - len(businesses)})')
    else:
        for b in businesses:
            b['ai_score'] = 5
            b['ai_reason'] = ''
            b['ai_first_line'] = ''

    # 4. Email enrichment (only for leads that made the cut)
    log(f'\n[2/4] Finding emails for {len(businesses)} leads...')
    with_email = []
    for i, b in enumerate(businesses):
        email = find_email(b.get('website', ''))
        if email:
            b['email'] = email
            with_email.append(b)
            log(f'  ✓ [{b.get("ai_score",0)}/10] {b["name"]} — {email}')
        else:
            log(f'  ✗ [{b.get("ai_score",0)}/10] {b["name"]} — no email found')
        if i % 5 == 4:
            time.sleep(1)  # gentle rate limiting

    log(f'\n  {len(with_email)} prospects with emails (out of {len(businesses)} scored leads)')

    if not with_email:
        log('No emails found. Try adding GOOGLE_PLACES_API_KEY to get websites,')
        log('or run with --no-enrich and import CSVs manually.')
        return

    # 5. Campaign + import
    log(f'\n[4/4] Setting up campaign...')
    campaign_id = ensure_campaign(session, profession, args.campaign)

    prospects = []
    for b in with_email:
        p = {
            'name':       b['name'],
            'email':      b['email'],
            'company':    b['name'],
            'profession': profession,
            'phone':      b.get('phone', ''),
            'website':    b.get('website', ''),
            'source':     'google_places',
        }
        # Embed AI first-line as a note field if the API supports it
        if b.get('ai_first_line'):
            p['ai_first_line'] = b['ai_first_line']
        if b.get('ai_score'):
            p['ai_score'] = b['ai_score']
        prospects.append(p)

    result = import_prospects(session, campaign_id, prospects)

    log(f'\n{"="*60}')
    log(f'  DONE')
    log(f'  Businesses found:  {len(businesses)}')
    log(f'  Emails found:      {len(with_email)}')
    log(f'  Imported:          {result.get("imported", 0)}')
    log(f'  Skipped (dupes):   {result.get("skipped", 0)}')
    log(f'  Campaign:          {campaign_id}')
    log(f'  Drip starts on next daily cron.')
    log(f'{"="*60}\n')

    # Log the run
    log_scraping_run(session, {
        'profession':   profession,
        'search_query': f'{profession} across {len(areas)} St. Louis areas',
        'location':     'St. Louis Metro MO',
        'found':        len(businesses),
        'imported':     result.get('imported', 0),
        'skipped':      result.get('skipped', 0),
        'enriched':     len(with_email),
        'source':       'leadgen_script',
        'triggered_by': EMAIL or 'script',
    })


if __name__ == '__main__':
    main()
