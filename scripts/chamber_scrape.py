#!/usr/bin/env python3
"""
Chamber of Commerce Lead Engine — Think Big St. Louis

Scrapes public member directories from local St. Louis area chambers,
AI-scores each lead against open BNI seats, enriches emails, and imports
to the outbound campaign pipeline.

Chambers supported (all use ChamberMaster platform — same parser):
  - Kirkwood-Des Peres Area Chamber (kirkwooddesperes.com)  ~400 members
  - Chesterfield Regional Chamber   (chesterfieldmochamber.com) ~500 members
  - (extendable: add any ChamberMaster-based directory)

Requirements (no Playwright, no heavy deps):
  pip install requests python-dotenv beautifulsoup4 --break-system-packages

Usage:
  # Scrape all chambers, score, import best leads
  python scripts/chamber_scrape.py

  # Scrape only Kirkwood chamber
  python scripts/chamber_scrape.py --chamber kirkwood

  # Target a specific profession (filters + scores against that seat)
  python scripts/chamber_scrape.py --profession "Financial Advisor"

  # Dry run — scrape + score, print results, don't import
  python scripts/chamber_scrape.py --dry-run

  # Skip AI scoring (faster, imports everything)
  python scripts/chamber_scrape.py --skip-ai

  # Set minimum AI score threshold (default 5)
  python scripts/chamber_scrape.py --min-score 7
"""

import os, sys, re, csv, time, json, argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    pass

import requests
try:
    from bs4 import BeautifulSoup
except ImportError:
    print('ERROR: beautifulsoup4 is required.')
    print('  pip install beautifulsoup4 --break-system-packages')
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

API_URL      = os.getenv('NEXT_PUBLIC_APP_URL', 'https://thinkbig.webtek.ai').rstrip('/')
EMAIL        = os.getenv('THINKBIG_EMAIL')
PASSWORD     = os.getenv('THINKBIG_PASSWORD')
DEEPSEEK_KEY = os.getenv('DEEPSEEK_API_KEY')

CHAMBERS = {
    'kirkwood': {
        'name': 'Kirkwood-Des Peres Area Chamber of Commerce',
        'base_url': 'https://business.kirkwooddesperes.com',
        'alpha_path': '/list/searchalpha/{letter}',
        'note': '~400 members, Kirkwood + Des Peres area',
    },
    'chesterfield': {
        'name': 'Chesterfield Regional Chamber of Commerce',
        'base_url': 'https://www.chesterfieldmochamber.com',
        'alpha_path': '/list/searchalpha/{letter}',
        'note': '~500 members, Chesterfield / west St. Louis County',
    },
}

ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

# Professions that map to open BNI seats (update as seats fill)
BNI_SEAT_PROFESSIONS = [
    'Accountant', 'CPA', 'Attorney', 'Lawyer',
    'Auto Sales', 'Banker', 'Business Coach',
    'Chiropractor', 'Contractor', 'Builder',
    'Dentist', 'Digital Marketing', 'Event Planner',
    'Financial Advisor', 'Florist', 'Health Wellness',
    'Home Inspector', 'HR Consultant', 'Insurance',
    'Interior Designer', 'IT', 'Tech Consultant',
    'Landscaper', 'Life Coach', 'Marketing',
    'Mortgage', 'Nutritionist', 'Photographer',
    'Physical Therapist', 'Printer', 'Promotional',
    'Property Manager', 'Realtor', 'Real Estate',
    'Recruiter', 'Solar', 'Energy', 'Tax Consultant',
    'Travel Agent', 'Videographer', 'Web Designer',
    'Web Developer', 'Plumber', 'HVAC', 'Electrician',
    'Pest Control', 'Roofing', 'Flooring', 'Painting',
]

IGNORE_EMAILS = [
    'placeholder', 'example.com', 'sentry', 'schema.org', 'w3.org',
    'wix', 'squarespace', 'wordpress', 'jquery', '.png', '.jpg',
    'godaddy', 'cloudflare', 'yext', 'noreply', 'no-reply',
    'donotreply', 'privacy', 'legal', 'support@google',
]

