import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Think Big St. Louis | BNI Chapter Growth',
  description:
    'Think Big St. Louis is a BNI chapter meeting every Thursday at 11:30 AM at Mike Duffy\'s Pub & Grill in Kirkwood, MO. Join us to grow your business through referrals.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'
  ),
  openGraph: {
    title: 'Think Big St. Louis | BNI Chapter',
    description: 'Grow your business through the power of referrals. Visit our BNI chapter in Kirkwood, MO.',
    url: 'https://thinkbig.webtek.ai',
    siteName: 'Think Big St. Louis',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-gray-900 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
