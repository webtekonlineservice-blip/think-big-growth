# Google Slides Push — Setup

The treasurer "Push to Slides" button writes live values into your deck
(slides 93 = member dues status, 94 = chapter summary, 95 = speaker rotation).

It works by replacing **placeholder tokens** you put on the slides. One-time setup below.

---

## 1. Google Cloud: enable the API + create a service account

1. Go to <https://console.cloud.google.com> and create (or pick) a project.
2. **APIs & Services → Library** → search **Google Slides API** → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account**.
   - Name it e.g. `thinkbig-slides`. Skip the optional role steps → **Done**.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A JSON file downloads. Keep it safe.
5. Copy the service account **email** (looks like
   `thinkbig-slides@your-project.iam.gserviceaccount.com`).

## 2. Share the deck with the service account

Open your Google Slides deck → **Share** → paste the service account email →
set it to **Editor** → Send. (The app can only edit a deck it's shared on.)

## 3. Add the env vars

In `.env.local` (and in Vercel → Settings → Environment Variables):

```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"…","private_key":"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n","client_email":"…"}
GOOGLE_SLIDES_DECK_ID=18-PLxqc8LQZhonjItImMZl0DvxExuJPU1Dn0LXnibwA
```

- `GOOGLE_SERVICE_ACCOUNT_JSON` = the **entire** downloaded JSON, on one line.
  (Newlines in `private_key` can stay as `\n` — the app restores them.)
- `GOOGLE_SLIDES_DECK_ID` = the id from the deck URL:
  `https://docs.google.com/presentation/d/`**`<DECK_ID>`**`/edit`

Redeploy after adding env vars in Vercel.

## 4. Add placeholder tokens to the slides

Put these text tokens (with the double braces) into text boxes on the matching
slides. On push, each token is replaced with the current value.

### Slide 93 — Member dues status (up to 25 members)
Lay out pairs; unused slots are blanked automatically:

```
{{member_1}}      {{status_1}}
{{member_2}}      {{status_2}}
...
{{member_25}}     {{status_25}}
```
`status_n` renders as `Paid`, `$X.XX due`, or `Pending`.

### Slide 94 — Chapter summary

```
Starting Balance   {{starting_balance}}
Dues Collected     {{dues_collected}}
50/50 Collected    {{raffle_collected}}
Chapter Expenses   {{chapter_expenses}}
50/50 Paid out     {{raffle_paid_out}}
Total in Account   {{total_in_account}}
```

### Slide 95 — Speaker rotation (next 4 meetings)

```
{{speaker_date_1}}   {{speaker_1}}
{{speaker_date_2}}   {{speaker_2}}
{{speaker_date_3}}   {{speaker_3}}
{{speaker_date_4}}   {{speaker_4}}
```

## 5. Push

Treasurer → **Slides** tab → **Push to Slides**. The deck updates in a second or two.

### Notes
- `replaceAllText` swaps the token text in place; your fonts/sizes/positioning stay.
- Re-pushing is safe and idempotent — it just rewrites the same tokens.
- If a value is empty (e.g. unused member slot), the token is replaced with blank.
- Tokens are case-sensitive and must include the `{{ }}` braces exactly.