CONTACT_PATHS = ['/contact', '/contact-us', '/about', '']

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/122.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

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
# CHAMBER DIRECTORY SCRAPER (ChamberMaster platform)
# ══════════════════════════════════════════════════════════════════════════════

def scrape_alpha_page(base_url: str, path_template: str, letter: str) -> list:
    """Scrape one alphabetical page of a ChamberMaster directory."""
    url = base_url + path_template.format(letter=letter)
    try:
        r = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if not r.ok:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        return parse_chambermaster_page(soup, base_url)
    except Exception as e:
        log(f'    ⚠ Error fetching {url}: {e}')
        return []


def parse_chambermaster_page(soup: BeautifulSoup, base_url: str) -> list:
    """
    Parse the ChamberMaster member listing HTML.
    Each member card has: name (h2/h3), description (p), address parts,
    phone, and a "Visit Website" link.
    """
    members = []

    # ChamberMaster uses various card containers — try multiple selectors
    # Primary: .gz-member-info or .listingsContainer or .member-listing
    cards = (
        soup.select('.gz-member-info') or
        soup.select('.list-card') or
        soup.select('article.list') or
        soup.select('[class*="member"]') or
        soup.select('li.listingsContainer')
    )

    if not cards:
        # Fallback: look for any block containing phone patterns
        all_text = soup.get_text('\n', strip=True)
        return _parse_text_fallback(all_text, base_url)

    for card in cards:
        text = card.get_text('\n', strip=True)
        lines = [l.strip() for l in text.split('\n') if l.strip()]

        # Name: usually the first non-empty line or an h2/h3
        name_el = card.find(['h2', 'h3', 'h4', '.gz-member-name', '.title'])
        name = name_el.get_text(strip=True) if name_el else (lines[0] if lines else '')
        if not name or len(name) < 3:
            continue

        # Phone: match (xxx) xxx-xxxx or xxx-xxx-xxxx
        phone = ''
        phone_match = re.search(r'(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})', text)
        if phone_match:
            phone = phone_match.group(1).strip()

        # Website: "Visit Website" anchor or any http link
        website = ''
        for a in card.find_all('a', href=True):
            href = a['href']
            atext = a.get_text(strip=True).lower()
            if 'visit' in atext and 'website' in atext:
                if href.startswith('http') and 'kirkwooddesperes.com' not in href and 'chesterfieldmochamber.com' not in href:
                    website = href
                    break
        # Fallback: any external link
        if not website:
            for a in card.find_all('a', href=True):
                href = a['href']
                if href.startswith('http') and base_url.split('/')[2] not in href and not href.startswith('#'):
                    website = href
                    break

        # Address: find city/state/zip pattern
        address = ''
        addr_match = re.search(
            r'(\d+[^,\n]+(?:Rd|St|Ave|Blvd|Dr|Ln|Way|Pkwy|Ct|Hwy|Road|Street|Avenue|Drive)[^,\n]*),?\s*([A-Za-z\s]+),?\s*(MO|IL)\s*(\d{5})',
            text, re.I
        )
        if addr_match:
            address = addr_match.group(0).strip()

        # City from address
        city = ''
        city_match = re.search(r'(Kirkwood|Des Peres|Webster Groves|Chesterfield|Ballwin|Wildwood|Manchester|Glendale|Fenton|St\. Louis|Saint Louis|Sunset Hills|Crestwood)', text, re.I)
        if city_match:
            city = city_match.group(1)

        # Description (first descriptive paragraph, not address)
        description = ''
        for p in card.find_all('p'):
            pt = p.get_text(strip=True)
            if pt and len(pt) > 30 and not re.search(r'\d{3}[-.\s]\d{4}', pt):
                description = pt[:200]
                break

        members.append({
            'name': name,
            'phone': phone,
            'website': website,
            'address': address,
            'city': city,
            'description': description,
        })

    return members


