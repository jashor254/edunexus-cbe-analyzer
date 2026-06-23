'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, BookOpen, MoreHorizontal, X,
  FlaskConical, GraduationCap, BarChart3, FileText,
  AlertTriangle, ClipboardList, Settings, LogOut, BookMarked, Languages,
} from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'

const MORE_NAV = [
  { href: '/teacher/classes',     icon: FlaskConical,  label: 'Academic Clinic', sub: 'Diagnostic reports' },
  { href: '/teacher/booklets',    icon: BookMarked,    label: 'Booklets'                                  },
  { href: '/teacher/academy',     icon: GraduationCap, label: 'AI Academy'                               },
  { href: '/teacher/analytics',   icon: BarChart3,     label: 'Analytics'                                },
  { href: '/teacher/kiswahili/insha', icon: Languages,     label: 'Insha Feedback'                       },
  { href: '/teacher/assignments',     icon: FileText,      label: 'Assignments'                          },
  { href: '/teacher/alerts',          icon: AlertTriangle, label: 'Alerts'                               },
  { href: '/teacher/reports',     icon: ClipboardList, label: 'Reports'                                  },
  { href: '/teacher/settings',    icon: Settings,      label: 'Settings'                                 },
]

const TABS = [
  { id: 'home',      href: '/teacher/dashboard', icon: LayoutDashboard, label: 'Home'      },
  { id: 'documents', href: '/teacher/documents', icon: FolderOpen,      label: 'Documents' },
  { id: 'classes',   href: '/teacher/classes',   icon: BookOpen,        label: 'Classes'   },
]

function getActiveTab(pathname: string): string | null {
  if (pathname === '/teacher/dashboard' || pathname === '/teacher') return 'home'
  if (pathname.startsWith('/teacher/documents')) return 'documents'
  if (pathname.startsWith('/teacher/classes'))   return 'classes'
  return null
}

function isMoreRoute(pathname: string) {
  return MORE_NAV.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
}

export default function TeacherBottomNav() {
  const pathname                     = usePathname()
  const [moreOpen, setMoreOpen]      = useState(false)
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

  // Close More sheet on navigation
  useEffect(() => { setMoreOpen(false) }, [pathname])

  const activeTab  = getActiveTab(pathname)
  const moreActive = isMoreRoute(pathname)

  return (
    <>
      {/* ── Bottom Nav Bar ─────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0c1929] border-t border-white/10 pb-safe">
        <div className="flex items-stretch h-16">

          {TABS.map(tab => {
            const active = activeTab === tab.id
            const showBadge = tab.id === 'documents' && pendingEvals > 0
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
                )}
                <span className="relative">
                  <tab.icon className={`w-5 h-5 transition-colors ${active ? 'text-teal-400' : 'text-slate-500'}`} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
                  )}
                </span>
                <span className={`text-[10px] font-bold transition-colors ${active ? 'text-teal-400' : 'text-slate-500'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}

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

      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 ${
          moreOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMoreOpen(false)}
      />

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
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
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
