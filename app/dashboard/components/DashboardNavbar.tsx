'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut, Menu, X } from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Logo } from '@/components/ui/Logo'

const NAV_LINKS = [
  { href: '/chat',                       label: 'Compass',     color: 'hover:text-violet-600'  },
  { href: '/career',                     label: 'Careers',     color: 'hover:text-purple-600'  },
  { href: '/dashboard/clinic',           label: 'Clinic',      color: 'hover:text-cyan-600'    },
  { href: '/dashboard/assignments',      label: 'Assignments',  color: 'hover:text-pink-600'    },
  { href: '/pricing',                    label: 'Upgrade',     color: 'hover:text-amber-600'   },
]

const BOTTOM_NAV = [
  { href: '/dashboard',                  label: 'Home',        icon: '🏠' },
  { href: '/chat',                       label: 'Compass',     icon: '🧭' },
  { href: '/dashboard/clinic',           label: 'Clinic',      icon: '🏥' },
  { href: '/dashboard/assignments',      label: 'Assignments', icon: '📋' },
  { href: '/career',                     label: 'Careers',     icon: '💼' },
]

export default function DashboardNavbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b-2 border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link href="/dashboard">
              <Logo variant="light" size="md" />
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-4 lg:gap-6">
              {NAV_LINKS.map(({ href, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-bold text-slate-600 ${color} transition-colors`}
                >
                  {label}
                </Link>
              ))}
              <RoleSwitcher />
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-600 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>

            {/* Mobile: Sign Out + Hamburger */}
            <div className="flex md:hidden items-center gap-1">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white shadow-lg">
            <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
              {NAV_LINKS.map(({ href, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`py-3 px-2 text-sm font-bold text-slate-600 ${color} border-b border-slate-100 last:border-0 transition-colors`}
                >
                  {label}
                </Link>
              ))}
              <div className="py-3 px-2">
                <RoleSwitcher />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-200 shadow-lg">
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-violet-600 transition-colors"
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