def _parse_text_fallback(text: str, base_url: str) -> list:
    """
    When CSS selectors don't match, parse the raw text for business patterns.
    Looks for blocks: business name → optional description → phone → website.
    """
    members = []
    # Split on phone number patterns as section separators
    sections = re.split(r'(?=\(\d{3}\) \d{3}-\d{4})', text)

    for section in sections:
        lines = [l.strip() for l in section.split('\n') if l.strip() and len(l.strip()) > 2]
        if not lines:
            continue

        # Phone
        phone_match = re.search(r'\((\d{3})\) (\d{3}-\d{4})', section)
        if not phone_match:
            continue
        phone = phone_match.group(0)

        # Name: line before the phone, skip common junk
        name = lines[0] if lines else ''
        if len(name) < 3 or name.lower() in ('results found', 'visit website', 'directions'):
            continue

        # Website
        url_match = re.search(r'https?://(?!maps\.google|goo\.gl|google\.)[^\s"\'<>]+', section)
        website = url_match.group(0) if url_match else ''

        members.append({
            'name': name.strip(),
            'phone': phone,
            'website': website,
            'address': '',
            'city': '',
            'description': '',
        })

    return members


def scrape_chamber(chamber_key: str, max_pages: int = 26) -> list:
    """Scrape all alphabetical pages of one chamber directory."""
    cfg = CHAMBERS[chamber_key]
    log(f'\n  Scraping {cfg["name"]}...')
    log(f'  ({cfg["note"]})')

    all_members = []
    seen_names = set()
    letters = ALPHABET[:max_pages]

    for letter in letters:
        time.sleep(0.3)  # polite crawl rate
        results = scrape_alpha_page(cfg['base_url'], cfg['alpha_path'], letter)
        new = 0
        for m in results:
            key = m['name'].lower().strip()
            if key not in seen_names and len(m['name']) > 2:
                seen_names.add(key)
                m['chamber'] = cfg['name']
                all_members.append(m)
                new += 1
        if new > 0:
            log(f'    [{letter.upper()}] {new} members')

    log(f'  ✓ {len(all_members)} unique members from {cfg["name"]}')
    return all_members


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
            r = requests.get(url, timeout=8, headers=headers, allow_redirects=True)
            if not r.ok:
                continue
            # mailto links first — most reliable
            for m in re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', r.text):
                if not any(x in m.lower() for x in IGNORE_EMAILS):
                    found.append(m.lower())
            # regex scan
            for e in re.findall(r'[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', r.text):
                if not any(x in e.lower() for x in IGNORE_EMAILS) and e not in found:
                    found.append(e.lower())
            if found:
                break
        except Exception:
            continue

    if not found:
        return ''
    # Prefer contact/info@ style addresses
    preferred = next((e for e in found if re.match(
        r'^(contact|info|hello|office|admin|mail|reception|hi|front|team)@', e.lower()
    )), None)
    return (preferred or found[0]).lower()


# ══════════════════════════════════════════════════════════════════════════════
# AI SCORING (DeepSeek)
# ══════════════════════════════════════════════════════════════════════════════

