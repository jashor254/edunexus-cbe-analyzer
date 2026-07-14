'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, MoreHorizontal, X, PlusCircle,
  GraduationCap, BarChart3, FileText, AlertTriangle, ClipboardList,
  Settings, LogOut, BookMarked, Languages, Scroll, NotebookPen,
  Presentation, FolderOpen,
} from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'

// Teacher's daily production workflow — surfaced in one tap via the
// "Create" tab instead of being scattered across the sidebar (Sprint 3A).
const CREATE_NAV = [
  { href: '/teacher/scheme-of-work', icon: Scroll,       label: 'Scheme of Work' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,  label: 'Lesson Plans'   },
  { href: '/teacher/record-of-work', icon: ClipboardList,label: 'Record of Work' },
  { href: '/teacher/slides',         icon: Presentation, label: 'AI Slides'      },
  { href: '/teacher/documents',      icon: FolderOpen,   label: 'All Documents', sub: 'Progress & downloads' },
]

// Secondary tools — everything that isn't part of the daily
// prepare-and-teach loop or already promoted to a primary tab.
const MORE_NAV = [
  { href: '/teacher/booklets',        icon: BookMarked,    label: 'Booklets'       },
  { href: '/teacher/academy',         icon: GraduationCap, label: 'AI Academy'     },
  { href: '/teacher/analytics',       icon: BarChart3,     label: 'Analytics'      },
  { href: '/teacher/kiswahili/insha', icon: Languages,     label: 'Insha Feedback' },
  { href: '/teacher/assignments',     icon: FileText,      label: 'Assignments'    },
  { href: '/teacher/reports',         icon: ClipboardList, label: 'Reports'        },
  { href: '/teacher/settings',        icon: Settings,      label: 'Settings'       },
]

function isRouteMatch(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export default function TeacherBottomNav() {
  const pathname                        = usePathname()
  const [moreOpen, setMoreOpen]         = useState(false)
  const [createOpen, setCreateOpen]     = useState(false)
  const [pendingEvals, setPendingEvals] = useState(0)

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingEvaluations')
    if (stored) setPendingEvals(parseInt(stored, 10))
  }, [pathname])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'pendingEvaluations' && e.newValue !== null) {
        setPendingEvals(parseInt(e.newValue, 10))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Close sheets on navigation
  useEffect(() => { setMoreOpen(false); setCreateOpen(false) }, [pathname])

  const homeActive   = pathname === '/teacher/dashboard' || pathname === '/teacher'
  const classesActive = isRouteMatch(pathname, '/teacher/classes')
  const alertsActive  = isRouteMatch(pathname, '/teacher/alerts')
  const createActive  = CREATE_NAV.some(item => isRouteMatch(pathname, item.href))
  const moreActive    = MORE_NAV.some(item => isRouteMatch(pathname, item.href))
  const sheetOpen     = moreOpen || createOpen

  return (
    <>
      {/* ── Bottom Nav Bar ─────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0c1929] border-t border-white/10 pb-safe">
        <div className="flex items-stretch h-16">

          <Link
            href="/teacher/dashboard"
            className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
          >
            {homeActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
            <LayoutDashboard className={`w-5 h-5 transition-colors ${homeActive ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className={`text-[10px] font-bold transition-colors ${homeActive ? 'text-teal-400' : 'text-slate-500'}`}>
              Home
            </span>
          </Link>

          <Link
            href="/teacher/classes"
            className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
          >
            {classesActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
            <BookOpen className={`w-5 h-5 transition-colors ${classesActive ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className={`text-[10px] font-bold transition-colors ${classesActive ? 'text-teal-400' : 'text-slate-500'}`}>
              Classes
            </span>
          </Link>

          {/* Create — the teacher's production workspace */}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
          >
            {(createActive && !createOpen) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
            <span className="relative">
              <PlusCircle className={`w-5 h-5 transition-colors ${createActive ? 'text-teal-400' : 'text-slate-500'}`} />
              {pendingEvals > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </span>
            <span className={`text-[10px] font-bold transition-colors ${createActive ? 'text-teal-400' : 'text-slate-500'}`}>
              Create
            </span>
          </button>

          <Link
            href="/teacher/alerts"
            className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
          >
            {alertsActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
            <AlertTriangle className={`w-5 h-5 transition-colors ${alertsActive ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className={`text-[10px] font-bold transition-colors ${alertsActive ? 'text-teal-400' : 'text-slate-500'}`}>
              Alerts
            </span>
          </Link>

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
          >
            {(moreActive && !moreOpen) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
            <MoreHorizontal className={`w-5 h-5 transition-colors ${moreActive ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className={`text-[10px] font-bold transition-colors ${moreActive ? 'text-teal-400' : 'text-slate-500'}`}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── Backdrop (shared by Create and More sheets) ───────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 ${
          sheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => { setMoreOpen(false); setCreateOpen(false) }}
      />

      {/* ── Create Sheet ───────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1929] rounded-t-3xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto ${
          createOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <span className="text-white font-black text-base">Create</span>
            <p className="text-slate-500 text-xs mt-0.5">Prepare your teaching materials</p>
          </div>
          <button
            onClick={() => setCreateOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-2">
          {CREATE_NAV.map(item => {
            const active = isRouteMatch(pathname, item.href)
            const showBadge = item.href === '/teacher/lesson-plans' && pendingEvals > 0
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCreateOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] ${
                  active ? 'bg-teal-500/15' : 'bg-white/5 active:bg-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-teal-500/20' : 'bg-white/8'}`}>
                  <item.icon className={`w-5 h-5 ${active ? 'text-teal-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${active ? 'text-teal-300' : 'text-slate-200'}`}>
                    {item.label}
                  </div>
                  {item.sub && <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>}
                </div>
                {showBadge && (
                  <span className="shrink-0 text-[10px] font-black bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full">
                    {pendingEvals}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── More Sheet ─────────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1929] rounded-t-3xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="text-white font-black text-base">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Nav grid */}
        <div className="px-4 py-4 grid grid-cols-3 gap-2">
          {MORE_NAV.map(item => {
            const active = isRouteMatch(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`relative flex flex-col items-center gap-2 px-2 py-3 rounded-2xl transition-all active:scale-95 ${
                  active ? 'bg-teal-500/15' : 'bg-white/5 active:bg-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-teal-500/20' : 'bg-white/8'}`}>
                  <item.icon className={`w-5 h-5 ${active ? 'text-teal-400' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight ${active ? 'text-teal-300' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-6 pt-2 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="flex-1">
            <RoleSwitcher />
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
