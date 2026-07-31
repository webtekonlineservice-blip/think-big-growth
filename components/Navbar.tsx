'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-brand-orange flex items-center justify-center font-extrabold text-sm text-white shadow-lg shadow-brand-orange/20 group-hover:shadow-brand-orange/40 transition-shadow">
            TB
          </div>
          <div className="leading-tight">
            <span className="font-bold text-white text-sm tracking-wide">Think Big</span>
            <span className="block text-[10px] text-gray-500 tracking-widest uppercase">St. Louis · BNI</span>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/#about" className="text-sm text-gray-400 hover:text-white transition-colors">
            About
          </Link>
          <Link href="/join" className="text-sm text-gray-400 hover:text-white transition-colors">
            Visit Us
          </Link>
          <Link href="/member/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Member Login
          </Link>
          <Link
            href="/join"
            className="btn-primary text-sm px-5 py-2"
          >
            Request to Visit
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-400 hover:text-white transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950 px-6 py-4 space-y-3">
          <Link href="/#about" className="block text-sm text-gray-400 hover:text-white py-1 transition-colors" onClick={() => setMenuOpen(false)}>
            About
          </Link>
          <Link href="/join" className="block text-sm text-gray-400 hover:text-white py-1 transition-colors" onClick={() => setMenuOpen(false)}>
            Visit Us
          </Link>
          <Link href="/member/login" className="block text-sm text-gray-400 hover:text-white py-1 transition-colors" onClick={() => setMenuOpen(false)}>
            Member Login
          </Link>
          <Link href="/join" className="btn-primary text-sm px-5 py-2 w-full justify-center mt-2" onClick={() => setMenuOpen(false)}>
            Request to Visit
          </Link>
        </div>
      )}
    </nav>
  )
}