def guess_profession(description: str, name: str) -> str:
    """Heuristic profession guess from business name + description."""
    combined = f'{name} {description}'.lower()
    keywords = {
        'Financial Advisor': ['financial advisor', 'financial planning', 'investment', 'wealth management', 'edward jones', 'raymond james', 'ameriprise'],
        'Insurance Agent': ['insurance', 'state farm', 'allstate', 'farmers', 'nationwide', 'liberty mutual'],
        'Realtor': ['real estate', 'realtor', 'realty', 'homes for sale', 'property'],
        'Mortgage Broker': ['mortgage', 'home loan', 'refinance', 'guild mortgage', 'quicken'],
        'Attorney': ['attorney', 'lawyer', 'law firm', 'legal', 'counsel'],
        'Accountant': ['accountant', 'cpa', 'accounting', 'tax preparation', 'bookkeeping'],
        'Dentist': ['dentist', 'dental', 'orthodontist', 'oral', 'teeth'],
        'Chiropractor': ['chiropractic', 'chiropractor', 'spine', 'alignment'],
        'Contractor': ['contractor', 'construction', 'remodeling', 'builder', 'renovation'],
        'IT Consultant': ['it services', 'managed it', 'technology', 'cybersecurity', 'network'],
        'Marketing Consultant': ['marketing', 'advertising', 'branding', 'digital marketing', 'seo'],
        'Web Developer': ['web design', 'web development', 'website', 'software'],
        'Photographer': ['photography', 'photographer', 'photo studio', 'headshots'],
        'Landscaper': ['landscaping', 'lawn care', 'landscaper', 'lawn service'],
        'Plumber': ['plumbing', 'plumber'],
        'Electrician': ['electrical', 'electrician'],
        'HVAC': ['hvac', 'heating', 'cooling', 'air conditioning'],
        'Physical Therapist': ['physical therapy', 'physical therapist', 'pt clinic'],
        'Nutritionist': ['nutritionist', 'nutrition', 'dietitian', 'wellness'],
        'Event Planner': ['event planning', 'event planner', 'catering', 'venue'],
        'Flooring': ['flooring', 'hardwood', 'carpet', 'tile'],
        'Roofing': ['roofing', 'roofer', 'roof'],
        'Painting': ['painting', 'painter', 'paint'],
    }
    for profession, terms in keywords.items():
        if any(t in combined for t in terms):
            return profession
    return ''


def ai_score_batch(members: list, open_seats: list) -> list:
    """Score a batch of chamber members against open BNI seats using DeepSeek."""
    if not DEEPSEEK_KEY:
        log('  ℹ  No DEEPSEEK_API_KEY — using heuristic scoring')
        return heuristic_score(members, open_seats)

    batch_size = 20
    scored_all = []

    open_seat_str = ', '.join(open_seats[:15]) if open_seats else 'various professions'

    for batch_start in range(0, len(members), batch_size):
        batch = members[batch_start:batch_start + batch_size]

        biz_lines = '\n'.join(
            f'{i+1}. {b["name"]} | {b.get("city","")}'
            f'{" | " + b["description"][:80] if b.get("description") else ""}'
            for i, b in enumerate(batch)
        )

        system = f"""You are a BNI chapter analyst for Think Big St. Louis in Kirkwood, MO.
Score each chamber member business 1-10 as a BNI prospect:

SCORING GUIDE:
- 9-10: Small local business, profession maps exactly to an open BNI seat, clearly owner-operated
- 7-8:  Local business, good profession match, small firm likely owner-operated
- 5-6:  Local business, profession could fill a seat but less clear fit
- 3-4:  Unclear profession, might be a chain, or seat may already be filled
- 1-2:  National chain, franchise, nonprofit, government, or irrelevant profession

OPEN BNI SEATS (professions we're actively recruiting): {open_seat_str}

BNI is one-per-profession — only one insurance agent, one dentist, etc. per chapter.
Target: small/solo local businesses whose owner would benefit from weekly referrals.
Skip: large corporations, banks, franchises (unless local owner-operators), nonprofits.

Also identify the most likely profession for each business.

Return ONLY valid JSON (no markdown, no explanation):
{{"results": [{{"n": 1, "score": 8, "profession": "Financial Advisor", "reason": "Solo FA practice, open seat"}}, ...]}}"""

        try:
            r = requests.post(
                'https://api.deepseek.com/chat/completions',
                headers={'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'temperature': 0.2,
                    'max_tokens': 1000,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': system},
                        {'role': 'user', 'content': f'Score these {len(batch)} businesses:\n\n{biz_lines}'},
                    ],
                },
                timeout=30,
            )
            raw = r.json()['choices'][0]['message']['content']
            parsed = json.loads(raw)
            items = parsed.get('results', parsed.get('scores', []))

            for i, b in enumerate(batch):
                item = next((x for x in items if x.get('n') == i + 1), None)
                if item:
                    b['ai_score'] = int(item.get('score', 5))
                    b['ai_profession'] = str(item.get('profession', ''))
                    b['ai_reason'] = str(item.get('reason', ''))
                else:
                    b['ai_score'] = 5
                    b['ai_profession'] = guess_profession(b.get('description', ''), b['name'])
                    b['ai_reason'] = 'Not scored in batch'
                scored_all.append(b)

        except Exception as e:
            log(f'  ⚠ AI scoring error (batch {batch_start}): {e}')
            for b in batch:
                b['ai_score'] = 5
                b['ai_profession'] = guess_profession(b.get('description', ''), b['name'])
                b['ai_reason'] = f'Error: {e}'
                scored_all.append(b)

        time.sleep(0.5)  # rate limit

    return scored_all


