import Link from 'next/link'
import Logo from '@/components/Logo'

async function getCategories() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/categories`, { next: { revalidate: 300 } })
    if (!res.ok) return { openCategories: [] as string[] }
    return res.json() as Promise<{ openCategories: string[] }>
  } catch {
    return { openCategories: [] as string[] }
  }
}

async function OpenCategories() {
  const { openCategories } = await getCategories()

  if (!openCategories.length) return null

  // Show a representative sample of open categories
  const display = openCategories.slice(0, 18)

  return (
    <section className="px-6 py-16 border-t border-gray-800">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {openCategories.length} seats available
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Open Professions</h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            BNI allows one member per profession. These categories are currently open at Think Big St. Louis — is yours available?
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {display.map((cat) => (
            <span
              key={cat}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-full text-sm hover:border-green-500/40 hover:text-green-400 transition-colors"
            >
              {cat}
            </span>
          ))}
          {openCategories.length > 18 && (
            <span className="px-3 py-1.5 bg-gray-700/50 border border-gray-700 text-gray-500 rounded-full text-sm">
              +{openCategories.length - 18} more
            </span>
          )}
        </div>

        <div className="text-center">
          <Link href="/join" className="btn-primary text-sm px-6 py-3">
            Claim Your Seat →
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4 backdrop-blur-sm bg-[#0a0f1e]/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Link
              href="/member/login"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Member Login
            </Link>
            <Link href="/join" className="btn-primary text-sm px-4 py-2">
              Request to Visit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-blue/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-brand-orange/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Chapter badge */}
          <div className="inline-flex items-center gap-2 bg-brand-blue/20 border border-brand-blue/30 text-brand-blue px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-brand-blue rounded-full animate-pulse" />
            BNI Chapter — Kirkwood, MO
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Think Big{' '}
            <span className="text-brand-orange">St. Louis</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 font-light mb-4">
            Grow your business through the power of referrals.
          </p>
          <p className="text-gray-500 mb-10 max-w-xl mx-auto">
            We are a BNI chapter of business professionals dedicated to helping
            each other grow through structured, meaningful referrals. One seat
            per profession — is yours available?
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join" className="btn-primary text-base px-8 py-4">
              Request to Visit →
            </Link>
            <a href="#about" className="btn-ghost text-base px-8 py-4">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Meeting info banner */}
      <section className="bg-brand-blue/10 border-y border-brand-blue/20 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-blue font-semibold mb-0.5">Meeting Day</p>
              <p className="text-white font-semibold">Every Thursday</p>
            </div>
          </div>

          <div className="hidden md:block w-px h-10 bg-gray-700" />

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-orange/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold mb-0.5">Meeting Time</p>
              <p className="text-white font-semibold">11:30 AM</p>
            </div>
          </div>

          <div className="hidden md:block w-px h-10 bg-gray-700" />

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Location</p>
              <p className="text-white font-semibold">Mike Duffy's Pub & Grill</p>
              <p className="text-gray-400 text-sm">Kirkwood, MO</p>
            </div>
          </div>
        </div>
      </section>

      {/* About section */}
      <section id="about" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Visit Think Big?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              BNI is the world's largest business referral organization. Our chapter
              generates real revenue for members through structured networking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                color: 'text-brand-blue',
                bg: 'bg-brand-blue/10',
                title: 'Exclusive Seats',
                desc: 'One member per profession. No competition within the chapter — only collaboration.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                ),
                color: 'text-brand-orange',
                bg: 'bg-brand-orange/10',
                title: 'Proven Results',
                desc: 'BNI members pass millions of referrals annually, generating billions in revenue worldwide.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: 'text-green-400',
                bg: 'bg-green-400/10',
                title: 'Structured Format',
                desc: 'Every meeting is intentional. Business pitches, referrals, and education built in to maximize ROI on your time.',
              },
            ].map((item) => (
              <div key={item.title} className="card flex flex-col gap-4">
                <div className={`w-12 h-12 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open categories section */}
      <OpenCategories />

      {/* CTA */}
      <section className="px-6 py-16 border-t border-gray-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to see it for yourself?
          </h2>
          <p className="text-gray-400 mb-8">
            Guests are welcome to visit twice before applying for membership.
            Register below and we'll confirm your spot and send you everything
            you need to know.
          </p>
          <Link href="/join" className="btn-primary text-base px-10 py-4">
            Request to Visit →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Think Big St. Louis — BNI Chapter</p>
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <a href="https://webtek.ai" target="_blank" rel="noopener noreferrer">
              <Logo size="sm" href="" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
