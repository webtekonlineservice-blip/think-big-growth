import type { Metadata } from 'next'
import './globals.css'

const APP_URL = 'https://thinkbig.webtek.ai'

export const metadata: Metadata = {
  title: {
    default: 'Think Big St. Louis | BNI Referral Chapter — Kirkwood, MO',
    template: '%s | Think Big St. Louis',
  },
  description:
    'Think Big St. Louis is a BNI chapter of business professionals growing through structured referrals. One seat per profession. Every Thursday 11:30 AM at Mike Duffy\'s Pub & Grill, Kirkwood MO.',
  keywords: [
    'BNI',
    'Think Big St. Louis',
    'business networking',
    'referrals',
    'Kirkwood MO',
    'BNI chapter',
    'St. Louis networking group',
    'business referral organization',
    'grow your business',
    'structured networking',
    'Mike Duffy\'s',
    'BNI Mid America',
  ],
  authors: [{ name: 'Webtek.ai', url: 'https://webtek.ai' }],
  creator: 'Webtek.ai',
  publisher: 'Think Big St. Louis BNI Chapter',
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'Think Big St. Louis',
    title: 'Think Big St. Louis — BNI Referral Chapter',
    description:
      'Grow your business through the power of referrals. One seat per profession. Free to visit — every Thursday 11:30 AM in Kirkwood, MO.',
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Think Big St. Louis — BNI Chapter — Grow Your Business Through Referrals',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Think Big St. Louis — BNI Referral Chapter',
    description:
      'Grow your business through referrals. One seat per profession. Free to visit Thursdays in Kirkwood, MO.',
    images: [`${APP_URL}/twitter-image.png`],
    creator: '@webtekdigitalai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  verification: {
    // Add your Google Search Console verification code here when ready:
    // google: 'your-verification-code',
  },
}

// JSON-LD structured data for search engines
function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Think Big St. Louis',
    alternateName: 'BNI Think Big St. Louis',
    description:
      'A BNI chapter of business professionals in Kirkwood, MO dedicated to helping each other grow through structured referrals.',
    url: APP_URL,
    logo: `${APP_URL}/logo.png`,
    image: `${APP_URL}/og-image.png`,
    foundingDate: '2024',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kirkwood',
      addressRegion: 'MO',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 38.5834,
      longitude: -90.4068,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'membership inquiries',
      url: `${APP_URL}/join`,
    },
    memberOf: {
      '@type': 'Organization',
      name: 'BNI Mid America',
      url: 'https://bnimidamerica.com',
    },
    event: {
      '@type': 'Event',
      name: 'Think Big St. Louis Weekly Meeting',
      startDate: '2026-08-07T11:30:00-05:00',
      eventSchedule: {
        '@type': 'Schedule',
        repeatFrequency: 'P1W',
        byDay: 'Thursday',
        startTime: '11:30',
      },
      location: {
        '@type': 'Place',
        name: "Mike Duffy's Pub & Grill",
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Kirkwood',
          addressRegion: 'MO',
          addressCountry: 'US',
        },
      },
      organizer: {
        '@type': 'Organization',
        name: 'Think Big St. Louis',
        url: APP_URL,
      },
      isAccessibleForFree: true,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    },
    sameAs: [
      'https://bnimidamerica.com/mo-st--louis-think-big-st--louis/en-US/index',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <JsonLd />
      </head>
      <body className="bg-[#0a0f1e] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
