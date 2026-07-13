'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Menu } from 'lucide-react'
import { Sora } from 'next/font/google'
import { Logo } from '@/components/ui/Logo'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

// ─── Navigation ────────────────────────────────────────────────────────────────
function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent border-b border-white/10'
      }`}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Logo variant="dark" size="sm" />
          <span className="text-[11px] font-bold bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">Beta</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#school" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">
            For Schools
          </a>
          <a href="#teachers" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">
            For Teachers
          </a>
          <a href="#clinic" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">
            Learner Blueprint
          </a>
          <Link href="/pricing" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/insights" className="text-sm font-semibold text-white/60 hover:text-white transition-colors flex items-center gap-1.5">
            Insights
            <span className="text-[9px] font-bold bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">New</span>
          </Link>
          <Link href="/about" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">
            About
          </Link>
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-bold bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl border border-white/10 transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden w-10 h-10 flex items-center justify-center border border-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-black/95 border-b border-white/10">
          <div className="max-w-[1100px] mx-auto px-6 py-4 flex flex-col gap-1">
            {[
              { href: '#school',    label: 'For Schools'      },
              { href: '#teachers',  label: 'For Teachers'     },
              { href: '#clinic',    label: 'Learner Blueprint' },
              { href: '/pricing',   label: 'Pricing'          },
              { href: '/insights',  label: 'Insights ✦'       },
              { href: '/about',     label: 'About'            },
              { href: '/login',     label: 'Log in'           },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold text-white/60 hover:text-white py-3 border-b border-white/10 last:border-0 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3">
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="block text-center text-sm font-bold bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl border border-white/10 transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function MarketingFooter() {
  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-8">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
          {/* Left — logo + tagline */}
          <div>
            <div className="mb-3">
              <Logo variant="dark" size="sm" showTagline />
            </div>
            <p className="text-sm text-white/40 max-w-[240px] leading-relaxed">
              The Learning Intelligence Platform for Kenyan Schools.
            </p>
          </div>

          {/* Center — links */}
          <div className="flex flex-col gap-3">
            <Link href="/about" className="text-sm text-white/50 hover:text-white transition-colors">
              About
            </Link>
            <Link href="/insights" className="text-sm text-white/50 hover:text-white transition-colors">
              Insights
            </Link>
            <Link href="/legal/privacy" className="text-sm text-white/50 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className="text-sm text-white/50 hover:text-white transition-colors">
              Terms of Use
            </Link>
            <a
              href="mailto:hello@edunexus.co.ke"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>

          {/* Right — curriculum pills */}
          <div className="flex flex-wrap gap-2 content-start">
            {['CBC', 'IGCSE', '8-4-4'].map((pill) => (
              <span
                key={pill}
                className="text-xs font-semibold bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center space-y-1">
          <p className="text-xs text-white/30">© 2026 EduNexus Kenya. All rights reserved.</p>
          <p className="text-xs text-white/20">Developed by Jashor Technologies</p>
          <p className="text-xs text-white/15">AI-assisted · edunexus.co.ke</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-black text-white ${sora.className}`}>
      <MarketingNav />
      <div className="relative">
        {children}
      </div>
      <MarketingFooter />
    </div>
  )
}
