import Link from 'next/link'
import Logo from '@/components/Logo'
import VideoModal from '@/components/VideoModal'

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
            <VideoModal />
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

      {/* Open categories section */}
      <OpenCategories />

      {/* Footer */}
      <footer className="border-t border-gray-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Think Big St. Louis — BNI Chapter</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600">v0.01 beta</span>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <a href="https://webtek.ai" target="_blank" rel="noopener noreferrer">
                <Logo size="sm" href="" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
