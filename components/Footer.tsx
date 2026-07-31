import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center font-extrabold text-xs text-white">
                TB
              </div>
              <span className="font-bold text-white text-sm">Think Big St. Louis</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              A BNI chapter dedicated to growing businesses through the power of referrals.
              One seat per profession. All collaboration, no competition.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Links</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-500 hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link href="/join" className="text-gray-500 hover:text-white transition-colors">Request to Visit</Link>
              </li>
              <li>
                <Link href="/member/login" className="text-gray-500 hover:text-white transition-colors">Member Login</Link>
              </li>
            </ul>
          </div>

          {/* Meeting Info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Meeting Details</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Every Thursday at 11:30 AM
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Mike Duffy's Pub &amp; Grill<br />Kirkwood, MO</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Think Big St. Louis — BNI Chapter. All rights reserved.</p>
          <p>
            Built &amp; powered by{' '}
            <a
              href="https://webtek.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-orange hover:text-brand-orange-dark transition-colors font-medium"
            >
              Webtek.ai
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
