import Link from 'next/link'
import { notFound } from 'next/navigation'
import Logo from '@/components/Logo'

interface Member {
  name: string
  company: string
  role?: string
}

async function getMember(code: string): Promise<Member | null> {
  try {
    const baseUrl = 'https://thinkbig.webtek.ai'
    const res = await fetch(`${baseUrl}/api/invite/${code}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

interface Props {
  params: { code: string }
}

export async function generateMetadata({ params }: Props) {
  const member = await getMember(params.code)
  if (!member) return { title: 'Invite | Think Big St. Louis' }

  const title = `${member.name} invited you to Think Big St. Louis`
  const description = `You've been personally invited by ${member.name}${member.company ? ` from ${member.company}` : ''} to visit our BNI chapter. One seat per profession — grow your business through referrals. Every Thursday 11:30 AM in Kirkwood, MO. Free to visit.`
  const url = `https://thinkbig.webtek.ai/invite/${params.code}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Think Big St. Louis',
      images: [{ url: 'https://thinkbig.webtek.ai/og-image.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://thinkbig.webtek.ai/og-image.png'],
    },
  }
}

export default async function InvitePage({ params }: Props) {
  const member = await getMember(params.code)

  if (!member) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4 backdrop-blur-sm bg-[#0a0f1e]/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center">
          <Logo />
        </div>
      </nav>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Invitation header */}
          <div className="card mb-8 border-brand-blue/40 bg-brand-blue/5 text-center">
            <div className="w-14 h-14 bg-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-1">Personal invitation from</p>
            <h1 className="text-2xl font-bold text-white mb-1">{member.name}</h1>
            {member.company && (
              <p className="text-brand-blue text-sm font-medium">{member.company}</p>
            )}
          </div>

          {/* Invite message */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">
              You're invited to visit{' '}
              <span className="text-brand-orange">Think Big St. Louis</span>
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {member.name} thinks you'd be a great fit for our BNI chapter and
              wants to personally introduce you. Come see how our members help
              each other grow through the power of referrals.
            </p>
          </div>

          {/* Meeting details */}
          <div className="card mb-8">
            <h3 className="text-sm font-semibold text-brand-orange uppercase tracking-widest mb-4">
              Meeting Details
            </h3>
            <ul className="space-y-3">
              {[
                {
                  label: 'When',
                  value: 'Every Thursday at 11:30 AM',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  ),
                },
                {
                  label: 'Where',
                  value: "Mike Duffy's Pub & Grill, Kirkwood, MO",
                  icon: (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </>
                  ),
                },
                {
                  label: 'Cost',
                  value: 'Free for guests — no commitment',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ),
                },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.icon}
                  </svg>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</span>
                    <p className="text-white text-sm">{item.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4">Why BNI Works</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Exclusive profession seats',
                'Structured referral system',
                'Accountability & support',
                'Access to 300K+ members worldwide',
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-5 h-5 bg-brand-orange/20 text-brand-orange rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Link
            href={`/join?ref=${params.code}`}
            className="btn-primary w-full justify-center text-base py-4"
          >
            Register to Visit →
          </Link>
          <p className="text-xs text-gray-500 text-center mt-3">
            Guests may visit twice at no cost before deciding to apply.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-800/60 px-6 py-6 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} Think Big St. Louis — BNI Chapter · Powered by{' '}
        <a href="https://webtek.ai" className="hover:opacity-80 transition-opacity inline-flex items-center gap-1 align-middle" target="_blank" rel="noopener noreferrer">
          <Logo size="sm" href="" />
        </a>
      </footer>
    </div>
  )
}