def heuristic_score(members: list, open_seats: list) -> list:
    """Fallback scoring when no AI key — uses keyword matching."""
    open_lower = [s.lower() for s in open_seats]
    for b in members:
        prof = guess_profession(b.get('description', ''), b['name'])
        b['ai_profession'] = prof
        if prof and any(prof.lower() in s or s in prof.lower() for s in open_lower):
            b['ai_score'] = 7
            b['ai_reason'] = f'Profession "{prof}" matches open BNI seat'
        elif prof:
            b['ai_score'] = 5
            b['ai_reason'] = f'Local business — {prof}'
        else:
            b['ai_score'] = 3
            b['ai_reason'] = 'Profession unclear'
    return members


# ══════════════════════════════════════════════════════════════════════════════
# OPEN SEAT DETECTION  (from the live API)
# ══════════════════════════════════════════════════════════════════════════════

def get_open_seats(api_session) -> list:
    """Fetch open BNI seat professions from the live API."""
    try:
        r = api_session.get(f'{API_URL}/api/categories', timeout=15)
        if r.ok:
            data = r.json()
            return data.get('openCategories', [])
    except Exception:
        pass
    return BNI_SEAT_PROFESSIONS  # fallback to static list


# ══════════════════════════════════════════════════════════════════════════════
# IMPORT via API
# ══════════════════════════════════════════════════════════════════════════════

def ensure_campaign(api_session, profession: str, campaign_id: str = None) -> str:
    if campaign_id:
        return campaign_id
    r = api_session.post(f'{API_URL}/api/prospects/campaigns',
                         json={'profession': profession}, timeout=20)
    if not r.ok:
        log(f'ERROR: campaign creation failed — {r.text}')
        sys.exit(1)
    data = r.json()
    log(f'  ✓ Campaign: "{data["name"]}" ({data["sequence_count"]} emails)')
    return data['id']


def get_or_create_campaign_for_profession(api_session, profession: str, campaign_cache: dict) -> str:
    if profession in campaign_cache:
        return campaign_cache[profession]
    cid = ensure_campaign(api_session, profession)
    campaign_cache[profession] = cid
    return cid


def import_prospects(api_session, campaign_id: str, prospects: list) -> dict:
    r = api_session.post(f'{API_URL}/api/prospects',
                         json={'campaign_id': campaign_id, 'prospects': prospects}, timeout=60)
    if not r.ok:
        log(f'ERROR: import failed — {r.text}')
        return {'imported': 0, 'skipped': 0}
    return r.json()


