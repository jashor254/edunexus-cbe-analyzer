'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut, Menu, X } from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Logo } from '@/components/ui/Logo'

const NAV_LINKS = [
  { href: '/learn',                      label: 'Compass',     color: 'hover:text-violet-600'  },
  { href: '/career',                     label: 'Careers',     color: 'hover:text-purple-600'  },
  { href: '/dashboard/clinic',           label: 'Clinic',      color: 'hover:text-cyan-600'    },
  { href: '/dashboard/assignments',      label: 'Assignments',  color: 'hover:text-pink-600'    },
  { href: '/pricing',                    label: 'Upgrade',     color: 'hover:text-amber-600'   },
]

const BOTTOM_NAV = [
  { href: '/dashboard',                  label: 'Home',        icon: '🏠' },
  { href: '/learn',                      label: 'Compass',     icon: '🧭' },
  { href: '/dashboard/clinic',           label: 'Clinic',      icon: '🏥' },
  { href: '/dashboard/assignments',      label: 'Assignments', icon: '📋' },
  { href: '/career',                     label: 'Careers',     icon: '💼' },
]

// Student-only pages (Sprint 19) — appended rather than folded into the
// shared arrays above so parent/teacher nav is completely unaffected.
// Sprint 3 (Platform Audit v1.0, Blocker #5): moved from the flat (student)
// route group into the canonical app/student/* tree — hrefs point directly
// there rather than through the compatibility redirects in next.config.ts.
const STUDENT_EXTRA_NAV_LINKS = [
  { href: '/student/blueprint',          label: 'Blueprint',   color: 'hover:text-indigo-600'  },
  { href: '/student/holiday',            label: 'Holiday',     color: 'hover:text-orange-600'  },
  { href: '/student/progress',           label: 'Progress',    color: 'hover:text-emerald-600' },
  { href: '/student/resources',          label: 'Resources',   color: 'hover:text-teal-600'    },
  { href: '/student/calendar',           label: 'Calendar',    color: 'hover:text-sky-600'     },
]

const STUDENT_EXTRA_BOTTOM_NAV = [
  { href: '/student/progress',           label: 'Progress',    icon: '📈' },
]

// `/dashboard/assignments` is only reachable when app/dashboard/layout.tsx's
// own redirect doesn't apply — i.e. never for a student account, which that
// layout always sends to /student instead. Student layouts pass isStudent so
// this shared nav points "Assignments" at /learn instead, where a student's
// assignments actually render (see app/learn/page.tsx's "Your Assignments"
// section) — same component, correct destination per audience, no new
// route, no new redirect. Default is unchanged for every existing caller.
export default function DashboardNavbar({ isStudent = false }: { isStudent?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const assignmentsHref = isStudent ? '/learn' : '/dashboard/assignments'
  // Careers points students at their own explorer, everyone else at the
  // parent-facing career intelligence entry point (Sprint 19 — see
  // app/(parent)/career-intelligence for the consolidated parent flow).
  const careersHref = isStudent ? '/student/career' : '/career-intelligence'
  const applyOverrides = <T extends { label: string; href: string }>(link: T): T => {
    if (link.label === 'Assignments') return { ...link, href: assignmentsHref }
    if (link.label === 'Careers')     return { ...link, href: careersHref }
    return link
  }
  const navLinks = [
    ...NAV_LINKS.map(applyOverrides),
    ...(isStudent ? STUDENT_EXTRA_NAV_LINKS : []),
  ]
  const bottomNav = [
    ...BOTTOM_NAV.map(applyOverrides),
    ...(isStudent ? STUDENT_EXTRA_BOTTOM_NAV : []),
  ]

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
              {navLinks.map(({ href, label, color }) => (
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
              {navLinks.map(({ href, label, color }) => (
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
          {bottomNav.map(({ href, label, icon }) => (
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
