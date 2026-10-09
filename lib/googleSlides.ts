/**
 * Google Slides push — writes treasurer data into named placeholders on the deck.
 *
 * Setup (one-time):
 *   1. Create a Google Cloud project, enable the Google Slides API.
 *   2. Create a service account, download its JSON key.
 *   3. Put the JSON in env GOOGLE_SERVICE_ACCOUNT_JSON (stringified) and the
 *      deck id in GOOGLE_SLIDES_DECK_ID.
 *   4. Share the Slides deck with the service account email (Editor).
 *   5. Lay out slides 93/94/95 with placeholder tokens like {{member_1}},
 *      {{status_1}}, {{bank_total}}, {{speaker_1}}, etc.
 *
 * The push uses replaceAllText, so tokens can live in any text box on any slide.
 */
// Import only the Slides API + auth, NOT the full `googleapis` barrel (which
// pulls in every Google API and blows up the build's memory).
import { slides_v1 } from '@googleapis/slides'
import { JWT } from 'google-auth-library'

const SCOPES = ['https://www.googleapis.com/auth/presentations']

export interface SlideReplacement {
  token: string   // without braces, e.g. "member_1"
  value: string
}

function getCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.')
  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON missing client_email / private_key.')
  }
  // Env vars often escape newlines in the private key — restore them.
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') }
}

/**
 * Replace {{token}} occurrences across the whole deck with the given values.
 * Returns the number of replacement requests sent.
 */
export async function pushToSlides(replacements: SlideReplacement[]): Promise<{ requests: number; deckId: string }> {
  const deckId = process.env.GOOGLE_SLIDES_DECK_ID
  if (!deckId) throw new Error('GOOGLE_SLIDES_DECK_ID is not set.')

  const { client_email, private_key } = getCredentials()
  const auth = new JWT({ email: client_email, key: private_key, scopes: SCOPES })
  const slides = new slides_v1.Slides({ auth })

  const requests = replacements.map((r) => ({
    replaceAllText: {
      containsText: { text: `{{${r.token}}}`, matchCase: true },
      replaceText: r.value,
    },
  }))

  if (requests.length === 0) return { requests: 0, deckId }

  await slides.presentations.batchUpdate({
    presentationId: deckId,
    requestBody: { requests },
  })

  return { requests: requests.length, deckId }
}