def log_scraping_run(api_session, payload: dict):
    try:
        r = api_session.post(f'{API_URL}/api/scraping-logs', json=payload, timeout=15)
        if r.ok:
            log(f'  ✓ Run logged to dashboard')
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Chamber of Commerce Lead Engine')
    parser.add_argument('--chamber', choices=list(CHAMBERS.keys()) + ['all'], default='all',
                        help='Which chamber to scrape (default: all)')
    parser.add_argument('--profession', default='',
                        help='Target a specific BNI profession (filters scoring)')
    parser.add_argument('--campaign', default='',
                        help='Existing campaign ID to import all leads into')
    parser.add_argument('--min-score', type=int, default=5,
                        help='Only import leads with AI score >= this (default: 5)')
    parser.add_argument('--skip-ai', action='store_true',
                        help='Skip AI scoring, import all leads above min-score heuristic')
    parser.add_argument('--dry-run', action='store_true',
                        help='Scrape + score but do not import anything')
    parser.add_argument('--no-enrich', action='store_true',
                        help='Skip email enrichment (faster, saves as phone-only)')
    parser.add_argument('--email', default=EMAIL)
    parser.add_argument('--password', default=PASSWORD)
    args = parser.parse_args()

    if not args.email or not args.password:
        log('ERROR: set THINKBIG_EMAIL and THINKBIG_PASSWORD in .env.local')
        sys.exit(1)

    target_chambers = list(CHAMBERS.keys()) if args.chamber == 'all' else [args.chamber]

    log(f'\n{"="*65}')
    log(f'  CHAMBER LEAD ENGINE — Think Big St. Louis')
    log(f'  Chambers: {", ".join(target_chambers)}')
    if args.profession:
        log(f'  Target profession: {args.profession}')
    log(f'  Mode: {"DRY RUN — no import" if args.dry_run else "full pipeline"}')
    log(f'{"="*65}\n')

    # 1. Auth
    api_session = get_session(args.email, args.password)

    # 2. Get open seats from live API
    open_seats = get_open_seats(api_session)
    if args.profession:
        # Put the target profession first for scoring emphasis
        open_seats = [args.profession] + [s for s in open_seats if s != args.profession]
    log(f'Open BNI seats: {len(open_seats)} professions')

    # 3. Scrape chambers
    log(f'\n[1/4] Scraping chamber directories...')
    all_members = []
    for chamber_key in target_chambers:
        members = scrape_chamber(chamber_key)
        all_members.extend(members)

    if not all_members:
        log('No members found. Check your internet connection and try again.')
        return

    # Deduplicate across chambers by name
    seen = set()
    unique_members = []
    for m in all_members:
        key = m['name'].lower().strip()
        if key not in seen:
            seen.add(key)
            unique_members.append(m)
    log(f'\n  Total unique members across all chambers: {len(unique_members)}')

    # 4. AI scoring
    log(f'\n[2/4] AI scoring {len(unique_members)} members...')
    if args.skip_ai:
        scored = heuristic_score(unique_members, open_seats)
    else:
        scored = ai_score_batch(unique_members, open_seats)

    # Filter by min score
    before = len(scored)
    shortlisted = [m for m in scored if m.get('ai_score', 0) >= args.min_score]
    log(f'  Shortlisted: {len(shortlisted)} leads (score >= {args.min_score}, dropped {before - len(shortlisted)})')

    # Further filter to target profession if specified
    if args.profession:
        prof_lower = args.profession.lower()
        target_leads = [m for m in shortlisted if
                        prof_lower in m.get('ai_profession', '').lower() or
                        m.get('ai_score', 0) >= 8]
        log(f'  Profession-filtered: {len(target_leads)} leads for "{args.profession}"')
        shortlisted = target_leads

    # Print top 20 for review
    shortlisted.sort(key=lambda x: x.get('ai_score', 0), reverse=True)
    log(f'\n  Top leads:')
    for b in shortlisted[:20]:
        log(f'    [{b.get("ai_score",0)}/10] {b["name"]} ({b.get("city","")}) '
            f'— {b.get("ai_profession","")} | {b.get("ai_reason","")}')

    if args.dry_run:
        log(f'\n  DRY RUN complete. {len(shortlisted)} leads would be enriched and imported.')

        # Save to CSV for review
        safe = re.sub(r'[^a-z0-9]+', '_', (args.profession or 'all').lower())
        csv_path = Path(__file__).parent.parent / 'Leads' / f'chamber_{safe}_dry_run.csv'
        csv_path.parent.mkdir(exist_ok=True)
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=['name','city','phone','website','ai_score','ai_profession','ai_reason','chamber','description'], extrasaction='ignore')
            w.writeheader()
            w.writerows(shortlisted)
        log(f'  Saved: {csv_path}')
        return

    # 5. Email enrichment
    log(f'\n[3/4] Finding emails for {len(shortlisted)} leads...')
    with_email = []
    without_email = []

    for i, m in enumerate(shortlisted):
        if not args.no_enrich and m.get('website'):
            email = find_email(m['website'])
        else:
            email = ''

        if email:
            m['email'] = email
            with_email.append(m)
            log(f'  ✓ [{m.get("ai_score",0)}/10] {m["name"]} — {email}')
        else:
            # Keep phone-only leads — they can be contacted manually or via SMS
            if m.get('phone'):
                m['email'] = ''
                without_email.append(m)
            log(f'  ✗ [{m.get("ai_score",0)}/10] {m["name"]} — no email (phone: {m.get("phone","none")})')

        if i % 10 == 9:
            time.sleep(1)

    log(f'\n  With email: {len(with_email)} | Phone only: {len(without_email)}')

    # Save full CSV with all scored leads
    safe = re.sub(r'[^a-z0-9]+', '_', (args.profession or 'all').lower())
    csv_path = Path(__file__).parent.parent / 'Leads' / f'chamber_{safe}_scored.csv'
    csv_path.parent.mkdir(exist_ok=True)
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['name','city','phone','email','website','ai_score','ai_profession','ai_reason','chamber','description'], extrasaction='ignore')
        w.writeheader()
        w.writerows(shortlisted)
    log(f'  Saved: {csv_path}')

    if not with_email and not (args.no_enrich and without_email):
        log('  No leads with email to import. Try running without --no-enrich.')
        return

    importable = with_email if not args.no_enrich else shortlisted

    # 6. Import — group by profession into campaigns
    log(f'\n[4/4] Importing {len(importable)} prospects...')

    # Use a single campaign if specified, otherwise create one per profession
    campaign_cache = {}
    if args.campaign:
        campaign_cache['_default'] = args.campaign

    total_imported = 0
    total_skipped = 0
    profession_groups: dict = {}

    for m in importable:
        prof = m.get('ai_profession') or args.profession or 'General'
        if prof not in profession_groups:
            profession_groups[prof] = []
        profession_groups[prof].append(m)

    for prof, leads in profession_groups.items():
        if args.campaign:
            cid = args.campaign
        else:
            cid = get_or_create_campaign_for_profession(api_session, prof, campaign_cache)

        prospects = []
        for m in leads:
            prospects.append({
                'name': m['name'],
                'email': m.get('email', ''),
                'company': m['name'],
                'profession': prof,
                'phone': m.get('phone', ''),
                'website': m.get('website', ''),
                'source': 'chamber_directory',
                'ai_score': m.get('ai_score', 0),
                'ai_first_line': f"I came across {m['name']} through the local chamber of commerce and wanted to reach out personally.",
            })

        result = import_prospects(api_session, cid, prospects)
        total_imported += result.get('imported', 0)
        total_skipped += result.get('skipped', 0)
        log(f'  ✓ [{prof}] Imported {result.get("imported",0)}, skipped {result.get("skipped",0)}')

    # 7. Log the run
    log_scraping_run(api_session, {
        'profession': args.profession or 'Chamber members (all professions)',
        'search_query': f'Chamber directories: {", ".join(target_chambers)}',
        'location': 'Kirkwood / St. Louis Metro MO',
        'found': len(unique_members),
        'imported': total_imported,
        'skipped': total_skipped,
        'enriched': len(with_email),
        'source': 'leadgen_script',
        'triggered_by': EMAIL or 'script',
    })

    log(f'\n{"="*65}')
    log(f'  DONE')
    log(f'  Chamber members found:  {len(unique_members)}')
    log(f'  Shortlisted (AI ≥ {args.min_score}): {len(shortlisted)}')
    log(f'  Emails found:           {len(with_email)}')
    log(f'  Imported to campaigns:  {total_imported}')
    log(f'  Skipped (duplicates):   {total_skipped}')
    log(f'  CSV saved: {csv_path}')
    log(f'  Drip starts on next daily cron.')
    log(f'{"="*65}\n')


if __name__ == '__main__':
    main()
