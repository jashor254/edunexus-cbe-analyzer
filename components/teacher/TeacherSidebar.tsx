'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3,
  AlertTriangle, ClipboardList, Settings,
  LogOut, Scroll, NotebookPen, Sparkles, ChevronRight,
} from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Logo } from '@/components/ui/Logo'

const NAV = [
  { href: '/teacher/dashboard',      icon: LayoutDashboard, label: 'Dashboard'      },
  { href: '/teacher/classes',        icon: BookOpen,        label: 'My Classes'     },
  { href: '/teacher/assignments',    icon: FileText,        label: 'Assignments'    },
  { href: '/teacher/scheme-of-work', icon: Scroll,          label: 'Scheme of Work' },
  { href: '/teacher/record-of-work', icon: ClipboardList,   label: 'Record of Work', badge: 'NEW' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,     label: 'Lesson Plans'   },
  { href: '/teacher/insights',       icon: BarChart3,       label: 'Insights'       },
  { href: '/teacher/alerts',         icon: AlertTriangle,   label: 'Alerts'         },
  { href: '/teacher/reports',        icon: ClipboardList,   label: 'Reports'        },
  { href: '/teacher/settings',       icon: Settings,        label: 'Settings'       },
]

const MOBILE_NAV = [
  { href: '/teacher/dashboard',      icon: LayoutDashboard, label: 'Home'        },
  { href: '/teacher/classes',        icon: BookOpen,        label: 'Classes'     },
  { href: '/teacher/assignments',    icon: FileText,        label: 'Assignments' },
  { href: '/teacher/scheme-of-work', icon: Scroll,          label: 'Schemes'     },
  { href: '/teacher/insights',       icon: BarChart3,       label: 'Insights'    },
]

interface Props {
  teacherName: string
  school: string
  subject: string | null
}

export default function TeacherSidebar({ teacherName, school, subject }: Props) {
  const pathname = usePathname()
  const firstName = teacherName.split(' ')[0] || 'Mwalimu'
  const initials = teacherName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  function isActive(href: string) {
    if (href === '/teacher/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ── Desktop Sidebar ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 bg-[#0c1929]">

        {/* Top gradient accent line */}
        <div className="h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-blue-500" />

        {/* Logo */}
        <div className="px-5 py-5">
          <Link href="/teacher/dashboard">
            <Logo variant="dark" size="sm" />
          </Link>
        </div>

        {/* Teacher profile card — links to edit profile */}
        <Link href="/teacher/settings" className="mx-3 mb-4 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-teal-500/30 rounded-2xl p-4 transition-all group block">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-900/30 shrink-0">
              <span className="text-white font-black text-sm">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate leading-tight">{teacherName}</div>
              <div className="text-slate-400 text-xs truncate mt-0.5">{school}</div>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-600 group-hover:text-teal-400 transition-colors shrink-0" />
          </div>
          {subject && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-teal-300 font-semibold bg-teal-500/10 border border-teal-500/20 rounded-lg px-2.5 py-1.5 w-fit">
              <Sparkles className="w-3 h-3" />
              {subject}
            </div>
          )}
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                  active
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-full" />
                )}
                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${active ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-md font-black tracking-wide">
                    {item.badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 text-teal-400/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="mb-3 mx-1">
            <RoleSwitcher />
          </div>
          <div className="mb-2 mx-3">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Free Plan</div>
            <div className="mt-1.5 w-full bg-white/5 rounded-full h-1.5">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full w-[20%]" />
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all w-full mt-1"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile Header ─────────────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-20 bg-[#0c1929] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/teacher/dashboard">
          <Logo variant="dark" size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <RoleSwitcher />
          <Link href="/teacher/settings" className="w-8 h-8 rounded-xl bg-linear-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow active:scale-95 transition-transform">
            <span className="text-white font-black text-xs">{initials}</span>
          </Link>
        </div>
      </header>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0c1929] border-t border-white/10">
        <div className="flex items-stretch h-16">
          {MOBILE_NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-400 rounded-full" />
                )}
                <item.icon className={`w-5 h-5 transition-colors ${active ? 'text-teal-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-bold transition-colors ${active ? 'text-teal-400' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
